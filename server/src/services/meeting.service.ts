import crypto from 'crypto';
import { meetingRepository, MeetingRepository } from '../repositories/meeting.repository.js';
import { roomManager, type IRoomManager } from './room.manager.js';
import { nowIso, futureIso, isExpired } from '../utils/time.js';
import { NotFoundError, ForbiddenError, ConflictError, BadRequestError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import type { CreateMeetingInput } from '../validators/meeting.validator.js';
import type { Meeting, MeetingParticipant } from '../db/schema/meetings.schema.js';
import { getIO } from '../sockets/index.js';

export class MeetingService {
  constructor(
    private readonly meetingRepo: MeetingRepository = meetingRepository,
    private readonly roomMgr: IRoomManager = roomManager
  ) {}

  /**
   * Generates a unique meeting ID in the format: abc-oude-yig-2324
   * - 3 alphanumeric characters derived from or associated with the host's name, where available.
   * - Two additional short alphanumeric segments.
   * - A four-digit suffix.
   */
  private generateMeetingCode(hostName?: string | null): string {
    const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';

    // 1. Prefix: 3 alphanumeric characters from host's name or random
    let prefix = '';
    if (hostName) {
      const cleaned = hostName.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (cleaned.length >= 3) {
        prefix = cleaned.slice(0, 3);
      } else if (cleaned.length > 0) {
        prefix = cleaned;
      }
    }
    while (prefix.length < 3) {
      const byte = crypto.randomBytes(1)[0]!;
      prefix += chars[byte % chars.length];
    }

    // 2. Two additional short alphanumeric segments (4 chars and 3 chars)
    const genSegment = (len: number) => {
      let seg = '';
      const bytes = crypto.randomBytes(len);
      for (let i = 0; i < len; i++) {
        seg += chars[bytes[i]! % chars.length];
      }
      return seg;
    };

    const seg2 = genSegment(4); // e.g. "oude"
    const seg3 = genSegment(3); // e.g. "yig"

    // 3. Four-digit suffix (1000 - 9999)
    const suffix = crypto.randomInt(1000, 10000).toString(); // e.g. "2324"

    return `${prefix}-${seg2}-${seg3}-${suffix}`;
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async createMeeting(
    hostUserId: string | null,
    input: CreateMeetingInput,
    hostUserName?: string | null
  ): Promise<{ meeting: Meeting; hostToken: string; participant: MeetingParticipant }> {
    const displayName =
      input.displayName?.trim() || hostUserName?.trim() || (hostUserId ? 'Host User' : 'Host');

    // Generate collision-safe meeting ID in format abc-oude-yig-2324
    let meetingCode = this.generateMeetingCode(displayName);
    let existing = await this.meetingRepo.findByCode(meetingCode);
    while (existing) {
      meetingCode = this.generateMeetingCode(displayName);
      existing = await this.meetingRepo.findByCode(meetingCode);
    }

    // Generate cryptographically secure host token (never rely on meeting ID as auth secret)
    const hostToken = crypto.randomBytes(32).toString('hex');
    const hostTokenHash = this.hashToken(hostToken);

    const now = nowIso();
    const expiresAt = input.isEphemeral ? futureIso({ hours: 24 }) : null;

    // Persist meeting in PostgreSQL
    const meeting = await this.meetingRepo.createMeeting({
      meetingCode,
      hostUserId: hostUserId || null,
      hostTokenHash,
      title: input.title.trim(),
      maxParticipants: input.maxParticipants ?? 0, // 0 denotes unlimited
      isEphemeral: input.isEphemeral ?? false,
      status: 'active',
      createdAt: now,
      startedAt: now,
      expiresAt,
    });

    // Create the host's participant record in database
    const participant = await this.meetingRepo.addParticipant({
      meetingId: meeting.id,
      userId: hostUserId || null,
      displayName,
      role: 'host',
      joinedAt: now,
    });

    // Initialize in-memory authoritative room
    this.roomMgr.createRoom({
      meetingId: meeting.id,
      meetingCode: meeting.meetingCode,
      hostUserId: meeting.hostUserId,
      hostToken,
      hostTokenHash,
      title: meeting.title,
      maxParticipants: meeting.maxParticipants,
      isEphemeral: meeting.isEphemeral,
    });

    logger.info(
      {
        meetingCode: meeting.meetingCode,
        isEphemeral: meeting.isEphemeral,
        maxParticipants: meeting.maxParticipants,
        hostUserId,
      },
      'Meeting created successfully'
    );

    return { meeting, hostToken, participant };
  }

  async getMeetingByCode(
    code: string
  ): Promise<{ meeting: Meeting; activeParticipantCount: number; isFull: boolean }> {
    const meeting = await this.meetingRepo.findByCode(code);
    if (!meeting) {
      throw new NotFoundError(`Meeting room '${code}' does not exist or has expired`);
    }

    if (meeting.status === 'ended') {
      throw new BadRequestError(`Meeting '${code}' has ended`);
    }

    if (meeting.expiresAt && isExpired(meeting.expiresAt)) {
      throw new NotFoundError(`Meeting room '${code}' has expired`);
    }

    // Hydrate in-memory room if not already present
    let activeCount = this.roomMgr.getParticipantCount(code);
    const room = this.roomMgr.getRoom(code);
    if (!room && meeting.status === 'active') {
      this.roomMgr.createRoom({
        meetingId: meeting.id,
        meetingCode: meeting.meetingCode,
        hostUserId: meeting.hostUserId,
        hostTokenHash: meeting.hostTokenHash,
        title: meeting.title,
        maxParticipants: meeting.maxParticipants,
        isEphemeral: meeting.isEphemeral,
      });
      activeCount = 0;
    }

    const isFull = this.roomMgr.isRoomFull(code);

    return { meeting, activeParticipantCount: activeCount, isFull };
  }

  async getUserHistory(userId: string): Promise<Meeting[]> {
    return this.meetingRepo.getMeetingsByUserId(userId);
  }

  async joinMeeting(
    code: string,
    userId: string | null,
    displayName: string,
    hostToken?: string
  ): Promise<{ meeting: Meeting; participant: MeetingParticipant }> {
    const { meeting } = await this.getMeetingByCode(code);

    // Capacity enforcement
    if (this.roomMgr.isRoomFull(code)) {
      throw new ConflictError(
        `Meeting room '${code}' has reached its maximum participant capacity of ${meeting.maxParticipants}`
      );
    }

    const now = nowIso();
    // Only grant host role if a valid hostToken is explicitly provided
    // Merely having the same account does not automatically make a joining user the host
    const isHost = Boolean(
      hostToken && meeting.hostTokenHash && this.hashToken(hostToken) === meeting.hostTokenHash
    );

    // Default to participant role for anyone joining
    const participant = await this.meetingRepo.addParticipant({
      meetingId: meeting.id,
      userId: userId || null,
      displayName: displayName.trim(),
      role: isHost ? 'host' : 'participant',
      joinedAt: now,
    });

    // Cancel 60-second timer if room was empty
    this.roomMgr.cancelEmptyTimer(code);

    return { meeting, participant };
  }

  async leaveMeeting(code: string, participantId: string): Promise<void> {
    const now = nowIso();
    await this.meetingRepo.markParticipantLeft(participantId, now);

    const { room, removed } = this.roomMgr.removeParticipant(code, participantId);
    if (room && removed) {
      try {
        const io = getIO();
        io.to(`room:${room.meetingCode}`).emit('participant:left', {
          participantId: removed.id,
          displayName: removed.displayName,
        });
        io.to(`room:${room.meetingCode}`).emit('room:participants', {
          participants: Array.from(room.participants.values()),
          count: room.participants.size,
        });
      } catch (err) {
        logger.warn({ err }, 'Failed to broadcast participant:left socket event');
      }

      // If room became empty, initiate 60-second server-side expiration timer
      if (room.participants.size === 0) {
        this.setupEmptyRoomExpiration(room.meetingCode);
      }
    }
  }

  async endMeeting(
    code: string,
    auth: { userId?: string | null; hostToken?: string | null }
  ): Promise<void> {
    const meeting = await this.meetingRepo.findByCode(code);
    if (!meeting) {
      throw new NotFoundError(`Meeting room '${code}' does not exist`);
    }

    // Verify host authority
    const isHostUser = Boolean(auth.userId && meeting.hostUserId === auth.userId);
    const isHostToken = Boolean(
      auth.hostToken && meeting.hostTokenHash && this.hashToken(auth.hostToken) === meeting.hostTokenHash
    );
    const isInMemoryHost = this.roomMgr.isHost(code, auth);

    if (!isHostUser && !isHostToken && !isInMemoryHost) {
      throw new ForbiddenError('Only the host can end a meeting for everyone');
    }

    const now = nowIso();

    // Mark meeting as ended in PostgreSQL
    await this.meetingRepo.updateMeetingStatus(meeting.id, 'ended', now);

    // Cancel running empty timers
    this.roomMgr.cancelEmptyTimer(code);

    // Broadcast meeting:ended event to all connected sockets
    try {
      const io = getIO();
      io.to(`room:${meeting.meetingCode.toLowerCase()}`).emit('meeting:ended', {
        reason: 'The host has ended the meeting for everyone.',
        endedAt: now,
      });
    } catch (err) {
      logger.warn({ err }, 'Failed to emit meeting:ended socket event');
    }

    // Close and purge room from RoomManager
    this.roomMgr.closeRoom(meeting.meetingCode);

    logger.info({ meetingCode: meeting.meetingCode }, 'Meeting explicitly ended by host');
  }

  setupEmptyRoomExpiration(code: string): void {
    this.roomMgr.startEmptyTimer(code, async () => {
      logger.info({ meetingCode: code }, 'Executing 60-second empty room closure');
      const meeting = await this.meetingRepo.findByCode(code);
      if (meeting) {
        const now = nowIso();
        await this.meetingRepo.updateMeetingStatus(meeting.id, 'ended', now);
        try {
          const io = getIO();
          io.to(`room:${code.toLowerCase()}`).emit('meeting:ended', {
            reason: 'Meeting ended after remaining empty for 60 seconds.',
            endedAt: now,
          });
        } catch {
          // Socket might have closed
        }
      }
    });
  }

  /**
   * On backend startup: reconcile persistent meetings and clean up stale in-memory records.
   * Note: In-memory room state does not survive backend restarts.
   */
  async reconcileOnStartup(): Promise<void> {
    try {
      const now = nowIso();
      const reconciledCount = await this.meetingRepo.reconcileActiveMeetings(now);
      logger.info(
        `[Startup Reconciliation] Reconciled ${reconciledCount} unclosed meetings from prior server instance.`
      );
      logger.info(
        '[Startup Reconciliation] Notice: In-memory room state does not survive backend restarts.'
      );
    } catch (err) {
      logger.error(err, 'Failed to reconcile meetings on startup');
    }
  }
}

export const meetingService = new MeetingService();
