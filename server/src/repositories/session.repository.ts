import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { authSessions, type AuthSession, type NewAuthSession } from '../db/schema/sessions.schema.js';
import { users, type User } from '../db/schema/users.schema.js';

export class SessionRepository {
  async createSession(data: NewAuthSession): Promise<AuthSession> {
    const [session] = await db.insert(authSessions).values(data).returning();
    return session;
  }

  async findByTokenHash(tokenHash: string): Promise<AuthSession | undefined> {
    const [session] = await db
      .select()
      .from(authSessions)
      .where(eq(authSessions.tokenHash, tokenHash))
      .limit(1);
    return session;
  }

  async findSessionWithUser(
    tokenHash: string
  ): Promise<{ session: AuthSession; user: User } | undefined> {
    const rows = await db
      .select({
        session: authSessions,
        user: users,
      })
      .from(authSessions)
      .innerJoin(users, eq(authSessions.userId, users.id))
      .where(eq(authSessions.tokenHash, tokenHash))
      .limit(1);

    return rows[0];
  }

  async deleteSession(tokenHash: string): Promise<boolean> {
    const deleted = await db
      .delete(authSessions)
      .where(eq(authSessions.tokenHash, tokenHash))
      .returning();
    return deleted.length > 0;
  }

  async deleteUserSessions(userId: string): Promise<void> {
    await db.delete(authSessions).where(eq(authSessions.userId, userId));
  }

  async updateLastActivity(sessionId: string, timestamp: string): Promise<void> {
    await db
      .update(authSessions)
      .set({ lastActivityAt: timestamp })
      .where(eq(authSessions.id, sessionId));
  }
}

export const sessionRepository = new SessionRepository();

