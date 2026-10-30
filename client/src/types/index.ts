export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export type ThemeMode = 'light' | 'dark' | 'system';

export type UserStatus = 'online' | 'busy' | 'away' | 'offline';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  status: UserStatus;
  jobTitle?: string;
  timezone: string;
}

export type MeetingStatus = 'completed' | 'scheduled' | 'live';

export interface MeetingRecord {
  id: string;
  meetingCode: string;
  code?: string;
  title: string;
  hostUserId?: string | null;
  hostName?: string;
  startedAt?: string | null;
  createdAt: string;
  endedAt?: string | null;
  expiresAt?: string | null;
  durationMinutes?: number;
  participantsCount?: number;
  status: string;
  isEphemeral?: boolean;
}

export interface MeetingConfig {
  title: string;
  passcode?: string;
  muteMicOnJoin: boolean;
  turnOffCameraOnJoin: boolean;
  allowScreenShare: boolean;
}

export interface DeviceSettings {
  audioInputId: string;
  videoInputId: string;
  audioOutputId: string;
  noiseSuppression: boolean;
  mirrorVideo: boolean;
  hdQuality: boolean;
}

export interface AppPreferences {
  theme: ThemeMode;
  timeFormat: '12h' | '24h';
  autoMuteMic: boolean;
  autoTurnOffCamera: boolean;
}
