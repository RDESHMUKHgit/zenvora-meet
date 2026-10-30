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
  private onPermissionChange?: (permissions: DevicePermissionState) => void;

  constructor(
    onStateChange?: (state: AvailableMediaDevices) => void,
    onDeviceError?: (error: Error, context: string) => void,
    onPermissionChange?: (permissions: DevicePermissionState) => void
  ) {
    this.onStateChange = onStateChange;
    this.onDeviceError = onDeviceError;
    this.onPermissionChange = onPermissionChange;

    if (typeof navigator !== 'undefined' && navigator.mediaDevices) {
      navigator.mediaDevices.addEventListener('devicechange', this.handleDeviceChange);
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', this.handleWindowFocus);
    }
  }

  private handleDeviceChange = async () => {
    try {
      await this.enumerateDevices();
    } catch (err: unknown) {
      this.onDeviceError?.(err as Error, 'devicechange');
    }
  };

  private handleWindowFocus = async () => {
    try {
      const prevCam = this.permissions.camera;
      const prevMic = this.permissions.microphone;
      const updated = await this.checkPermissions();
      if (
        (prevCam === 'denied' && updated.camera !== 'denied') ||
        (prevMic === 'denied' && updated.microphone !== 'denied')
      ) {
        this.notifyState();
        this.onPermissionChange?.(updated);
      }
    } catch {
      // Ignore background check errors
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
        const changed = this.permissions.camera !== camStatus.state;
        this.permissions.camera = camStatus.state;
        this.notifyState();
        if (changed) {
          this.onPermissionChange?.(this.permissions);
        }
      };
    } catch {
      // permissions query for camera not supported in all browsers
    }

    try {
      // Check microphone permission
      const micStatus = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      this.permissions.microphone = micStatus.state;
      micStatus.onchange = () => {
        const changed = this.permissions.microphone !== micStatus.state;
        this.permissions.microphone = micStatus.state;
        this.notifyState();
        if (changed) {
          this.onPermissionChange?.(this.permissions);
        }
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
    if (
      typeof window !== 'undefined' &&
      !window.isSecureContext &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1'
    ) {
      throw new Error(
        'Camera and microphone access requires HTTPS or localhost in modern web browsers.'
      );
    }

    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      throw new Error('navigator.mediaDevices.getUserMedia is not supported by this browser');
    }

    // Attempt primary acquisition (both audio & video together)
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (constraints.video) this.permissions.camera = 'granted';
      if (constraints.audio) this.permissions.microphone = 'granted';

      // Re-enumerate to get labeled devices now that permission is granted
      await this.enumerateDevices();
      this.notifyState();
      return stream;
    } catch (primaryErr: unknown) {
      const error = primaryErr as Error;

      // Graceful fallback: If both were requested, try acquiring audio and video independently
      if (constraints.audio && constraints.video) {
        let audioStream: MediaStream | null = null;
        let videoStream: MediaStream | null = null;

        // Try audio separately
        try {
          audioStream = await navigator.mediaDevices.getUserMedia({
            audio: constraints.audio,
            video: false,
          });
          this.permissions.microphone = 'granted';
        } catch (audioErr: unknown) {
          const aErr = audioErr as Error;
          if (aErr.name === 'NotAllowedError' || aErr.name === 'PermissionDeniedError') {
            this.permissions.microphone = 'denied';
          }
        }

        // Try video separately
        try {
          videoStream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: constraints.video,
          });
          this.permissions.camera = 'granted';
        } catch (videoErr: unknown) {
          const vErr = videoErr as Error;
          if (vErr.name === 'NotAllowedError' || vErr.name === 'PermissionDeniedError') {
            this.permissions.camera = 'denied';
          }
        }

        // If at least one track succeeded, assemble combined stream
        if (audioStream || videoStream) {
          const combined = new MediaStream();
          audioStream?.getAudioTracks().forEach((t) => combined.addTrack(t));
          videoStream?.getVideoTracks().forEach((t) => combined.addTrack(t));

          await this.enumerateDevices();
          this.notifyState();
          return combined;
        }
      }

      // Both failed or single-stream failed
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        if (constraints.video) this.permissions.camera = 'denied';
        if (constraints.audio) this.permissions.microphone = 'denied';
        this.notifyState();
        throw new Error('Camera or microphone permission was denied. Please allow access in browser settings.', {
          cause: primaryErr,
        });
      }

      if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        throw new Error('No camera or microphone device was found on this system.', { cause: primaryErr });
      }

      if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        throw new Error('Camera or microphone is already in use by another application.', { cause: primaryErr });
      }

      throw error;
    }
  }

  public async retryPermissions(): Promise<DevicePermissionState> {
    await this.checkPermissions();
    await this.enumerateDevices();
    return this.permissions;
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
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', this.handleWindowFocus);
    }
  }
}
