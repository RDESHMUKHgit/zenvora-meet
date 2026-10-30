import { chatRepository } from '../repositories/chat.repository.js';
import { ephemeralChatManager } from './ephemeral-chat.manager.js';
import { meetingRepository } from '../repositories/meeting.repository.js';
import { roomManager } from './room.manager.js';
import { nowIso } from '../utils/time.js';
import { NotFoundError, BadRequestError, ForbiddenError } from '../utils/errors.js';

export interface ReactionSummary {
  emoji: string;
  count: number;
  hasReacted: boolean;
  participantIds: string[];
}

export interface UnifiedMessage {
  id: string;
  conversationId: string;
  senderParticipantId: string;
  senderDisplayName: string;
  senderName: string;
  content: string;
  messageType: 'text';
  clientMessageId?: string;
  createdAt: string;
  editedAt?: string | null;
  deletedAt?: string | null;
  reactions: ReactionSummary[];
  readByParticipantIds: string[];
}

export function aggregateReactions(
  reactions: { emoji: string; participantId: string }[] | undefined,
  viewerParticipantId: string
): ReactionSummary[] {
  const map = new Map<string, { count: number; participantIds: string[]; hasReacted: boolean }>();
  for (const r of reactions || []) {
    let entry = map.get(r.emoji);
    if (!entry) {
      entry = { count: 0, participantIds: [], hasReacted: false };
      map.set(r.emoji, entry);
    }
    entry.count += 1;
    entry.participantIds.push(r.participantId);
    if (r.participantId === viewerParticipantId) {
      entry.hasReacted = true;
    }
  }

  return Array.from(map.entries()).map(([emoji, val]) => ({
    emoji,
    count: val.count,
    hasReacted: val.hasReacted,
    participantIds: val.participantIds,
  }));
}

export function formatToUnifiedMessage(
  msg: {
    id: string;
    conversationId: string;
    senderParticipantId: string;
    senderName: string;
    content: string;
    messageType: 'text';
    clientMessageId?: string;
    createdAt: string;
    editedAt?: string | null;
    deletedAt?: string | null;
    reactions?: { emoji: string; participantId: string }[];
    reads?: { readerParticipantId: string }[];
  },
  viewerParticipantId: string
): UnifiedMessage {
  return {
    id: msg.id,
    conversationId: msg.conversationId,
    senderParticipantId: msg.senderParticipantId,
    senderDisplayName: msg.senderName,
    senderName: msg.senderName,
    content: msg.content,
    messageType: msg.messageType,
    clientMessageId: msg.clientMessageId,
    createdAt: msg.createdAt,
    editedAt: msg.editedAt,
    deletedAt: msg.deletedAt,
    reactions: aggregateReactions(msg.reactions, viewerParticipantId),
    readByParticipantIds: Array.from(
      new Set((msg.reads || []).map((rd) => rd.readerParticipantId))
    ),
  };
}

export interface UnifiedMember {
  participantId: string;
  displayName: string;
}

export interface UnifiedConversation {
  id: string;
  meetingCode: string;
  conversationType: 'group' | 'direct';
  members: UnifiedMember[];
  createdAt: string;
  lastMessage?: {
    content: string;
    createdAt: string;
    senderName: string;
  };
}

export class ChatService {
  // Sliding window rate limit: participantId -> array of timestamp ms
  private rateLimitMap = new Map<string, number[]>();

  private checkRateLimit(participantId: string): void {
    const now = Date.now();
    const windowMs = 5000;
    const maxMessages = 10;

    let timestamps = this.rateLimitMap.get(participantId) || [];
    timestamps = timestamps.filter((t) => now - t < windowMs);

    if (timestamps.length >= maxMessages) {
      throw new BadRequestError('Message rate limit exceeded. Please slow down.');
    }

    timestamps.push(now);
    this.rateLimitMap.set(participantId, timestamps);
  }

  private async getMeetingPolicy(meetingCode: string): Promise<{
    meetingId: string;
    isEphemeral: boolean;
  }> {
    const code = meetingCode.toLowerCase().trim();
    const inMemRoom = roomManager.getRoom(code);
    if (inMemRoom) {
      return {
        meetingId: inMemRoom.meetingId,
        isEphemeral: inMemRoom.isEphemeral,
      };
    }

    const dbMeeting = await meetingRepository.findByCode(code);
    if (!dbMeeting || dbMeeting.status === 'ended') {
      throw new NotFoundError(`Meeting '${meetingCode}' does not exist or has ended`);
    }

    return {
      meetingId: dbMeeting.id,
      isEphemeral: dbMeeting.isEphemeral,
    };
  }

  public async getConversations(
    meetingCode: string,
    participantId: string
  ): Promise<UnifiedConversation[]> {
    const { meetingId, isEphemeral } = await this.getMeetingPolicy(meetingCode);
    const code = meetingCode.toLowerCase().trim();

    if (isEphemeral) {
      const ephemConvs = ephemeralChatManager.getConversationsForParticipant(code, participantId);
      return ephemConvs.map((c) => {
        const msgs = ephemeralChatManager.getMessages(code, c.id);
        const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : undefined;
        return {
          id: c.id,
          meetingCode: code,
          conversationType: c.conversationType,
          members: c.members,
          createdAt: c.createdAt,
          lastMessage: lastMsg
            ? {
                content: lastMsg.content,
                createdAt: lastMsg.createdAt,
                senderName: lastMsg.senderName,
              }
            : undefined,
        };
      });
    }

    // Authenticated PostgreSQL meeting
    // Ensure group conversation exists
    await chatRepository.findOrCreateGroupConversation(meetingId, nowIso());

    const convs = await chatRepository.getConversationsForParticipant(meetingId, participantId);
    const result: UnifiedConversation[] = [];

    for (const c of convs) {
      const members = await chatRepository.getConversationMembers(c.id);
      const msgs = await chatRepository.getMessages(c.id, 1);
      const lastMsg = msgs.length > 0 ? msgs[msgs.length - 1] : undefined;

      result.push({
        id: c.id,
        meetingCode: code,
        conversationType: c.conversationType as 'group' | 'direct',
        members: members.map((m) => ({
          participantId: m.participantId || '',
          displayName: m.displayName || 'Participant',
        })),
        createdAt: c.createdAt,
        lastMessage: lastMsg
          ? {
              content: lastMsg.content,
              createdAt: lastMsg.createdAt,
              senderName: lastMsg.senderName || 'Participant',
            }
          : undefined,
      });
    }

    return result;
  }

  public async findOrCreateDirectConversation(
    meetingCode: string,
    senderParticipantId: string,
    targetParticipantId: string,
    senderUserId?: string | null
  ): Promise<UnifiedConversation> {
    if (senderParticipantId === targetParticipantId) {
      throw new BadRequestError('Cannot start a direct conversation with yourself');
    }

    const { meetingId, isEphemeral } = await this.getMeetingPolicy(meetingCode);
    const code = meetingCode.toLowerCase().trim();

    // Verify both participants belong to the meeting in RoomManager or DB
    const room = roomManager.getRoom(code);
    const p1 = room?.participants.get(senderParticipantId);
    const p2 = room?.participants.get(targetParticipantId);

    let p1Name = p1?.displayName;
    let p2Name = p2?.displayName;

    if (!p1Name || !p2Name) {
      const dbParticipants = await meetingRepository.getParticipants(meetingId);
      const dbP1 = dbParticipants.find((p) => p.id === senderParticipantId);
      const dbP2 = dbParticipants.find((p) => p.id === targetParticipantId);
      if (!p1Name && dbP1) p1Name = dbP1.displayName;
      if (!p2Name && dbP2) p2Name = dbP2.displayName;
    }

    if (!p1Name || !p2Name) {
      throw new ForbiddenError('One or both participants are not active members of this meeting');
    }

    if (isEphemeral) {
      const ephem = ephemeralChatManager.findOrCreateDirectConversation(
        code,
        senderParticipantId,
        targetParticipantId,
        p1Name,
        p2Name,
        nowIso()
      );
      return {
        id: ephem.id,
        meetingCode: code,
        conversationType: 'direct',
        members: ephem.members,
        createdAt: ephem.createdAt,
      };
    }

    // Persistent PostgreSQL
    const conv = await chatRepository.findOrCreateDirectConversation(
      meetingId,
      senderParticipantId,
      targetParticipantId,
      senderUserId || null,
      p2?.userId || null,
      nowIso()
    );

    const members = await chatRepository.getConversationMembers(conv.id);

    return {
      id: conv.id,
      meetingCode: code,
      conversationType: 'direct',
      members: members.map((m) => ({
        participantId: m.participantId || '',
        displayName: m.displayName || 'Participant',
      })),
      createdAt: conv.createdAt,
    };
  }

  public async getMessages(
    meetingCode: string,
    conversationId: string,
    participantId: string
  ): Promise<UnifiedMessage[]> {
    const { isEphemeral } = await this.getMeetingPolicy(meetingCode);
    const code = meetingCode.toLowerCase().trim();

    if (isEphemeral) {
      const isAllowed = ephemeralChatManager.isParticipantInConversation(
        code,
        conversationId,
        participantId
      );
      if (!isAllowed) {
        throw new ForbiddenError('You are not authorized to access this conversation');
      }
      const msgs = ephemeralChatManager.getMessages(code, conversationId);
      return msgs.map((m) => formatToUnifiedMessage(m, participantId));
    }

    // PostgreSQL
    const conv = await chatRepository.getConversationById(conversationId);
    if (!conv) {
      throw new NotFoundError('Conversation not found');
    }

    const isAllowed = await chatRepository.isParticipantInConversation(conv, participantId);
    if (!isAllowed) {
      throw new ForbiddenError('You are not authorized to access this conversation');
    }

    const msgs = await chatRepository.getMessages(conversationId);
    return msgs.map((m) =>
      formatToUnifiedMessage(
        {
          id: m.id,
          conversationId: m.conversationId,
          senderParticipantId: m.senderParticipantId || '',
          senderName: m.senderName || 'Participant',
          content: m.content,
          messageType: 'text',
          clientMessageId: m.clientMessageId || undefined,
          createdAt: m.createdAt,
          editedAt: m.editedAt,
          deletedAt: m.deletedAt,
          reactions: (m.reactions || []).map((r) => ({
            emoji: r.emoji,
            participantId: r.participantId || '',
          })),
          reads: (m.reads || []).map((rd) => ({
            readerParticipantId: rd.readerParticipantId || '',
          })),
        },
        participantId
      )
    );
  }

  public async sendMessage(
    meetingCode: string,
    conversationId: string,
    senderParticipantId: string,
    senderName: string,
    senderUserId: string | null,
    content: string,
    clientMessageId?: string
  ): Promise<UnifiedMessage> {
    const trimmed = content?.trim();
    if (!trimmed) {
      throw new BadRequestError('Message content cannot be empty');
    }
    if (trimmed.length > 5000) {
      throw new BadRequestError('Message exceeds maximum limit of 5,000 characters');
    }

    this.checkRateLimit(senderParticipantId);

    const { isEphemeral } = await this.getMeetingPolicy(meetingCode);
    const code = meetingCode.toLowerCase().trim();
    const createdAt = nowIso();

    if (isEphemeral) {
      // Check idempotency
      if (clientMessageId) {
        const existing = ephemeralChatManager.getMessageByClientMessageId(
          code,
          conversationId,
          clientMessageId
        );
        if (existing) return formatToUnifiedMessage(existing, senderParticipantId);
      }

      // Ensure conversation exists
      if (conversationId.startsWith('group-')) {
        ephemeralChatManager.findOrCreateGroupConversation(code, createdAt);
      }

      const isAllowed = ephemeralChatManager.isParticipantInConversation(
        code,
        conversationId,
        senderParticipantId
      );
      if (!isAllowed) {
        throw new ForbiddenError('Unauthorized: You are not a member of this conversation');
      }

      const msg = ephemeralChatManager.createMessage(code, conversationId, {
        id: `ephem-msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        conversationId,
        senderParticipantId,
        senderName,
        content: trimmed,
        messageType: 'text',
        clientMessageId,
        createdAt,
        editedAt: null,
        deletedAt: null,
      });

      return formatToUnifiedMessage(msg, senderParticipantId);
    }

    // PostgreSQL Persistent Meeting
    const conv = await chatRepository.getConversationById(conversationId);
    if (!conv) {
      throw new NotFoundError('Conversation not found');
    }

    const isAllowed = await chatRepository.isParticipantInConversation(conv, senderParticipantId);
    if (!isAllowed) {
      throw new ForbiddenError('Unauthorized: You are not a member of this conversation');
    }

    // Check idempotency
    if (clientMessageId) {
      const existing = await chatRepository.getMessageByClientMessageId(
        conversationId,
        clientMessageId
      );
      if (existing) {
        return formatToUnifiedMessage(
          {
            id: existing.id,
            conversationId: existing.conversationId,
            senderParticipantId: existing.senderParticipantId || '',
            senderName,
            content: existing.content,
            messageType: 'text',
            clientMessageId: existing.clientMessageId || undefined,
            createdAt: existing.createdAt,
            editedAt: existing.editedAt,
            deletedAt: existing.deletedAt,
            reactions: [],
            reads: [],
          },
          senderParticipantId
        );
      }
    }

    const saved = await chatRepository.createMessage({
      conversationId,
      senderUserId,
      senderParticipantId,
      content: trimmed,
      messageType: 'text',
      clientMessageId: clientMessageId || null,
      createdAt,
    });

    return formatToUnifiedMessage(
      {
        id: saved.id,
        conversationId: saved.conversationId,
        senderParticipantId: saved.senderParticipantId || '',
        senderName,
        content: saved.content,
        messageType: 'text',
        clientMessageId: saved.clientMessageId || undefined,
        createdAt: saved.createdAt,
        editedAt: saved.editedAt,
        deletedAt: saved.deletedAt,
        reactions: [],
        reads: [],
      },
      senderParticipantId
    );
  }

  public async editMessage(
    meetingCode: string,
    conversationId: string,
    messageId: string,
    participantId: string,
    content: string
  ): Promise<UnifiedMessage> {
    const trimmed = content?.trim();
    if (!trimmed) {
      throw new BadRequestError('Edited content cannot be empty');
    }

    const { isEphemeral } = await this.getMeetingPolicy(meetingCode);
    const code = meetingCode.toLowerCase().trim();
    const editedAt = nowIso();

    if (isEphemeral) {
      const updated = ephemeralChatManager.editMessage(
        code,
        conversationId,
        messageId,
        participantId,
        trimmed,
        editedAt
      );
      if (!updated) {
        throw new NotFoundError('Message not found or you are not authorized to edit it');
      }
      return formatToUnifiedMessage(updated, participantId);
    }

    const updated = await chatRepository.editMessage(messageId, participantId, trimmed, editedAt);
    if (!updated) {
      throw new NotFoundError('Message not found or you are not authorized to edit it');
    }

    const full = await chatRepository.getMessages(conversationId);
    const found = full.find((m) => m.id === messageId);
    if (!found) throw new NotFoundError('Message not found');

    return formatToUnifiedMessage(
      {
        id: found.id,
        conversationId: found.conversationId,
        senderParticipantId: found.senderParticipantId || '',
        senderName: found.senderName || 'Participant',
        content: found.content,
        messageType: 'text',
        clientMessageId: found.clientMessageId || undefined,
        createdAt: found.createdAt,
        editedAt: found.editedAt,
        deletedAt: found.deletedAt,
        reactions: (found.reactions || []).map((r) => ({
          emoji: r.emoji,
          participantId: r.participantId || '',
        })),
        reads: (found.reads || []).map((rd) => ({
          readerParticipantId: rd.readerParticipantId || '',
        })),
      },
      participantId
    );
  }

  public async deleteMessage(
    meetingCode: string,
    conversationId: string,
    messageId: string,
    participantId: string
  ): Promise<UnifiedMessage> {
    const { isEphemeral } = await this.getMeetingPolicy(meetingCode);
    const code = meetingCode.toLowerCase().trim();
    const deletedAt = nowIso();

    if (isEphemeral) {
      const updated = ephemeralChatManager.deleteMessage(
        code,
        conversationId,
        messageId,
        participantId,
        deletedAt
      );
      if (!updated) {
        throw new NotFoundError('Message not found or you are not authorized to delete it');
      }
      return formatToUnifiedMessage(updated, participantId);
    }

    const updated = await chatRepository.deleteMessage(messageId, participantId, deletedAt);
    if (!updated) {
      throw new NotFoundError('Message not found or you are not authorized to delete it');
    }

    const full = await chatRepository.getMessages(conversationId);
    const found = full.find((m) => m.id === messageId);
    if (!found) throw new NotFoundError('Message not found');

    return formatToUnifiedMessage(
      {
        id: found.id,
        conversationId: found.conversationId,
        senderParticipantId: found.senderParticipantId || '',
        senderName: found.senderName || 'Participant',
        content: found.content,
        messageType: 'text',
        clientMessageId: found.clientMessageId || undefined,
        createdAt: found.createdAt,
        editedAt: found.editedAt,
        deletedAt: found.deletedAt,
        reactions: (found.reactions || []).map((r) => ({
          emoji: r.emoji,
          participantId: r.participantId || '',
        })),
        reads: (found.reads || []).map((rd) => ({
          readerParticipantId: rd.readerParticipantId || '',
        })),
      },
      participantId
    );
  }

  public async toggleReaction(
    meetingCode: string,
    conversationId: string,
    messageId: string,
    participantId: string,
    userId: string | null,
    emoji: string
  ): Promise<{ action: 'added' | 'removed'; emoji: string; participantId: string; messageId: string }> {
    const cleanEmoji = emoji?.trim();
    if (!cleanEmoji) {
      throw new BadRequestError('Emoji cannot be empty');
    }

    const { isEphemeral } = await this.getMeetingPolicy(meetingCode);
    const code = meetingCode.toLowerCase().trim();
    const createdAt = nowIso();

    if (isEphemeral) {
      const res = ephemeralChatManager.toggleReaction(
        code,
        conversationId,
        messageId,
        participantId,
        cleanEmoji,
        createdAt
      );
      return {
        action: res.action,
        emoji: cleanEmoji,
        participantId,
        messageId,
      };
    }

    const res = await chatRepository.toggleReaction(
      messageId,
      participantId,
      userId,
      cleanEmoji,
      createdAt
    );

    return {
      action: res.action,
      emoji: cleanEmoji,
      participantId,
      messageId,
    };
  }

  public async markAsRead(
    meetingCode: string,
    conversationId: string,
    messageIds: string[],
    readerParticipantId: string,
    readerUserId: string | null
  ): Promise<void> {
    if (!messageIds || messageIds.length === 0) return;

    const { isEphemeral } = await this.getMeetingPolicy(meetingCode);
    const code = meetingCode.toLowerCase().trim();
    const readAt = nowIso();

    if (isEphemeral) {
      ephemeralChatManager.markAsRead(code, conversationId, messageIds, readerParticipantId, readAt);
      return;
    }

    await chatRepository.markAsRead(messageIds, readerParticipantId, readerUserId, readAt);
  }
}

export const chatService = new ChatService();
