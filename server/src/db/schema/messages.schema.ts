import { pgTable, uuid, varchar, text, timestamp, index } from 'drizzle-orm/pg-core';
import { conversations } from './conversations.schema.js';
import { users } from './users.schema.js';
import { meetingParticipants } from './meetings.schema.js';
import { attachments } from './attachments.schema.js';

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    senderUserId: uuid('sender_user_id').references(() => users.id, { onDelete: 'set null' }),
    senderParticipantId: uuid('sender_participant_id').references(() => meetingParticipants.id, {
      onDelete: 'set null',
    }),
    messageType: varchar('message_type', { length: 50 }).notNull().default('text'),
    content: text('content').notNull(),
    attachmentId: uuid('attachment_id').references(() => attachments.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull(),
    editedAt: timestamp('edited_at', { withTimezone: true, mode: 'string' }),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    index('idx_messages_conversation_created').on(table.conversationId, table.createdAt),
    index('idx_messages_sender_user_id').on(table.senderUserId),
  ]
);

export const messageReads = pgTable(
  'message_reads',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    messageId: uuid('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    readerUserId: uuid('reader_user_id').references(() => users.id, { onDelete: 'cascade' }),
    readerParticipantId: uuid('reader_participant_id').references(() => meetingParticipants.id, {
      onDelete: 'cascade',
    }),
    readAt: timestamp('read_at', { withTimezone: true, mode: 'string' }).notNull(),
  },
  (table) => [
    index('idx_message_reads_message_id').on(table.messageId),
    index('idx_message_reads_reader_user_id').on(table.readerUserId),
  ]
);

export const messageReactions = pgTable(
  'message_reactions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    messageId: uuid('message_id')
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    participantId: uuid('participant_id').references(() => meetingParticipants.id, {
      onDelete: 'cascade',
    }),
    emoji: varchar('emoji', { length: 32 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull(),
  },
  (table) => [
    index('idx_message_reactions_message_id').on(table.messageId),
    index('idx_message_reactions_user_id').on(table.userId),
  ]
);

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type MessageRead = typeof messageReads.$inferSelect;
export type NewMessageRead = typeof messageReads.$inferInsert;
export type MessageReaction = typeof messageReactions.$inferSelect;
export type NewMessageReaction = typeof messageReactions.$inferInsert;

