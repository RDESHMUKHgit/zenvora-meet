import { pgTable, uuid, varchar, timestamp, index } from 'drizzle-orm/pg-core';
import { meetings, meetingParticipants } from './meetings.schema.js';
import { users } from './users.schema.js';

export const conversations = pgTable(
  'conversations',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    meetingId: uuid('meeting_id')
      .notNull()
      .references(() => meetings.id, { onDelete: 'cascade' }),
    conversationType: varchar('conversation_type', { length: 50 }).notNull().default('meeting_main'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull(),
  },
  (table) => [index('idx_conversations_meeting_id').on(table.meetingId)]
);

export const conversationMembers = pgTable(
  'conversation_members',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    conversationId: uuid('conversation_id')
      .notNull()
      .references(() => conversations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    participantId: uuid('participant_id').references(() => meetingParticipants.id, {
      onDelete: 'cascade',
    }),
  },
  (table) => [
    index('idx_conversation_members_conv_id').on(table.conversationId),
    index('idx_conversation_members_user_id').on(table.userId),
    index('idx_conversation_members_part_id').on(table.participantId),
  ]
);

export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type ConversationMember = typeof conversationMembers.$inferSelect;
export type NewConversationMember = typeof conversationMembers.$inferInsert;

