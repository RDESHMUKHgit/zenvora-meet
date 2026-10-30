import { z } from 'zod';

export const createMeetingSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Meeting title is required')
    .max(255, 'Title must not exceed 255 characters'),
  displayName: z
    .string()
    .trim()
    .min(2, 'Display name must be at least 2 characters')
    .max(100, 'Display name must not exceed 100 characters')
    .optional(),
  maxParticipants: z
    .union([
      z.literal(1),
      z.literal(2),
      z.literal(4),
      z.literal(8),
      z.literal(0), // 0 denotes Unlimited
      z.null(),
    ])
    .default(0)
    .transform((val) => (val === null ? 0 : val)),
  isEphemeral: z.boolean().default(false),
});

export const joinMeetingSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, 'Display name must be at least 2 characters')
    .max(100, 'Display name must not exceed 100 characters'),
});

export const leaveMeetingSchema = z.object({
  participantId: z.string().uuid('Invalid participant ID').optional(),
});

export const endMeetingSchema = z.object({
  hostToken: z.string().nullish(),
});

export type CreateMeetingInput = z.infer<typeof createMeetingSchema>;
export type JoinMeetingInput = z.infer<typeof joinMeetingSchema>;
export type LeaveMeetingInput = z.infer<typeof leaveMeetingSchema>;
export type EndMeetingInput = z.infer<typeof endMeetingSchema>;
