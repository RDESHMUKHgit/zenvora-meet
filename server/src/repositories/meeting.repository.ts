import { eq, desc, or, inArray } from 'drizzle-orm';
import { db } from '../db/index.js';
import { meetings, meetingParticipants, type Meeting, type NewMeeting } from '../db/schema/meetings.schema.js';

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
        .where(or(eq(meetings.hostUserId, userId), inArray(meetings.id, pIds)))
        .orderBy(desc(meetings.createdAt));
    }

    return db
      .select()
      .from(meetings)
      .where(eq(meetings.hostUserId, userId))
      .orderBy(desc(meetings.createdAt));
  }

  async addParticipant(data: {
    meetingId: string;
    userId?: string | null;
    displayName: string;
    role: string;
    joinedAt: string;
  }) {
    const [participant] = await db.insert(meetingParticipants).values(data).returning();
    return participant;
  }

  async getParticipants(meetingId: string) {
    return db
      .select()
      .from(meetingParticipants)
      .where(eq(meetingParticipants.meetingId, meetingId));
  }
}

export const meetingRepository = new MeetingRepository();
