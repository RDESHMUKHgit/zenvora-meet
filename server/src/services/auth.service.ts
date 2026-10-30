import { userRepository, UserRepository } from '../repositories/user.repository.js';
import { sessionRepository, SessionRepository } from '../repositories/session.repository.js';
import { hashPassword, verifyPassword, generateSessionToken, hashSessionToken } from '../utils/crypto.js';
import { nowIso, calculateSessionExpiry, isExpired } from '../utils/time.js';
import { AppError, UnauthorizedError } from '../utils/errors.js';
import type { RegisterInput, LoginInput } from '../validators/auth.validator.js';
import type { User } from '../db/schema/users.schema.js';
import type { AuthSession } from '../db/schema/sessions.schema.js';

export interface SafeUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  createdAt: string;
}

export interface AuthResult {
  user: SafeUser;
  sessionToken: string;
  expiresAt: string;
}

export class AuthService {
  constructor(
    private readonly userRepo: UserRepository = userRepository,
    private readonly sessionRepo: SessionRepository = sessionRepository
  ) {}

  private toSafeUser(user: User): SafeUser {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl,
      createdAt: user.createdAt,
    };
  }

  async register(input: RegisterInput): Promise<AuthResult> {
    const existing = await this.userRepo.findByEmail(input.email);
    if (existing) {
      throw new AppError('An account with this email already exists', 409);
    }

    const passwordHash = await hashPassword(input.password);
    const now = nowIso();

    const user = await this.userRepo.create({
      name: input.name,
      email: input.email,
      passwordHash,
      createdAt: now,
      updatedAt: now,
    });

    const session = await this.createSession(user.id);

    return {
      user: this.toSafeUser(user),
      sessionToken: session.rawToken,
      expiresAt: session.expiresAt,
    };
  }

  async login(input: LoginInput): Promise<AuthResult> {
    const user = await this.userRepo.findByEmail(input.email);

    // Generic error to prevent account enumeration
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const isValidPassword = await verifyPassword(user.passwordHash, input.password);
    if (!isValidPassword) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Session rotation on login: invalidate previous active sessions
    await this.sessionRepo.deleteUserSessions(user.id);

    // Create fresh session
    const session = await this.createSession(user.id);

    return {
      user: this.toSafeUser(user),
      sessionToken: session.rawToken,
      expiresAt: session.expiresAt,
    };
  }

  async logout(rawToken: string): Promise<void> {
    const tokenHash = hashSessionToken(rawToken);
    await this.sessionRepo.deleteSession(tokenHash);
  }

  async validateSession(
    rawToken: string
  ): Promise<{ user: SafeUser; session: AuthSession } | null> {
    const tokenHash = hashSessionToken(rawToken);
    const result = await this.sessionRepo.findSessionWithUser(tokenHash);

    if (!result) {
      return null;
    }

    const { session, user } = result;

    // Check expiration using Temporal API
    if (isExpired(session.expiresAt)) {
      await this.sessionRepo.deleteSession(tokenHash);
      return null;
    }

    // Update last activity using Temporal API
    const now = nowIso();
    await this.sessionRepo.updateLastActivity(session.id, now);

    return {
      user: this.toSafeUser(user),
      session,
    };
  }

  private async createSession(
    userId: string
  ): Promise<{ rawToken: string; expiresAt: string }> {
    const rawToken = generateSessionToken();
    const tokenHash = hashSessionToken(rawToken);
    const now = nowIso();
    const expiresAt = calculateSessionExpiry(7); // 7-day session

    await this.sessionRepo.createSession({
      userId,
      tokenHash,
      expiresAt,
      createdAt: now,
      lastActivityAt: now,
    });

    return { rawToken, expiresAt };
  }
}

export const authService = new AuthService();

