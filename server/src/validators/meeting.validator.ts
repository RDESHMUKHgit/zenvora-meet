import { z } from 'zod';

export const createMeetingSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Meeting title is required')
    .max(255, 'Title must not exceed 255 characters'),
  maxParticipants: z.number().int().min(2).max(250).default(50),
  isEphemeral: z.boolean().default(false),
});

export const joinMeetingSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, 'Display name must be at least 2 characters')
    .max(100, 'Display name must not exceed 100 characters'),
});

export type CreateMeetingInput = z.infer<typeof createMeetingSchema>;
export type JoinMeetingInput = z.infer<typeof joinMeetingSchema>;
