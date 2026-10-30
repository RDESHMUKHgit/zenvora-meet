import { eq, desc, or, inArray, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  meetings,
  meetingParticipants,
  type Meeting,
  type NewMeeting,
  type MeetingParticipant,
} from '../db/schema/meetings.schema.js';

export class MeetingRepository {
  async createMeeting(data: NewMeeting): Promise<Meeting> {
    const [meeting] = await db.insert(meetings).values(data).returning();
    return meeting;
  }

  async findByCode(code: string): Promise<Meeting | undefined> {
    const [meeting] = await db
      .select()
      .from(meetings)
      .where(eq(meetings.meetingCode, code.toLowerCase().trim()))
      .limit(1);
    return meeting;
  }

  async findById(id: string): Promise<Meeting | undefined> {
    const [meeting] = await db.select().from(meetings).where(eq(meetings.id, id)).limit(1);
    return meeting;
  }

  async updateMeetingStatus(
    id: string,
    status: string,
    endedAt?: string | null
  ): Promise<Meeting | undefined> {
    const [updated] = await db
      .update(meetings)
      .set({
        status,
        ...(endedAt !== undefined ? { endedAt } : {}),
      })
      .where(eq(meetings.id, id))
      .returning();
    return updated;
  }

  async getMeetingsByUserId(userId: string): Promise<Meeting[]> {
    const participantRows = await db
      .select({ meetingId: meetingParticipants.meetingId })
      .from(meetingParticipants)
      .where(eq(meetingParticipants.userId, userId));

    const pIds = participantRows.map((r) => r.meetingId);

    if (pIds.length > 0) {
      return db
        .select()
        .from(meetings)
        .where(
          and(
            or(eq(meetings.hostUserId, userId), inArray(meetings.id, pIds)),
            // Only retain permitted meeting history (non-ephemeral or active/recent)
            eq(meetings.isEphemeral, false)
          )
        )
        .orderBy(desc(meetings.createdAt));
    }

    return db
      .select()
      .from(meetings)
      .where(and(eq(meetings.hostUserId, userId), eq(meetings.isEphemeral, false)))
      .orderBy(desc(meetings.createdAt));
  }

  async addParticipant(data: {
    meetingId: string;
    userId?: string | null;
    displayName: string;
    role: string;
    joinedAt: string;
  }): Promise<MeetingParticipant> {
    const [participant] = await db.insert(meetingParticipants).values(data).returning();
    return participant;
  }

  async markParticipantLeft(participantId: string, leftAt: string): Promise<void> {
    await db
      .update(meetingParticipants)
      .set({ leftAt })
      .where(eq(meetingParticipants.id, participantId));
  }

  async getParticipants(meetingId: string): Promise<MeetingParticipant[]> {
    return db
      .select()
      .from(meetingParticipants)
      .where(eq(meetingParticipants.meetingId, meetingId));
  }

  async reconcileActiveMeetings(endedAt: string): Promise<number> {
    const result = await db
      .update(meetings)
      .set({ status: 'ended', endedAt })
      .where(eq(meetings.status, 'active'))
      .returning();
    return result.length;
  }
}

export const meetingRepository = new MeetingRepository();
