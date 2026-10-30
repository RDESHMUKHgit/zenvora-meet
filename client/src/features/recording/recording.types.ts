export type RecordingState = 'idle' | 'recording' | 'paused' | 'stopped';

export interface RecordingResult {
  blob: Blob;
  blobUrl: string;
  mimeType: string;
  durationSeconds: number;
  sizeBytes: number;
  recordedAt: string;
}

export interface ScreenRecorderOptions {
  timesliceMs?: number; // timeslice interval for ondataavailable
  onStateChange?: (state: RecordingState) => void;
  onError?: (error: Error) => void;
  onAutoStopped?: (result: RecordingResult) => void;
}

