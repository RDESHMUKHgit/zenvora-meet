import api from './api';
import type { ApiResponse, MeetingRecord } from '../types';

export interface CreateMeetingPayload {
  title: string;
  displayName?: string;
  maxParticipants?: number; // 1, 2, 4, 8, 0 (Unlimited)
  isEphemeral?: boolean;
}

export interface ParticipantInfo {
  id: string;
  displayName: string;
  role: 'host' | 'participant';
}

export interface CreateMeetingResponse {
  meeting: MeetingRecord;
  hostToken: string;
  participant: ParticipantInfo;
}

export interface JoinMeetingResponse {
  meeting: MeetingRecord;
  participant: ParticipantInfo;
}

export interface MeetingDetailsResponse {
  meeting: MeetingRecord;
  activeParticipantCount: number;
  isFull: boolean;
}

export const meetingApi = {
  async createMeeting(data: CreateMeetingPayload): Promise<CreateMeetingResponse> {
    const res = await api.post<ApiResponse<CreateMeetingResponse>>('/meetings', data);
    if (!res.data.data?.meeting) throw new Error(res.data.message || 'Failed to create meeting');
    return res.data.data;
  },

  async getMeetingHistory(): Promise<MeetingRecord[]> {
    try {
      const res = await api.get<ApiResponse<{ meetings: MeetingRecord[] }>>('/meetings/history');
      return res.data.data?.meetings || [];
    } catch {
      return [];
    }
  },

  async getMeetingByCode(code: string): Promise<MeetingDetailsResponse> {
    const res = await api.get<ApiResponse<MeetingDetailsResponse>>(`/meetings/${encodeURIComponent(code)}`);
    if (!res.data.data?.meeting) throw new Error(res.data.message || 'Meeting not found');
    return res.data.data;
  },

  async joinMeeting(code: string, displayName: string): Promise<JoinMeetingResponse> {
    const res = await api.post<ApiResponse<JoinMeetingResponse>>(
      `/meetings/${encodeURIComponent(code)}/join`,
      { displayName }
    );
    if (!res.data.data) throw new Error(res.data.message || 'Failed to join meeting');
    return res.data.data;
  },

  async leaveMeeting(code: string, participantId?: string): Promise<void> {
    try {
      await api.post(`/meetings/${encodeURIComponent(code)}/leave`, { participantId });
    } catch {
      // Ignored on teardown
    }
  },

  async endMeeting(code: string, hostToken?: string): Promise<void> {
    const headers: Record<string, string> = {};
    if (hostToken) headers['x-host-token'] = hostToken;

    const res = await api.post<ApiResponse<void>>(
      `/meetings/${encodeURIComponent(code)}/end`,
      { hostToken },
      { headers }
    );
    if (!res.data.success) throw new Error(res.data.message || 'Failed to end meeting');
  },
};
