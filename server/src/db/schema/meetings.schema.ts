import { pgTable, uuid, varchar, integer, boolean, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users.schema.js';

export const meetings = pgTable(
  'meetings',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    meetingCode: varchar('meeting_code', { length: 50 }).notNull().unique(),
    hostUserId: uuid('host_user_id').references(() => users.id, { onDelete: 'set null' }),
    hostTokenHash: varchar('host_token_hash', { length: 255 }),
    title: varchar('title', { length: 255 }).notNull(),
    maxParticipants: integer('max_participants').notNull().default(0),
    isEphemeral: boolean('is_ephemeral').notNull().default(false),
    status: varchar('status', { length: 50 }).notNull().default('scheduled'),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull(),
    startedAt: timestamp('started_at', { withTimezone: true, mode: 'string' }),
    endedAt: timestamp('ended_at', { withTimezone: true, mode: 'string' }),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    index('idx_meetings_code').on(table.meetingCode),
    index('idx_meetings_host_user_id').on(table.hostUserId),
    index('idx_meetings_status').on(table.status),
  ]
);

export const meetingParticipants = pgTable(
  'meeting_participants',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    meetingId: uuid('meeting_id')
      .notNull()
      .references(() => meetings.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    displayName: varchar('display_name', { length: 100 }).notNull(),
    role: varchar('role', { length: 50 }).notNull().default('participant'),
    joinedAt: timestamp('joined_at', { withTimezone: true, mode: 'string' }).notNull(),
    leftAt: timestamp('left_at', { withTimezone: true, mode: 'string' }),
  },
  (table) => [
    index('idx_meeting_participants_meeting_id').on(table.meetingId),
    index('idx_meeting_participants_user_id').on(table.userId),
  ]
);

export type Meeting = typeof meetings.$inferSelect;
export type NewMeeting = typeof meetings.$inferInsert;
export type MeetingParticipant = typeof meetingParticipants.$inferSelect;
export type NewMeetingParticipant = typeof meetingParticipants.$inferInsert;

