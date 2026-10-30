import { eq, and, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  conversations,
  conversationMembers,
  type Conversation,
  type ConversationMember,
} from '../db/schema/conversations.schema.js';
import {
  messages,
  messageReads,
  messageReactions,
  type Message,
  type NewMessage,
  type MessageRead,
  type MessageReaction,
} from '../db/schema/messages.schema.js';
import { meetingParticipants } from '../db/schema/meetings.schema.js';

export interface EnrichedMessage extends Message {
  senderName?: string;
  reactions?: MessageReaction[];
  reads?: MessageRead[];
}

export class ChatRepository {
  async findOrCreateGroupConversation(meetingId: string, createdAt: string): Promise<Conversation> {
    const [existing] = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.meetingId, meetingId), eq(conversations.conversationType, 'group')))
      .limit(1);

    if (existing) {
      return existing;
    }

    const [created] = await db
      .insert(conversations)
      .values({
        meetingId,
        conversationType: 'group',
        createdAt,
      })
      .returning();

    return created;
  }

  async findOrCreateDirectConversation(
    meetingId: string,
    participant1Id: string,
    participant2Id: string,
    user1Id: string | null,
    user2Id: string | null,
    createdAt: string
  ): Promise<Conversation> {
    // Look for existing direct conversation between participant1 and participant2 in this meeting
    const candidateConvs = await db
      .select({ id: conversations.id })
      .from(conversations)
      .where(and(eq(conversations.meetingId, meetingId), eq(conversations.conversationType, 'direct')));

    for (const c of candidateConvs) {
      const members = await db
        .select()
        .from(conversationMembers)
        .where(eq(conversationMembers.conversationId, c.id));

      const memberPartIds = members.map((m) => m.participantId);
      if (
        memberPartIds.length === 2 &&
        memberPartIds.includes(participant1Id) &&
        memberPartIds.includes(participant2Id)
      ) {
        const [found] = await db.select().from(conversations).where(eq(conversations.id, c.id)).limit(1);
        if (found) return found;
      }
    }

    // Create atomically within transaction
    return await db.transaction(async (tx) => {
      const [newConv] = await tx
        .insert(conversations)
        .values({
          meetingId,
          conversationType: 'direct',
          createdAt,
        })
        .returning();

      await tx.insert(conversationMembers).values([
        {
          conversationId: newConv.id,
          participantId: participant1Id,
          userId: user1Id,
          createdAt,
        },
        {
          conversationId: newConv.id,
          participantId: participant2Id,
          userId: user2Id,
          createdAt,
        },
      ]);

      return newConv;
    });
  }

  async getConversationsForParticipant(meetingId: string, participantId: string): Promise<Conversation[]> {
    // Group conversation is always available to participants of the meeting
    const groupConv = await db
      .select()
      .from(conversations)
      .where(and(eq(conversations.meetingId, meetingId), eq(conversations.conversationType, 'group')));

    // Direct conversations where participant is a member
    const directMemberships = await db
      .select({ conversationId: conversationMembers.conversationId })
      .from(conversationMembers)
      .where(eq(conversationMembers.participantId, participantId));

    const directConvIds = directMemberships.map((m) => m.conversationId);

    let directConvs: Conversation[] = [];
    if (directConvIds.length > 0) {
      directConvs = await db
        .select()
        .from(conversations)
        .where(and(eq(conversations.meetingId, meetingId), inArray(conversations.id, directConvIds)));
    }

    return [...groupConv, ...directConvs];
  }

  async getConversationById(conversationId: string): Promise<Conversation | undefined> {
    const [conv] = await db
      .select()
      .from(conversations)
      .where(eq(conversations.id, conversationId))
      .limit(1);
    return conv;
  }

  async getConversationMembers(conversationId: string): Promise<
    (ConversationMember & { displayName?: string | null })[]
  > {
    const members = await db
      .select({
        id: conversationMembers.id,
        conversationId: conversationMembers.conversationId,
        userId: conversationMembers.userId,
        participantId: conversationMembers.participantId,
        createdAt: conversationMembers.createdAt,
        displayName: meetingParticipants.displayName,
      })
      .from(conversationMembers)
      .leftJoin(meetingParticipants, eq(conversationMembers.participantId, meetingParticipants.id))
      .where(eq(conversationMembers.conversationId, conversationId));

    return members;
  }

  async isParticipantInConversation(
    conversation: Conversation,
    participantId: string
  ): Promise<boolean> {
    if (conversation.conversationType === 'group') {
      // Group conversation belongs to all participants in this meeting
      const [participant] = await db
        .select({ id: meetingParticipants.id })
        .from(meetingParticipants)
        .where(
          and(
            eq(meetingParticipants.id, participantId),
            eq(meetingParticipants.meetingId, conversation.meetingId)
          )
        )
        .limit(1);
      return Boolean(participant);
    }

    const [member] = await db
      .select({ id: conversationMembers.id })
      .from(conversationMembers)
      .where(
        and(
          eq(conversationMembers.conversationId, conversation.id),
          eq(conversationMembers.participantId, participantId)
        )
      )
      .limit(1);

    return Boolean(member);
  }

  async createMessage(data: NewMessage): Promise<Message> {
    const [msg] = await db.insert(messages).values(data).returning();
    return msg;
  }

  async getMessageByClientMessageId(
    conversationId: string,
    clientMessageId: string
  ): Promise<Message | undefined> {
    const [msg] = await db
      .select()
      .from(messages)
      .where(
        and(
          eq(messages.conversationId, conversationId),
          eq(messages.clientMessageId, clientMessageId)
        )
      )
      .limit(1);
    return msg;
  }

  async getMessageById(messageId: string): Promise<Message | undefined> {
    const [msg] = await db.select().from(messages).where(eq(messages.id, messageId)).limit(1);
    return msg;
  }

  async getMessages(conversationId: string, limit: number = 100): Promise<EnrichedMessage[]> {
    const rawMessages = await db
      .select({
        id: messages.id,
        conversationId: messages.conversationId,
        senderUserId: messages.senderUserId,
        senderParticipantId: messages.senderParticipantId,
        messageType: messages.messageType,
        content: messages.content,
        attachmentId: messages.attachmentId,
        clientMessageId: messages.clientMessageId,
        createdAt: messages.createdAt,
        editedAt: messages.editedAt,
        deletedAt: messages.deletedAt,
        senderName: meetingParticipants.displayName,
      })
      .from(messages)
      .leftJoin(meetingParticipants, eq(messages.senderParticipantId, meetingParticipants.id))
      .where(eq(messages.conversationId, conversationId))
      .orderBy(messages.createdAt)
      .limit(limit);

    if (rawMessages.length === 0) return [];

    const msgIds = rawMessages.map((m) => m.id);

    // Fetch reactions
    const allReactions = await db
      .select()
      .from(messageReactions)
      .where(inArray(messageReactions.messageId, msgIds));

    // Fetch reads
    const allReads = await db
      .select()
      .from(messageReads)
      .where(inArray(messageReads.messageId, msgIds));

    const reactionsMap = new Map<string, MessageReaction[]>();
    for (const r of allReactions) {
      const list = reactionsMap.get(r.messageId) || [];
      list.push(r);
      reactionsMap.set(r.messageId, list);
    }

    const readsMap = new Map<string, MessageRead[]>();
    for (const r of allReads) {
      const list = readsMap.get(r.messageId) || [];
      list.push(r);
      readsMap.set(r.messageId, list);
    }

    return rawMessages.map((m) => ({
      ...m,
      senderName: m.senderName || 'Participant',
      reactions: reactionsMap.get(m.id) || [],
      reads: readsMap.get(m.id) || [],
    }));
  }

  async editMessage(
    messageId: string,
    senderParticipantId: string,
    content: string,
    editedAt: string
  ): Promise<Message | undefined> {
    const [updated] = await db
      .update(messages)
      .set({ content, editedAt })
      .where(
        and(eq(messages.id, messageId), eq(messages.senderParticipantId, senderParticipantId))
      )
      .returning();
    return updated;
  }

  async deleteMessage(
    messageId: string,
    senderParticipantId: string,
    deletedAt: string
  ): Promise<Message | undefined> {
    const [updated] = await db
      .update(messages)
      .set({
        content: 'This message was deleted.',
        deletedAt,
      })
      .where(
        and(eq(messages.id, messageId), eq(messages.senderParticipantId, senderParticipantId))
      )
      .returning();
    return updated;
  }

  async toggleReaction(
    messageId: string,
    participantId: string,
    userId: string | null,
    emoji: string,
    createdAt: string
  ): Promise<{ action: 'added' | 'removed'; reaction?: MessageReaction }> {
    // Check if participant already reacted with this emoji
    const [existing] = await db
      .select()
      .from(messageReactions)
      .where(
        and(
          eq(messageReactions.messageId, messageId),
          eq(messageReactions.participantId, participantId),
          eq(messageReactions.emoji, emoji)
        )
      )
      .limit(1);

    if (existing) {
      await db.delete(messageReactions).where(eq(messageReactions.id, existing.id));
      return { action: 'removed' };
    }

    const [created] = await db
      .insert(messageReactions)
      .values({
        messageId,
        participantId,
        userId,
        emoji,
        createdAt,
      })
      .returning();

    return { action: 'added', reaction: created };
  }

  async markAsRead(
    messageIds: string[],
    readerParticipantId: string,
    readerUserId: string | null,
    readAt: string
  ): Promise<void> {
    if (messageIds.length === 0) return;

    for (const msgId of messageIds) {
      await db
        .insert(messageReads)
        .values({
          messageId: msgId,
          readerParticipantId,
          readerUserId,
          readAt,
        })
        .onConflictDoNothing();
    }
  }
}

export const chatRepository = new ChatRepository();
