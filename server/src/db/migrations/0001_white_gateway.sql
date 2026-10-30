ALTER TABLE "meetings" ALTER COLUMN "max_participants" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "conversations" ALTER COLUMN "conversation_type" SET DEFAULT 'group';--> statement-breakpoint
ALTER TABLE "meetings" ADD COLUMN "host_token_hash" varchar(255);--> statement-breakpoint
ALTER TABLE "conversation_members" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "client_message_id" varchar(100);--> statement-breakpoint
CREATE UNIQUE INDEX "idx_unique_conv_participant" ON "conversation_members" USING btree ("conversation_id","participant_id");--> statement-breakpoint
CREATE INDEX "idx_conversations_type" ON "conversations" USING btree ("conversation_type");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_unique_message_reaction_part" ON "message_reactions" USING btree ("message_id","participant_id","emoji");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_unique_message_reader_part" ON "message_reads" USING btree ("message_id","reader_participant_id");--> statement-breakpoint
CREATE INDEX "idx_messages_client_msg_id" ON "messages" USING btree ("client_message_id");