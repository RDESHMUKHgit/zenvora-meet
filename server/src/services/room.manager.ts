import { logger } from '../utils/logger.js';
import { nowIso } from '../utils/time.js';

export interface ActiveParticipant {
  id: string; // participant ID (UUID)
  socketId: string;
  userId: string | null;
  displayName: string;
  role: 'host' | 'participant';
  joinedAt: string;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
}

export interface ActiveRoom {
  meetingId: string;
  meetingCode: string;
  hostUserId: string | null;
  hostTokenHash?: string | null;
  hostToken?: string | null;
  title: string;
  maxParticipants: number; // 0 = unlimited, 1, 2, 4, 8, etc.
  isEphemeral: boolean;
  status: 'active' | 'ended';
  createdAt: string;
  participants: Map<string, ActiveParticipant>; // participantId -> ActiveParticipant
  socketMap: Map<string, string>; // socketId -> participantId
  emptyTimer: NodeJS.Timeout | null;
  emptySince: number | null;
}

export interface IRoomManager {
  getRoom(code: string): ActiveRoom | undefined;
  createRoom(room: {
    meetingId: string;
    meetingCode: string;
    hostUserId: string | null;
    hostToken?: string | null;
    hostTokenHash?: string | null;
    title: string;
    maxParticipants: number;
    isEphemeral: boolean;
  }): ActiveRoom;
  addParticipant(code: string, participant: ActiveParticipant): ActiveParticipant;
  removeParticipantBySocketId(socketId: string): {
    room: ActiveRoom | undefined;
    removed: ActiveParticipant | undefined;
  };
  removeParticipant(
    code: string,
    participantId: string
  ): { room: ActiveRoom | undefined; removed: ActiveParticipant | undefined };
  updateParticipantMedia(
    code: string,
    participantId: string,
    media: { isMuted?: boolean; isVideoOff?: boolean; isScreenSharing?: boolean }
  ): ActiveParticipant | undefined;
  getParticipantCount(code: string): number;
  isRoomFull(code: string): boolean;
  isHost(code: string, auth: { userId?: string | null; hostToken?: string | null }): boolean;
  startEmptyTimer(code: string, onExpired: () => void | Promise<void>): void;
  cancelEmptyTimer(code: string): boolean;
  closeRoom(code: string): void;
  getAllRooms(): ActiveRoom[];
}

/**
 * Authoritative in-memory RoomManager for Phase 1.
 * Provides clean interfaces ready for Redis clustering in Phase 2.
 * Note: In-memory room state does not survive backend restarts.
 */
export class RoomManager implements IRoomManager {
  private readonly rooms = new Map<string, ActiveRoom>();

  private normalizeCode(code: string): string {
    return code.toLowerCase().trim();
  }

  getRoom(code: string): ActiveRoom | undefined {
    return this.rooms.get(this.normalizeCode(code));
  }

  createRoom(params: {
    meetingId: string;
    meetingCode: string;
    hostUserId: string | null;
    hostToken?: string | null;
    hostTokenHash?: string | null;
    title: string;
    maxParticipants: number;
    isEphemeral: boolean;
  }): ActiveRoom {
    const code = this.normalizeCode(params.meetingCode);
    const existing = this.rooms.get(code);
    if (existing) {
      existing.title = params.title;
      existing.maxParticipants = params.maxParticipants;
      existing.isEphemeral = params.isEphemeral;
      if (params.hostToken) existing.hostToken = params.hostToken;
      if (params.hostTokenHash) existing.hostTokenHash = params.hostTokenHash;
      return existing;
    }

    const room: ActiveRoom = {
      meetingId: params.meetingId,
      meetingCode: code,
      hostUserId: params.hostUserId,
      hostToken: params.hostToken || null,
      hostTokenHash: params.hostTokenHash || null,
      title: params.title,
      maxParticipants: params.maxParticipants,
      isEphemeral: params.isEphemeral,
      status: 'active',
      createdAt: nowIso(),
      participants: new Map(),
      socketMap: new Map(),
      emptyTimer: null,
      emptySince: null,
    };

    this.rooms.set(code, room);
    logger.info(
      { meetingCode: code, maxParticipants: room.maxParticipants, isEphemeral: room.isEphemeral },
      'In-memory room created in RoomManager'
    );
    return room;
  }

  addParticipant(code: string, participant: ActiveParticipant): ActiveParticipant {
    const norm = this.normalizeCode(code);
    const room = this.rooms.get(norm);
    if (!room) {
      throw new Error(`Room '${code}' does not exist in RoomManager`);
    }

    // Cancel empty timer if running
    this.cancelEmptyTimer(norm);

    // Check for duplicate join / socket replacement (e.g. reload tab or reconnect)
    const existing = room.participants.get(participant.id);
    if (existing) {
      // Remove old socket mapping
      if (existing.socketId && existing.socketId !== participant.socketId) {
        room.socketMap.delete(existing.socketId);
      }
      existing.socketId = participant.socketId;
      existing.displayName = participant.displayName;
      existing.isMuted = participant.isMuted;
      existing.isVideoOff = participant.isVideoOff;
      room.socketMap.set(participant.socketId, participant.id);
      logger.info(
        { meetingCode: norm, participantId: participant.id, socketId: participant.socketId },
        'Reconnected / updated existing participant socket mapping'
      );
      return existing;
    }

    // Capacity enforcement
    if (this.isRoomFull(norm)) {
      throw new Error('Room has reached its maximum participant capacity');
    }

    room.participants.set(participant.id, participant);
    room.socketMap.set(participant.socketId, participant.id);

    logger.info(
      {
        meetingCode: norm,
        participantId: participant.id,
        role: participant.role,
        currentCount: room.participants.size,
      },
      'Participant added to room'
    );

    return participant;
  }

  removeParticipantBySocketId(socketId: string): {
    room: ActiveRoom | undefined;
    removed: ActiveParticipant | undefined;
  } {
    for (const [code, room] of this.rooms.entries()) {
      const participantId = room.socketMap.get(socketId);
      if (participantId) {
        room.socketMap.delete(socketId);
        const removed = room.participants.get(participantId);
        room.participants.delete(participantId);

        logger.info(
          {
            meetingCode: code,
            participantId,
            socketId,
            remainingCount: room.participants.size,
          },
          'Participant removed by socketId'
        );

        return { room, removed };
      }
    }
    return { room: undefined, removed: undefined };
  }

  removeParticipant(
    code: string,
    participantId: string
  ): { room: ActiveRoom | undefined; removed: ActiveParticipant | undefined } {
    const room = this.rooms.get(this.normalizeCode(code));
    if (!room) return { room: undefined, removed: undefined };

    const removed = room.participants.get(participantId);
    if (removed) {
      room.participants.delete(participantId);
      if (removed.socketId) {
        room.socketMap.delete(removed.socketId);
      }
      logger.info(
        {
          meetingCode: code,
          participantId,
          remainingCount: room.participants.size,
        },
        'Participant removed from room'
      );
    }
    return { room, removed };
  }

  updateParticipantMedia(
    code: string,
    participantId: string,
    media: { isMuted?: boolean; isVideoOff?: boolean; isScreenSharing?: boolean }
  ): ActiveParticipant | undefined {
    const room = this.rooms.get(this.normalizeCode(code));
    if (!room) return undefined;

    const participant = room.participants.get(participantId);
    if (!participant) return undefined;

    if (media.isMuted !== undefined) participant.isMuted = media.isMuted;
    if (media.isVideoOff !== undefined) participant.isVideoOff = media.isVideoOff;
    if (media.isScreenSharing !== undefined) participant.isScreenSharing = media.isScreenSharing;

    return participant;
  }

  getParticipantCount(code: string): number {
    const room = this.rooms.get(this.normalizeCode(code));
    return room ? room.participants.size : 0;
  }

  isRoomFull(code: string): boolean {
    const room = this.rooms.get(this.normalizeCode(code));
    if (!room) return false;
    // 0 denotes unlimited capacity
    if (room.maxParticipants === 0) return false;
    return room.participants.size >= room.maxParticipants;
  }

  isHost(code: string, auth: { userId?: string | null; hostToken?: string | null }): boolean {
    const room = this.rooms.get(this.normalizeCode(code));
    if (!room) return false;

    // Check host userId match
    if (room.hostUserId && auth.userId && room.hostUserId === auth.userId) {
      return true;
    }

    // Check host token match
    if (room.hostToken && auth.hostToken && room.hostToken === auth.hostToken) {
      return true;
    }

    return false;
  }

  startEmptyTimer(code: string, onExpired: () => void | Promise<void>): void {
    const norm = this.normalizeCode(code);
    const room = this.rooms.get(norm);
    if (!room) return;

    if (room.emptyTimer) {
      clearTimeout(room.emptyTimer);
    }

    room.emptySince = Date.now();
    logger.info(
      { meetingCode: norm },
      'Room is empty. Started server-side 60-second expiration timer'
    );

    room.emptyTimer = setTimeout(async () => {
      logger.info(
        { meetingCode: norm },
        '60-second expiration timer fired. Room remained empty, closing room'
      );
      try {
        await onExpired();
      } catch (err) {
        logger.error({ err, meetingCode: norm }, 'Error executing room expiration callback');
      } finally {
        this.closeRoom(norm);
      }
    }, 60000);
  }

  cancelEmptyTimer(code: string): boolean {
    const norm = this.normalizeCode(code);
    const room = this.rooms.get(norm);
    if (room && room.emptyTimer) {
      clearTimeout(room.emptyTimer);
      room.emptyTimer = null;
      room.emptySince = null;
      logger.info({ meetingCode: norm }, '60-second expiration timer cancelled on rejoin');
      return true;
    }
    return false;
  }

  closeRoom(code: string): void {
    const norm = this.normalizeCode(code);
    const room = this.rooms.get(norm);
    if (room) {
      if (room.emptyTimer) {
        clearTimeout(room.emptyTimer);
        room.emptyTimer = null;
      }
      room.status = 'ended';
      room.participants.clear();
      room.socketMap.clear();
      this.rooms.delete(norm);
      logger.info({ meetingCode: norm }, 'Room purged from in-memory RoomManager');
    }
  }

  getAllRooms(): ActiveRoom[] {
    return Array.from(this.rooms.values());
  }
}

export const roomManager = new RoomManager();
