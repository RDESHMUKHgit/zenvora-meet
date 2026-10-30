import type {
  RecordingState,
  RecordingResult,
  ScreenRecorderOptions,
} from './recording.types';

export class ScreenRecorderManager {
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private state: RecordingState = 'idle';
  private startTime: number = 0;
  private pausedDuration: number = 0;
  private lastPauseTime: number = 0;
  private currentResult: RecordingResult | null = null;
  private boundStream: MediaStream | null = null;
  private options: ScreenRecorderOptions;

  constructor(options: ScreenRecorderOptions = {}) {
    this.options = options;
  }

  /**
   * Probes supported MIME types in order of codec preference.
   */
  public static getSupportedMimeType(): string {
    if (typeof MediaRecorder === 'undefined') {
      return '';
    }

    const candidateTypes = [
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm;codecs=h264,opus',
      'video/webm',
      'video/mp4;codecs=avc1,mp4a.40.2',
      'video/mp4',
    ];

    for (const type of candidateTypes) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }

    return '';
  }

  /**
   * Starts recording a MediaStream (video from screen share, optional audio if permitted).
   */
  public async start(stream: MediaStream): Promise<void> {
    if (typeof MediaRecorder === 'undefined') {
      throw new Error('MediaRecorder is not supported by your browser.');
    }

    if (!stream || stream.getVideoTracks().length === 0) {
      throw new Error('Cannot record: No video track found in the provided screen stream.');
    }

    // Clean up any prior recording resources
    this.cleanup();

    this.recordedChunks = [];
    this.boundStream = stream;
    this.startTime = Date.now();
    this.pausedDuration = 0;

    const mimeType = ScreenRecorderManager.getSupportedMimeType();
    const recorderOptions: MediaRecorderOptions = {};
    if (mimeType) {
      recorderOptions.mimeType = mimeType;
    }

    try {
      this.mediaRecorder = new MediaRecorder(stream, recorderOptions);
    } catch {
      // Fallback without MIME type options if specific codec fails initialization
      this.mediaRecorder = new MediaRecorder(stream);
    }

    this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) {
        this.recordedChunks.push(event.data);
      }
    };

    this.mediaRecorder.onerror = (event: Event) => {
      const err = (event as unknown as { error?: Error }).error || new Error('MediaRecorder encountered an error.');
      this.options.onError?.(err);
    };

    // Auto-stop recording if user stops screen sharing in the browser native UI
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.addEventListener(
        'ended',
        async () => {
          if (this.state === 'recording' || this.state === 'paused') {
            try {
              const res = await this.stop();
              this.options.onAutoStopped?.(res);
            } catch {
              // Ignore already closed
            }
          }
        },
        { once: true }
      );
    }

    // Start recorder with 1-second timeslices for chunk reliability
    this.mediaRecorder.start(this.options.timesliceMs ?? 1000);
    this.setState('recording');
  }

  public pause(): void {
    if (this.mediaRecorder && this.state === 'recording') {
      this.mediaRecorder.pause();
      this.lastPauseTime = Date.now();
      this.setState('paused');
    }
  }

  public resume(): void {
    if (this.mediaRecorder && this.state === 'paused') {
      if (this.lastPauseTime > 0) {
        this.pausedDuration += Date.now() - this.lastPauseTime;
        this.lastPauseTime = 0;
      }
      this.mediaRecorder.resume();
      this.setState('recording');
    }
  }

  public stop(): Promise<RecordingResult> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder || this.state === 'idle') {
        reject(new Error('Recorder is not active.'));
        return;
      }

      const effectiveEndTime = this.state === 'paused' && this.lastPauseTime > 0 ? this.lastPauseTime : Date.now();
      const elapsedMs = Math.max(0, effectiveEndTime - this.startTime - this.pausedDuration);
      const durationSeconds = Math.round(elapsedMs / 1000);

      const mimeType = this.mediaRecorder.mimeType || 'video/webm';

      this.mediaRecorder.onstop = () => {
        try {
          const blob = new Blob(this.recordedChunks, { type: mimeType });
          const blobUrl = URL.createObjectURL(blob);

          const result: RecordingResult = {
            blob,
            blobUrl,
            mimeType,
            durationSeconds,
            sizeBytes: blob.size,
            recordedAt: new Date().toISOString(),
          };

          this.currentResult = result;
          this.setState('stopped');
          resolve(result);
        } catch (err) {
          reject(err);
        }
      };

      try {
        this.mediaRecorder.stop();
      } catch (err) {
        reject(err);
      }
    });
  }

  public getState(): RecordingState {
    return this.state;
  }

  public getStream(): MediaStream | null {
    return this.boundStream;
  }

  public getCurrentResult(): RecordingResult | null {
    return this.currentResult;
  }

  /**
   * Safely releases object URLs and internal blob references.
   */
  public cleanup(): void {
    if (this.currentResult?.blobUrl) {
      try {
        URL.revokeObjectURL(this.currentResult.blobUrl);
      } catch {
        // Ignore
      }
    }
    this.currentResult = null;
    this.recordedChunks = [];
    this.mediaRecorder = null;
    this.boundStream = null;
    this.startTime = 0;
    this.pausedDuration = 0;
    this.lastPauseTime = 0;
    this.setState('idle');
  }

  private setState(state: RecordingState): void {
    this.state = state;
    this.options.onStateChange?.(state);
  }
}
