import type { ScreenShareOptions } from './media.types';

export class ScreenShareManager {
  private screenStream: MediaStream | null = null;
  private onStarted?: (stream: MediaStream, hasAudio: boolean) => void;
  private onEnded?: () => void;
  private onError?: (error: Error) => void;

  constructor(callbacks?: {
    onStarted?: (stream: MediaStream, hasAudio: boolean) => void;
    onEnded?: () => void;
    onError?: (error: Error) => void;
  }) {
    this.onStarted = callbacks?.onStarted;
    this.onEnded = callbacks?.onEnded;
    this.onError = callbacks?.onError;
  }

  public async start(options?: ScreenShareOptions): Promise<MediaStream> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getDisplayMedia) {
      throw new Error('Screen sharing is not supported by this browser.');
    }

    try {
      // captureSystemAudio depends on browser and OS capabilities
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: 'monitor',
        },
        audio: options?.captureSystemAudio !== false,
      });

      this.screenStream = stream;
      const videoTrack = stream.getVideoTracks()[0];
      const audioTracks = stream.getAudioTracks();
      const hasAudio = audioTracks.length > 0;

      // Listen for browser's native "Stop Sharing" button click
      if (videoTrack) {
        videoTrack.onended = () => {
          this.stop();
        };
      }

      this.onStarted?.(stream, hasAudio);
      return stream;
    } catch (err: unknown) {
      const error = err as Error;
      // User cancelled native picker
      if (error.name === 'NotAllowedError' || error.message.includes('Permission denied')) {
        this.onError?.(new Error('Screen sharing was cancelled by the user.'));
      } else {
        this.onError?.(error);
      }
      throw error;
    }
  }

  public stop(): void {
    if (this.screenStream) {
      this.screenStream.getTracks().forEach((track) => {
        track.stop();
      });
      this.screenStream = null;
      this.onEnded?.();
    }
  }

  public getStream(): MediaStream | null {
    return this.screenStream;
  }

  public getVideoTrack(): MediaStreamTrack | null {
    return this.screenStream?.getVideoTracks()[0] || null;
  }

  public getAudioTrack(): MediaStreamTrack | null {
    return this.screenStream?.getAudioTracks()[0] || null;
  }

  public isSharing(): boolean {
    return Boolean(this.screenStream && this.screenStream.active);
  }

  public destroy(): void {
    this.stop();
  }
}
