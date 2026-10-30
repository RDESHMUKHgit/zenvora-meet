import api from './api';
import type { ApiResponse, MeetingRecord } from '../types';

export interface CreateMeetingPayload {
  title: string;
  isEphemeral?: boolean;
  maxParticipants?: number;
}

export const meetingApi = {
  async createMeeting(data: CreateMeetingPayload): Promise<MeetingRecord> {
    const res = await api.post<ApiResponse<{ meeting: MeetingRecord }>>('/meetings', data);
    if (!res.data.data?.meeting) throw new Error(res.data.message || 'Failed to create meeting');
    return res.data.data.meeting;
  },

  async getMeetingHistory(): Promise<MeetingRecord[]> {
    try {
      const res = await api.get<ApiResponse<{ meetings: MeetingRecord[] }>>('/meetings/history');
      return res.data.data?.meetings || [];
    } catch {
      return [];
    }
  },

  async getMeetingByCode(code: string): Promise<MeetingRecord> {
    const res = await api.get<ApiResponse<{ meeting: MeetingRecord }>>(`/meetings/${encodeURIComponent(code)}`);
    if (!res.data.data?.meeting) throw new Error(res.data.message || 'Meeting not found');
    return res.data.data.meeting;
  },

  async joinMeeting(code: string, displayName: string) {
    const res = await api.post<ApiResponse<{ meeting: MeetingRecord; participant: unknown }>>(
      `/meetings/${encodeURIComponent(code)}/join`,
      { displayName }
    );
    if (!res.data.data) throw new Error(res.data.message || 'Failed to join meeting');
    return res.data.data;
  },
};
