import crypto from 'crypto';
import { meetingRepository, MeetingRepository } from '../repositories/meeting.repository.js';
import { nowIso, futureIso } from '../utils/time.js';
import { NotFoundError } from '../utils/errors.js';
import type { CreateMeetingInput } from '../validators/meeting.validator.js';
import type { Meeting } from '../db/schema/meetings.schema.js';

export class MeetingService {
  constructor(private readonly meetingRepo: MeetingRepository = meetingRepository) {}

  private generateCode(): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz';
    const randPart = () => {
      let str = '';
      const bytes = crypto.randomBytes(3);
      for (let i = 0; i < 3; i++) {
        str += chars[bytes[i] % chars.length];
      }
      return str;
    };
    return `rdm-${randPart()}-${randPart()}`;
  }

  async createMeeting(
    hostUserId: string | null,
    input: CreateMeetingInput
  ): Promise<Meeting> {
    let meetingCode = this.generateCode();

    // Check for collision
    let existing = await this.meetingRepo.findByCode(meetingCode);
    while (existing) {
      meetingCode = this.generateCode();
      existing = await this.meetingRepo.findByCode(meetingCode);
    }

    const now = nowIso();
    const expiresAt = input.isEphemeral ? futureIso({ hours: 24 }) : null;

    return this.meetingRepo.createMeeting({
      meetingCode,
      hostUserId: hostUserId || null,
      title: input.title,
      maxParticipants: input.maxParticipants ?? 50,
      isEphemeral: input.isEphemeral ?? false,
      status: 'active',
      createdAt: now,
      startedAt: now,
      expiresAt,
    });
  }

  async getMeetingByCode(code: string): Promise<Meeting> {
    const meeting = await this.meetingRepo.findByCode(code);
    if (!meeting) {
      throw new NotFoundError(`Meeting room '${code}' does not exist or has expired`);
    }
    return meeting;
  }

  async getUserHistory(userId: string): Promise<Meeting[]> {
    return this.meetingRepo.getMeetingsByUserId(userId);
  }

  async joinMeeting(code: string, userId: string | null, displayName: string) {
    const meeting = await this.getMeetingByCode(code);
    const now = nowIso();

    const participant = await this.meetingRepo.addParticipant({
      meetingId: meeting.id,
      userId: userId || null,
      displayName,
      role: meeting.hostUserId && meeting.hostUserId === userId ? 'host' : 'participant',
      joinedAt: now,
    });

    return { meeting, participant };
  }
}

export const meetingService = new MeetingService();
