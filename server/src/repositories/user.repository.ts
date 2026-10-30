import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, type User, type NewUser } from '../db/schema/users.schema.js';

export class UserRepository {
  async findByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    return user;
  }

  async findById(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return user;
  }

  async create(data: NewUser): Promise<User> {
    const [newUser] = await db.insert(users).values(data).returning();
    return newUser;
  }

  async update(id: string, data: Partial<NewUser>): Promise<User | undefined> {
    const [updatedUser] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return updatedUser;
  }
}

export const userRepository = new UserRepository();

