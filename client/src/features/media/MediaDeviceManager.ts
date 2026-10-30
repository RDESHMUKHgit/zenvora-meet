import type {
  AvailableMediaDevices,
  DevicePermissionState,
} from './media.types';

export class MediaDeviceManager {
  private audioInputs: MediaDeviceInfo[] = [];
  private videoInputs: MediaDeviceInfo[] = [];
  private audioOutputs: MediaDeviceInfo[] = [];
  private selectedAudioInputId: string | null = null;
  private selectedVideoInputId: string | null = null;
  private selectedAudioOutputId: string | null = null;
  private permissions: DevicePermissionState = {
    camera: 'unknown',
    microphone: 'unknown',
  };

  private onStateChange?: (state: AvailableMediaDevices) => void;
  private onDeviceError?: (error: Error, context: string) => void;

  constructor(
    onStateChange?: (state: AvailableMediaDevices) => void,
    onDeviceError?: (error: Error, context: string) => void
  ) {
    this.onStateChange = onStateChange;
    this.onDeviceError = onDeviceError;

    if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
      navigator.mediaDevices.addEventListener('devicechange', this.handleDeviceChange);
    }
  }

  private handleDeviceChange = async () => {
    try {
      await this.enumerateDevices();
    } catch (err: unknown) {
      this.onDeviceError?.(err as Error, 'devicechange');
    }
  };

  public async checkPermissions(): Promise<DevicePermissionState> {
    if (typeof navigator === 'undefined' || !navigator.permissions) {
      return this.permissions;
    }

    try {
      // Check camera permission
      const camStatus = await navigator.permissions.query({ name: 'camera' as PermissionName });
      this.permissions.camera = camStatus.state;
      camStatus.onchange = () => {
        this.permissions.camera = camStatus.state;
        this.notifyState();
      };
    } catch {
      // permissions query for camera not supported in all browsers
    }

    try {
      // Check microphone permission
      const micStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      this.permissions.microphone = micStatus.state;
      micStatus.onchange = () => {
        this.permissions.microphone = micStatus.state;
        this.notifyState();
      };
    } catch {
      // permissions query for microphone not supported in all browsers
    }

    return this.permissions;
  }

  public async enumerateDevices(): Promise<AvailableMediaDevices> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.enumerateDevices) {
      return this.getState();
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();

      this.audioInputs = devices.filter((d) => d.kind === 'audioinput');
      this.videoInputs = devices.filter((d) => d.kind === 'videoinput');
      this.audioOutputs = devices.filter((d) => d.kind === 'audiooutput');

      // Preserve or set defaults
      if (!this.selectedAudioInputId && this.audioInputs.length > 0) {
        this.selectedAudioInputId = this.audioInputs[0]?.deviceId || 'default';
      }
      if (!this.selectedVideoInputId && this.videoInputs.length > 0) {
        this.selectedVideoInputId = this.videoInputs[0]?.deviceId || 'default';
      }
      if (!this.selectedAudioOutputId && this.audioOutputs.length > 0) {
        this.selectedAudioOutputId = this.audioOutputs[0]?.deviceId || 'default';
      }

      await this.checkPermissions();
      this.notifyState();
    } catch (err: unknown) {
      this.onDeviceError?.(err as Error, 'enumerateDevices');
    }

    return this.getState();
  }

  public async acquireUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('navigator.mediaDevices.getUserMedia is not supported by this browser');
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      this.permissions.camera = 'granted';
      this.permissions.microphone = 'granted';

      // Re-enumerate to get labeled devices now that permission is granted
      await this.enumerateDevices();
      return stream;
    } catch (err: unknown) {
      const error = err as Error;
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        this.permissions.camera = 'denied';
        this.permissions.microphone = 'denied';
        this.notifyState();
        throw new Error('Camera/Microphone permission was denied. Please allow access in browser settings.', {
          cause: err,
        });
      }
      if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        throw new Error('No camera or microphone device was found on this system.', { cause: err });
      }
      if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        throw new Error('Camera or microphone is already in use by another application.', { cause: err });
      }
      throw error;
    }
  }

  public async switchAudioInput(
    deviceId: string,
    currentStream: MediaStream | null,
    onTrackReplaced?: (newTrack: MediaStreamTrack) => Promise<void> | void
  ): Promise<MediaStreamTrack | null> {
    this.selectedAudioInputId = deviceId;
    this.notifyState();

    if (!currentStream) return null;

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId } },
        video: false,
      });

      const newTrack = newStream.getAudioTracks()[0];
      if (!newTrack) return null;

      // Stop and remove old audio track
      const oldTrack = currentStream.getAudioTracks()[0];
      if (oldTrack) {
        currentStream.removeTrack(oldTrack);
        oldTrack.stop();
      }

      currentStream.addTrack(newTrack);
      if (onTrackReplaced) {
        await onTrackReplaced(newTrack);
      }

      return newTrack;
    } catch (err: unknown) {
      this.onDeviceError?.(err as Error, 'switchAudioInput');
      throw err;
    }
  }

  public async switchVideoInput(
    deviceId: string,
    currentStream: MediaStream | null,
    onTrackReplaced?: (newTrack: MediaStreamTrack) => Promise<void> | void
  ): Promise<MediaStreamTrack | null> {
    this.selectedVideoInputId = deviceId;
    this.notifyState();

    if (!currentStream) return null;

    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: { deviceId: { exact: deviceId } },
        audio: false,
      });

      const newTrack = newStream.getVideoTracks()[0];
      if (!newTrack) return null;

      // Stop and remove old video track
      const oldTrack = currentStream.getVideoTracks()[0];
      if (oldTrack) {
        currentStream.removeTrack(oldTrack);
        oldTrack.stop();
      }

      currentStream.addTrack(newTrack);
      if (onTrackReplaced) {
        await onTrackReplaced(newTrack);
      }

      return newTrack;
    } catch (err: unknown) {
      this.onDeviceError?.(err as Error, 'switchVideoInput');
      throw err;
    }
  }

  public async switchAudioOutput(deviceId: string, mediaElements: HTMLMediaElement[]): Promise<void> {
    this.selectedAudioOutputId = deviceId;
    this.notifyState();

    for (const el of mediaElements) {
      // HTMLMediaElement.setSinkId is non-standard but supported in Chromium browsers
      const sinkable = el as HTMLMediaElement & { setSinkId?: (id: string) => Promise<void> };
      if (typeof sinkable.setSinkId === 'function') {
        try {
          await sinkable.setSinkId(deviceId);
        } catch (err) {
          this.onDeviceError?.(err as Error, 'setSinkId');
        }
      }
    }
  }

  public getState(): AvailableMediaDevices {
    return {
      audioInputs: [...this.audioInputs],
      videoInputs: [...this.videoInputs],
      audioOutputs: [...this.audioOutputs],
      selectedAudioInputId: this.selectedAudioInputId,
      selectedVideoInputId: this.selectedVideoInputId,
      selectedAudioOutputId: this.selectedAudioOutputId,
      permissions: { ...this.permissions },
    };
  }

  private notifyState() {
    this.onStateChange?.(this.getState());
  }

  public destroy() {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
      navigator.mediaDevices.removeEventListener('devicechange', this.handleDeviceChange);
    }
  }
}
