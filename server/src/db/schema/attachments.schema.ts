import { pgTable, uuid, varchar, bigint, text, timestamp, index } from 'drizzle-orm/pg-core';
import { users } from './users.schema.js';
import { meetingParticipants } from './meetings.schema.js';

export const attachments = pgTable(
  'attachments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    uploaderUserId: uuid('uploader_user_id').references(() => users.id, { onDelete: 'set null' }),
    uploaderParticipantId: uuid('uploader_participant_id').references(() => meetingParticipants.id, {
      onDelete: 'set null',
    }),
    storageProvider: varchar('storage_provider', { length: 50 }).notNull(),
    storagePublicId: varchar('storage_public_id', { length: 255 }).notNull(),
    originalFileName: varchar('original_file_name', { length: 255 }).notNull(),
    mimeType: varchar('mime_type', { length: 100 }).notNull(),
    sizeBytes: bigint('size_bytes', { mode: 'number' }).notNull(),
    resourceUrl: text('resource_url').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull(),
  },
  (table) => [
    index('idx_attachments_uploader_user_id').on(table.uploaderUserId),
    index('idx_attachments_uploader_participant_id').on(table.uploaderParticipantId),
  ]
);

export type Attachment = typeof attachments.$inferSelect;
export type NewAttachment = typeof attachments.$inferInsert;

