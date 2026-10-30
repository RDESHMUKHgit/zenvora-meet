import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { roomManager } from '../services/room.manager.js';
import { meetingRepository } from '../repositories/meeting.repository.js';
import { nowIso } from '../utils/time.js';

let io: SocketIOServer | null = null;

export const initSocketServer = (httpServer: HttpServer): SocketIOServer => {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: env.CORS_ORIGIN,
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
