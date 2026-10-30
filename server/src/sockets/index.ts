import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { z } from 'zod';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { roomManager } from '../services/room.manager.js';
import { meetingRepository } from '../repositories/meeting.repository.js';
import { chatService } from '../services/chat.service.js';
import { nowIso } from '../utils/time.js';

let io: SocketIOServer | null = null;

export const isAllowedSocketOrigin = (origin: string | undefined): boolean => {
  if (!origin) return true;
  if (origin === env.CORS_ORIGIN) return true;
  try {
    const url = new URL(origin);
    const hostname = url.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') return true;
    if (hostname.endsWith('.netlify.app') || hostname.endsWith('.onrender.com')) return true;
    if (
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)
    ) {
      return true;
    }
  } catch {
    return false;
  }
  return false;
};

export const initSocketServer = (httpServer: HttpServer): SocketIOServer => {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: (requestOrigin, callback) => {
        if (isAllowedSocketOrigin(requestOrigin)) {
          callback(null, true);
        } else {
          callback(new Error('Blocked by CORS'));
        }
      },
      credentials: true,
      methods: ['GET', 'POST'],
    },
    pingTimeout: 60000,
  });

  io.on('connection', (socket: Socket) => {
    logger.info({ socketId: socket.id }, 'Socket client connected');

    // Room Join Handler
    socket.on(
      'room:join',
      async (data: {
        meetingCode: string;
        participantId: string;
        displayName: string;
        hostToken?: string;
        userId?: string | null;
        isMuted?: boolean;
        isVideoOff?: boolean;
      }) => {
        try {
          const code = data.meetingCode?.toLowerCase().trim();
          if (!code || !data.participantId || !data.displayName) {
            socket.emit('room:error', { message: 'Invalid room join payload' });
            return;
          }

          let room = roomManager.getRoom(code);

          // If room not in memory, hydrate from PostgreSQL
          if (!room) {
            const dbMeeting = await meetingRepository.findByCode(code);
            if (!dbMeeting || dbMeeting.status === 'ended') {
              socket.emit('room:error', { message: 'Meeting does not exist or has ended' });
              return;
            }

            room = roomManager.createRoom({
              meetingId: dbMeeting.id,
              meetingCode: dbMeeting.meetingCode,
              hostUserId: dbMeeting.hostUserId,
              hostTokenHash: dbMeeting.hostTokenHash,
              title: dbMeeting.title,
              maxParticipants: dbMeeting.maxParticipants,
              isEphemeral: dbMeeting.isEphemeral,
            });
          }

          // Determine role
          const isHost = roomManager.isHost(code, {
            userId: data.userId || null,
            hostToken: data.hostToken || null,
          });

          // Check capacity (allow rejoining existing participant without capacity error)
          const existingParticipant = room.participants.get(data.participantId);
          if (!existingParticipant && roomManager.isRoomFull(code)) {
            socket.emit('room:error', {
              message: `Meeting room has reached its maximum capacity of ${room.maxParticipants} participants`,
            });
            return;
          }

          // Add / update participant in memory
          const participant = roomManager.addParticipant(code, {
            id: data.participantId,
            socketId: socket.id,
            userId: data.userId || null,
            displayName: data.displayName.trim(),
            role: isHost ? 'host' : 'participant',
            joinedAt: nowIso(),
            isMuted: data.isMuted ?? false,
            isVideoOff: data.isVideoOff ?? false,
            isScreenSharing: false,
          });

          // Join socket.io channel
          socket.join(`room:${code}`);
          socket.join(`conv:group-${code}`);

          // Emit confirmation to joining client
          socket.emit('room:joined', {
            meetingCode: code,
            participant,
            room: {
              title: room.title,
              maxParticipants: room.maxParticipants,
              isEphemeral: room.isEphemeral,
              participants: Array.from(room.participants.values()),
            },
          });

          // Broadcast arrival to peers
          socket.to(`room:${code}`).emit('participant:joined', { participant });

          // Broadcast updated participant roster
          io?.to(`room:${code}`).emit('room:participants', {
            participants: Array.from(room.participants.values()),
            count: room.participants.size,
          });

          logger.info(
            { meetingCode: code, participantId: participant.id, role: participant.role },
            'Socket joined meeting room'
          );
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Failed to join room';
          logger.error({ err, socketId: socket.id }, 'Error during socket room:join');
          socket.emit('room:error', { message: msg });
        }
      }
    );

    // Media State Toggle
    socket.on(
      'media:toggle',
      (data: {
        meetingCode: string;
        participantId: string;
        isMuted?: boolean;
        isVideoOff?: boolean;
        isScreenSharing?: boolean;
      }) => {
        const code = data.meetingCode?.toLowerCase().trim();
        const updated = roomManager.updateParticipantMedia(code, data.participantId, {
          isMuted: data.isMuted,
          isVideoOff: data.isVideoOff,
          isScreenSharing: data.isScreenSharing,
        });

        if (updated) {
          io?.to(`room:${code}`).emit('participant:media-updated', {
            participantId: updated.id,
            isMuted: updated.isMuted,
            isVideoOff: updated.isVideoOff,
            isScreenSharing: updated.isScreenSharing,
          });
        }
      }
    );

    // Helper to validate that socket is in meeting room and caller is authorized
    const validateParticipant = (meetingCode: string, claimedParticipantId: string) => {
      const code = meetingCode?.toLowerCase().trim();
      const room = roomManager.getRoom(code);
      if (!room) return null;

      if (!socket.rooms.has(`room:${code}`)) {
        logger.warn({ socketId: socket.id, meetingCode: code }, 'Socket not in room channel');
        return null;
      }

      const actualParticipantId = room.socketMap.get(socket.id);
      if (!actualParticipantId || actualParticipantId !== claimedParticipantId) {
        logger.warn(
          { socketId: socket.id, actualParticipantId, claimedParticipantId },
          'Claimed participantId does not match socket session'
        );
        return null;
      }

      const participant = room.participants.get(claimedParticipantId);
      if (!participant) return null;

      return { room, participant, code };
    };

    // Chat Conversation Room Join
    socket.on('chat:join', async (data: { meetingCode: string; conversationId: string; participantId: string }) => {
      try {
        const validated = validateParticipant(data.meetingCode, data.participantId);
        if (!validated) {
          socket.emit('chat:error', { message: 'Unauthorized conversation join attempt' });
          return;
        }

        const convId = data.conversationId?.trim();
        if (!convId) {
          socket.emit('chat:error', { message: 'Invalid conversationId' });
          return;
        }

        socket.join(`conv:${convId}`);
        socket.emit('chat:joined', { conversationId: convId });
        logger.info({ socketId: socket.id, convId, participantId: data.participantId }, 'Socket joined conversation room');
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to join conversation';
        socket.emit('chat:error', { message: msg });
      }
    });

    // Chat Conversation Room Leave
    socket.on('chat:leave', (data: { conversationId: string }) => {
      const convId = data?.conversationId?.trim();
      if (convId) {
        socket.leave(`conv:${convId}`);
      }
    });

    // Submit Text Message
    const messageSendSchema = z.object({
      meetingCode: z.string().min(1),
      conversationId: z.string().min(1),
      participantId: z.string().min(1),
      content: z.string().min(1, 'Message cannot be empty').max(5000, 'Message cannot exceed 5,000 characters'),
      clientMessageId: z.string().optional(),
    });

    socket.on(
      'message:send',
      async (
        rawData: unknown,
        ack?: (response: { success: boolean; message?: unknown; error?: string }) => void
      ) => {
        try {
          const parsed = messageSendSchema.safeParse(rawData);
          if (!parsed.success) {
            const errText = parsed.error.issues[0]?.message || 'Invalid message payload';
            socket.emit('chat:error', { message: errText });
            ack?.({ success: false, error: errText });
            return;
          }

          const { meetingCode, conversationId, participantId, content, clientMessageId } = parsed.data;
          const validated = validateParticipant(meetingCode, participantId);
          if (!validated) {
            socket.emit('chat:error', { message: 'Unauthorized participant' });
            ack?.({ success: false, error: 'Unauthorized participant' });
            return;
          }

          const newMsg = await chatService.sendMessage(
            meetingCode,
            conversationId,
            validated.participant.id,
            validated.participant.displayName,
            validated.participant.userId,
            content,
            clientMessageId
          );

          // Deliver to conversation channel
          io?.to(`conv:${conversationId}`).emit('message:new', newMsg);

          const norm = meetingCode.toLowerCase().trim();
          // For group chat, also broadcast to room channel so every connected participant receives it instantly
          if (!newMsg.conversationId.includes('direct')) {
            io?.to(`room:${norm}`).emit('message:new', newMsg);
          }

          // If this is a direct conversation, also notify the recipient directly if not already in conv room
          if (newMsg.conversationId.includes('direct')) {
            // direct conversation id formats: direct-code-p1-p2 or UUID
            const conv = await chatService.getConversations(meetingCode, validated.participant.id);
            const thisConv = conv.find((c) => c.id === conversationId);
            if (thisConv) {
              const recipient = thisConv.members.find((m) => m.participantId !== validated.participant.id);
              if (recipient) {
                const recipientParticipant = validated.room.participants.get(recipient.participantId);
                if (recipientParticipant?.socketId) {
                  io?.to(recipientParticipant.socketId).emit('message:new', newMsg);
                }
              }
            }
          }

          // Acknowledge back to sender
          ack?.({ success: true, message: newMsg });
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : 'Failed to send message';
          socket.emit('chat:error', { message: errMsg });
          ack?.({ success: false, error: errMsg });
        }
      }
    );

    // Edit Message
    const messageEditSchema = z.object({
      meetingCode: z.string().min(1),
      conversationId: z.string().min(1),
      messageId: z.string().min(1),
      participantId: z.string().min(1),
      content: z.string().min(1).max(5000),
    });

    socket.on('message:edit', async (rawData: unknown) => {
      try {
        const parsed = messageEditSchema.safeParse(rawData);
        if (!parsed.success) {
          socket.emit('chat:error', { message: parsed.error.issues[0]?.message || 'Invalid edit payload' });
          return;
        }

        const { meetingCode, conversationId, messageId, participantId, content } = parsed.data;
        const validated = validateParticipant(meetingCode, participantId);
        if (!validated) {
          socket.emit('chat:error', { message: 'Unauthorized edit attempt' });
          return;
        }

        const updated = await chatService.editMessage(
          meetingCode,
          conversationId,
          messageId,
          validated.participant.id,
          content
        );

        io?.to(`conv:${conversationId}`).emit('message:edited', updated);
        if (!conversationId.includes('direct')) {
          io?.to(`room:${meetingCode.toLowerCase().trim()}`).emit('message:edited', updated);
        }
      } catch (err: unknown) {
        socket.emit('chat:error', { message: err instanceof Error ? err.message : 'Failed to edit message' });
      }
    });

    // Delete Message
    const messageDeleteSchema = z.object({
      meetingCode: z.string().min(1),
      conversationId: z.string().min(1),
      messageId: z.string().min(1),
      participantId: z.string().min(1),
    });

    socket.on('message:delete', async (rawData: unknown) => {
      try {
        const parsed = messageDeleteSchema.safeParse(rawData);
        if (!parsed.success) {
          socket.emit('chat:error', { message: parsed.error.issues[0]?.message || 'Invalid delete payload' });
          return;
        }

        const { meetingCode, conversationId, messageId, participantId } = parsed.data;
        const validated = validateParticipant(meetingCode, participantId);
        if (!validated) {
          socket.emit('chat:error', { message: 'Unauthorized delete attempt' });
          return;
        }

        const updated = await chatService.deleteMessage(
          meetingCode,
          conversationId,
          messageId,
          validated.participant.id
        );

        io?.to(`conv:${conversationId}`).emit('message:deleted', updated);
        if (!conversationId.includes('direct')) {
          io?.to(`room:${meetingCode.toLowerCase().trim()}`).emit('message:deleted', updated);
        }
      } catch (err: unknown) {
        socket.emit('chat:error', { message: err instanceof Error ? err.message : 'Failed to delete message' });
      }
    });

    // Emoji Reactions
    const messageReactionSchema = z.object({
      meetingCode: z.string().min(1),
      conversationId: z.string().min(1),
      messageId: z.string().min(1),
      participantId: z.string().min(1),
      emoji: z.string().min(1).max(32),
    });

    socket.on('message:reaction', async (rawData: unknown) => {
      try {
        const parsed = messageReactionSchema.safeParse(rawData);
        if (!parsed.success) {
          socket.emit('chat:error', { message: parsed.error.issues[0]?.message || 'Invalid reaction payload' });
          return;
        }

        const { meetingCode, conversationId, messageId, participantId, emoji } = parsed.data;
        const validated = validateParticipant(meetingCode, participantId);
        if (!validated) {
          socket.emit('chat:error', { message: 'Unauthorized reaction attempt' });
          return;
        }

        const result = await chatService.toggleReaction(
          meetingCode,
          conversationId,
          messageId,
          validated.participant.id,
          validated.participant.userId,
          emoji
        );

        const reactionPayload = {
          conversationId,
          messageId,
          participantId: validated.participant.id,
          emoji: result.emoji,
          action: result.action,
        };
        io?.to(`conv:${conversationId}`).emit('message:reaction', reactionPayload);
        if (!conversationId.includes('direct')) {
          io?.to(`room:${meetingCode.toLowerCase().trim()}`).emit('message:reaction', reactionPayload);
        }
      } catch (err: unknown) {
        socket.emit('chat:error', { message: err instanceof Error ? err.message : 'Failed to toggle reaction' });
      }
    });

    // Mark as Read
    const messageReadSchema = z.object({
      meetingCode: z.string().min(1),
      conversationId: z.string().min(1),
      participantId: z.string().min(1),
      messageIds: z.array(z.string()).min(1),
    });

    socket.on('message:read', async (rawData: unknown) => {
      try {
        const parsed = messageReadSchema.safeParse(rawData);
        if (!parsed.success) return;

        const { meetingCode, conversationId, participantId, messageIds } = parsed.data;
        const validated = validateParticipant(meetingCode, participantId);
        if (!validated) return;

        await chatService.markAsRead(
          meetingCode,
          conversationId,
          messageIds,
          validated.participant.id,
          validated.participant.userId
        );

        const readPayload = {
          conversationId,
          readerParticipantId: validated.participant.id,
          messageIds,
          readAt: nowIso(),
        };
        io?.to(`conv:${conversationId}`).emit('message:read', readPayload);
        if (!conversationId.includes('direct')) {
          io?.to(`room:${meetingCode.toLowerCase().trim()}`).emit('message:read', readPayload);
        }
      } catch {
        // Ignore read receipt background failures
      }
    });

    // Legacy in-call chat fallback handler
    socket.on(
      'chat:message',
      async (data: { meetingCode: string; participantId: string; content: string }) => {
        try {
          const code = data.meetingCode?.toLowerCase().trim();
          const content = typeof data.content === 'string' ? data.content.trim() : '';
          if (!code || !content || !data.participantId) return;

          const validated = validateParticipant(code, data.participantId);
          if (!validated) return;

          // Default to group conversation
          const groupConv = await chatService.getConversations(code, validated.participant.id);
          const targetConv = groupConv.find((c) => c.conversationType === 'group');
          if (!targetConv) return;

          const newMsg = await chatService.sendMessage(
            code,
            targetConv.id,
            validated.participant.id,
            validated.participant.displayName,
            validated.participant.userId,
            content
          );

          io?.to(`room:${code}`).emit('chat:message', newMsg);
          io?.to(`conv:${targetConv.id}`).emit('message:new', newMsg);
        } catch (err) {
          logger.warn({ err }, 'Error in fallback chat:message handler');
        }
      }
    );

    // Host Action Handling (Mute All, Kick)
    socket.on(
      'host:action',
      async (data: {
        meetingCode: string;
        hostToken?: string;
        userId?: string | null;
        action: 'mute-all' | 'end-meeting';
      }) => {
        const code = data.meetingCode?.toLowerCase().trim();
        const isAuthorized = roomManager.isHost(code, {
          userId: data.userId,
          hostToken: data.hostToken,
        });

        if (!isAuthorized) {
          socket.emit('room:error', { message: 'Unauthorized: Host privileges required' });
          return;
        }

        if (data.action === 'mute-all') {
          io?.to(`room:${code}`).emit('host:mute-all', {
            reason: 'Host requested all participants to be muted',
          });
          logger.info({ meetingCode: code }, 'Host issued mute-all command');
        } else if (data.action === 'end-meeting') {
          // Handled via REST or broadcast
          io?.to(`room:${code}`).emit('meeting:ended', {
            reason: 'The host has ended the meeting for everyone.',
            endedAt: nowIso(),
          });
          roomManager.closeRoom(code);
        }
      }
    );

    // Validate socket room membership before relaying signaling events
    const validateSignaling = (meetingCode: string, claimedSenderId: string, targetId: string) => {
      const code = meetingCode?.toLowerCase().trim();
      const room = roomManager.getRoom(code);
      if (!room) return null;

      if (!socket.rooms.has(`room:${code}`)) {
        logger.warn({ socketId: socket.id, meetingCode: code }, 'Signaling rejected: socket not in room channel');
        return null;
      }

      const actualSenderId = room.socketMap.get(socket.id);
      if (!actualSenderId || actualSenderId !== claimedSenderId) {
        logger.warn(
          { socketId: socket.id, actualSenderId, claimedSenderId },
          'Signaling rejected: claimed senderId does not match socket session'
        );
        return null;
      }

      const target = room.participants.get(targetId);
      if (!target?.socketId) {
        return null;
      }

      return { room, target, verifiedSenderId: actualSenderId };
    };

    // WebRTC Signaling Events with Room Membership Validation
    socket.on(
      'signal:offer',
      (data: {
        meetingCode: string;
        targetParticipantId: string;
        senderParticipantId: string;
        offer: unknown;
      }) => {
        const validated = validateSignaling(data.meetingCode, data.senderParticipantId, data.targetParticipantId);
        if (validated) {
          io?.to(validated.target.socketId).emit('signal:offer', {
            senderParticipantId: validated.verifiedSenderId,
            offer: data.offer,
          });
        }
      }
    );

    socket.on(
      'signal:answer',
      (data: {
        meetingCode: string;
        targetParticipantId: string;
        senderParticipantId: string;
        answer: unknown;
      }) => {
        const validated = validateSignaling(data.meetingCode, data.senderParticipantId, data.targetParticipantId);
        if (validated) {
          io?.to(validated.target.socketId).emit('signal:answer', {
            senderParticipantId: validated.verifiedSenderId,
            answer: data.answer,
          });
        }
      }
    );

    socket.on(
      'signal:ice-candidate',
      (data: {
        meetingCode: string;
        targetParticipantId: string;
        senderParticipantId: string;
        candidate: unknown;
      }) => {
        const validated = validateSignaling(data.meetingCode, data.senderParticipantId, data.targetParticipantId);
        if (validated) {
          io?.to(validated.target.socketId).emit('signal:ice-candidate', {
            senderParticipantId: validated.verifiedSenderId,
            candidate: data.candidate,
          });
        }
      }
    );

    // Room Leave
    socket.on('room:leave', (data: { meetingCode: string; participantId: string }) => {
      const code = data.meetingCode?.toLowerCase().trim();
      const { room, removed } = roomManager.removeParticipant(code, data.participantId);
      socket.leave(`room:${code}`);

      if (room && removed) {
        io?.to(`room:${code}`).emit('participant:left', {
          participantId: removed.id,
          displayName: removed.displayName,
        });
        io?.to(`room:${code}`).emit('room:participants', {
          participants: Array.from(room.participants.values()),
          count: room.participants.size,
        });

        // 60-second empty room countdown if participants count is 0
        if (room.participants.size === 0) {
          startRoomEmptyTimer(code);
        }
      }
    });

    // Disconnect Handler
    socket.on('disconnect', (reason) => {
      const { room, removed } = roomManager.removeParticipantBySocketId(socket.id);
      logger.info(
        { socketId: socket.id, reason, participantId: removed?.id, room: room?.meetingCode },
        'Socket disconnected'
      );

      if (room && removed) {
        io?.to(`room:${room.meetingCode}`).emit('participant:left', {
          participantId: removed.id,
          displayName: removed.displayName,
        });
        io?.to(`room:${room.meetingCode}`).emit('room:participants', {
          participants: Array.from(room.participants.values()),
          count: room.participants.size,
        });

        if (room.participants.size === 0) {
          startRoomEmptyTimer(room.meetingCode);
        }
      }
    });
  });

  return io;
};

function startRoomEmptyTimer(code: string) {
  roomManager.startEmptyTimer(code, async () => {
    logger.info({ meetingCode: code }, 'Empty room 60s timeout expired. Closing room.');
    try {
      const dbMeeting = await meetingRepository.findByCode(code);
      if (dbMeeting) {
        const now = nowIso();
        await meetingRepository.updateMeetingStatus(dbMeeting.id, 'ended', now);
        io?.to(`room:${code}`).emit('meeting:ended', {
          reason: 'Meeting ended after remaining empty for 60 seconds.',
          endedAt: now,
        });
      }
    } catch (err) {
      logger.error({ err, meetingCode: code }, 'Error terminating empty meeting');
    }
  });
}

export const getIO = (): SocketIOServer => {
  if (!io) {
    throw new Error('Socket.IO has not been initialized. Call initSocketServer first.');
  }
  return io;
};
