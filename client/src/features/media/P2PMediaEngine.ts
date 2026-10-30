import { MediaEngine } from './MediaEngine';
import { MediaDeviceManager } from './MediaDeviceManager';
import { ScreenShareManager } from './ScreenShareManager';
import { PeerConnectionManager } from './PeerConnectionManager';
import type {
  MediaEngineInitOptions,
  LocalMediaState,
  RemotePeerMedia,
  ScreenShareOptions,
  SignalingDelegate,
  PeerConnectionStatus,
} from './media.types';

export class P2PMediaEngine extends MediaEngine {
  private localStream: MediaStream | null = null;
  private localState: LocalMediaState = {
    stream: null,
    screenStream: null,
    isAudioMuted: false,
    isVideoOff: false,
    isScreenSharing: false,
    hasScreenAudio: false,
  };

  private remotePeers = new Map<string, RemotePeerMedia>();
  private audioElements = new Map<string, HTMLAudioElement>();

  private deviceManager: MediaDeviceManager;
  private screenShareManager: ScreenShareManager;
  private peerManager: PeerConnectionManager | null = null;

  constructor() {
    super();

    this.deviceManager = new MediaDeviceManager(
      (devices) => this.options?.onDeviceStateChanged?.(devices),
      (err, ctx) => this.options?.onMediaError?.(err, ctx),
      async (permissions) => {
        if (
          (permissions.camera === 'granted' || permissions.microphone === 'granted') &&
          (!this.localStream || this.localStream.getTracks().length === 0)
        ) {
          try {
            await this.startLocalMedia();
          } catch {
            // Handled internally
          }
        }
      }
    );

    this.screenShareManager = new ScreenShareManager({
      onStarted: async (screenStream, hasAudio) => {
        this.localState.screenStream = screenStream;
        this.localState.isScreenSharing = true;
        this.localState.hasScreenAudio = hasAudio;

        // Replace video track across peer connections
        const screenVideoTrack = screenStream.getVideoTracks()[0];
        if (screenVideoTrack && this.peerManager) {
          await this.peerManager.replaceTrack('video', screenVideoTrack);
        }

        this.signaling?.sendMediaToggle({ isScreenSharing: true });
        this.notifyLocalState();
      },
      onEnded: async () => {
        this.localState.screenStream = null;
        this.localState.isScreenSharing = false;
        this.localState.hasScreenAudio = false;

        // Restore camera video track across peer connections
        const camTrack = this.localStream?.getVideoTracks()[0] || null;
        if (this.peerManager) {
          await this.peerManager.replaceTrack('video', camTrack);
        }

        this.signaling?.sendMediaToggle({ isScreenSharing: false });
        this.notifyLocalState();
      },
      onError: (err) => {
        this.options?.onMediaError?.(err, 'screenShare');
      },
    });
  }

  public async initialize(
    options: MediaEngineInitOptions,
    signaling: SignalingDelegate
  ): Promise<void> {
    this.options = options;
    this.signaling = signaling;

    this.localState.isAudioMuted = options.initialMuteAudio ?? false;
    this.localState.isVideoOff = options.initialTurnOffVideo ?? false;

    // Initialize peer connection manager
    this.peerManager = new PeerConnectionManager(
      options.localParticipantId,
      signaling,
      {
        onRemoteTrack: (remoteId, track, stream) => {
          this.handleRemoteTrackReceived(remoteId, track, stream);
        },
        onConnectionStatusChange: (remoteId, status) => {
          this.handleConnectionStatusChanged(remoteId, status);
        },
        onError: (err, remoteId) => {
          this.options?.onMediaError?.(err, `peerConnection:${remoteId}`);
        },
      },
      options.iceServers
    );

    // Initial enumeration of media devices
    await this.deviceManager.enumerateDevices();
  }

  public async startLocalMedia(constraints?: MediaStreamConstraints): Promise<MediaStream> {
    const defaultConstraints: MediaStreamConstraints = constraints || {
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user',
      },
    };

    try {
      const stream = await this.deviceManager.acquireUserMedia(defaultConstraints);
      this.localStream = stream;
      this.localState.stream = stream;

      // Apply initial muted / video off state to actual tracks
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !this.localState.isAudioMuted;
        if (this.peerManager) {
          await this.peerManager.replaceTrack('audio', audioTrack);
        }
      }

      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !this.localState.isVideoOff;
        if (this.peerManager && !this.localState.isScreenSharing) {
          await this.peerManager.replaceTrack('video', videoTrack);
        }
      }

      this.notifyLocalState();
      this.options?.onLocalStream?.(stream);
      return stream;
    } catch (err: unknown) {
      this.options?.onMediaError?.(err as Error, 'startLocalMedia');
      throw err;
    }
  }

  public async retryMedia(constraints?: MediaStreamConstraints): Promise<MediaStream> {
    await this.deviceManager.retryPermissions();
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
      this.localState.stream = null;
    }
    return this.startLocalMedia(constraints);
  }

  public stopLocalMedia(): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
      this.localState.stream = null;
      this.notifyLocalState();
    }
    this.screenShareManager.stop();
  }

  public async toggleMicrophone(enabled?: boolean): Promise<boolean> {
    const audioTrack = this.localStream?.getAudioTracks()[0];
    const newMuted = enabled !== undefined ? !enabled : !this.localState.isAudioMuted;

    if (audioTrack) {
      audioTrack.enabled = !newMuted;
    }

    this.localState.isAudioMuted = newMuted;
    this.signaling?.sendMediaToggle({ isMuted: newMuted });
    this.notifyLocalState();
    return !newMuted;
  }

  public async toggleCamera(enabled?: boolean): Promise<boolean> {
    const videoTrack = this.localStream?.getVideoTracks()[0];
    const newVideoOff = enabled !== undefined ? !enabled : !this.localState.isVideoOff;

    if (videoTrack) {
      videoTrack.enabled = !newVideoOff;
    }

    this.localState.isVideoOff = newVideoOff;
    this.signaling?.sendMediaToggle({ isVideoOff: newVideoOff });
    this.notifyLocalState();
    return !newVideoOff;
  }

  public async startScreenShare(options?: ScreenShareOptions): Promise<MediaStream> {
    return this.screenShareManager.start(options);
  }

  public async stopScreenShare(): Promise<void> {
    this.screenShareManager.stop();
  }

  public async setAudioInputDevice(deviceId: string): Promise<void> {
    await this.deviceManager.switchAudioInput(
      deviceId,
      this.localStream,
      async (newTrack) => {
        newTrack.enabled = !this.localState.isAudioMuted;
        if (this.peerManager) {
          await this.peerManager.replaceTrack('audio', newTrack);
        }
      }
    );
  }

  public async setVideoInputDevice(deviceId: string): Promise<void> {
    await this.deviceManager.switchVideoInput(
      deviceId,
      this.localStream,
      async (newTrack) => {
        newTrack.enabled = !this.localState.isVideoOff;
        if (this.peerManager && !this.localState.isScreenSharing) {
          await this.peerManager.replaceTrack('video', newTrack);
        }
      }
    );
  }

  public async setAudioOutputDevice(deviceId: string): Promise<void> {
    const mediaElements = Array.from(this.audioElements.values());
    await this.deviceManager.switchAudioOutput(deviceId, mediaElements);
  }

  /**
   * Adjust remote participant audio volume locally (0.0 to 1.0).
   * Does NOT alter sender's microphone level.
   */
  public setRemoteVolume(participantId: string, volume: number): void {
    const clamped = Math.max(0, Math.min(1, volume));
    const peer = this.remotePeers.get(participantId);
    if (peer) {
      peer.volume = clamped;
      const audioEl = this.audioElements.get(participantId);
      if (audioEl) {
        audioEl.volume = clamped;
      }
      this.options?.onRemotePeerUpdated?.({ ...peer });
    }
  }

  public registerPeer(participantId: string, displayName: string): void {
    if (!this.remotePeers.has(participantId)) {
      const peerMedia: RemotePeerMedia = {
        participantId,
        displayName,
        stream: null,
        screenStream: null,
        audioTrack: null,
        videoTrack: null,
        isAudioMuted: false,
        isVideoOff: false,
        isScreenSharing: false,
        volume: 1.0,
        connectionState: 'connecting',
      };
      this.remotePeers.set(participantId, peerMedia);
      this.options?.onRemotePeerUpdated?.({ ...peerMedia });
    }
  }

  public async handlePeerJoined(
    participantId: string,
    displayName: string,
    isInitiator: boolean
  ): Promise<void> {
    if (!this.remotePeers.has(participantId)) {
      const peerMedia: RemotePeerMedia = {
        participantId,
        displayName,
        stream: null,
        screenStream: null,
        audioTrack: null,
        videoTrack: null,
        isAudioMuted: false,
        isVideoOff: false,
        isScreenSharing: false,
        volume: 1.0,
        connectionState: 'connecting',
      };
      this.remotePeers.set(participantId, peerMedia);
      this.options?.onRemotePeerUpdated?.({ ...peerMedia });
    }

    if (this.peerManager) {
      const activeVideo = this.localState.isScreenSharing
        ? this.screenShareManager.getVideoTrack()
        : this.localStream?.getVideoTracks()[0] || null;

      const activeAudio = this.localStream?.getAudioTracks()[0] || null;
      const outboundStream = new MediaStream();
      if (activeAudio) outboundStream.addTrack(activeAudio);
      if (activeVideo) outboundStream.addTrack(activeVideo);

      this.peerManager.getOrCreatePeerConnection(participantId, outboundStream, isInitiator);
    }
  }

  public handlePeerLeft(participantId: string): void {
    this.peerManager?.closePeer(participantId);

    const audioEl = this.audioElements.get(participantId);
    if (audioEl) {
      audioEl.pause();
      audioEl.srcObject = null;
      audioEl.remove();
      this.audioElements.delete(participantId);
    }

    this.remotePeers.delete(participantId);
    this.options?.onRemotePeerRemoved?.(participantId);
  }

  public async handleSignalOffer(
    senderId: string,
    offer: RTCSessionDescriptionInit
  ): Promise<void> {
    if (!this.peerManager) return;
    try {
      await this.peerManager.handleOffer(senderId, offer, this.localStream);
    } catch (err) {
      console.warn(`[MediaEngine] Handled signal offer error from ${senderId}:`, err);
    }
  }

  public async handleSignalAnswer(
    senderId: string,
    answer: RTCSessionDescriptionInit
  ): Promise<void> {
    if (!this.peerManager) return;
    try {
      await this.peerManager.handleAnswer(senderId, answer);
    } catch (err) {
      console.warn(`[MediaEngine] Handled signal answer error from ${senderId}:`, err);
    }
  }

  public async handleSignalIceCandidate(
    senderId: string,
    candidate: RTCIceCandidateInit
  ): Promise<void> {
    if (!this.peerManager) return;
    try {
      await this.peerManager.handleIceCandidate(senderId, candidate);
    } catch (err) {
      console.warn(`[MediaEngine] Handled ICE candidate error from ${senderId}:`, err);
    }
  }

  public handlePeerMediaUpdated(
    participantId: string,
    media: { isMuted?: boolean; isVideoOff?: boolean; isScreenSharing?: boolean }
  ): void {
    const peer = this.remotePeers.get(participantId);
    if (peer) {
      if (media.isMuted !== undefined) peer.isAudioMuted = media.isMuted;
      if (media.isVideoOff !== undefined) peer.isVideoOff = media.isVideoOff;
      if (media.isScreenSharing !== undefined) peer.isScreenSharing = media.isScreenSharing;
      this.options?.onRemotePeerUpdated?.({ ...peer });
    }
  }

  private handleRemoteTrackReceived(
    remoteParticipantId: string,
    track: MediaStreamTrack,
    stream: MediaStream
  ): void {
    let peer = this.remotePeers.get(remoteParticipantId);
    if (!peer) {
      peer = {
        participantId: remoteParticipantId,
        displayName: 'Participant',
        stream,
        screenStream: null,
        audioTrack: null,
        videoTrack: null,
        isAudioMuted: false,
        isVideoOff: false,
        isScreenSharing: false,
        volume: 1.0,
        connectionState: 'connected',
      };
      this.remotePeers.set(remoteParticipantId, peer);
    } else {
      peer.stream = stream;
      peer.connectionState = 'connected';
    }

    if (track.kind === 'audio') {
      peer.audioTrack = track;
      this.attachRemoteAudio(remoteParticipantId, stream, peer.volume);
    } else if (track.kind === 'video') {
      peer.videoTrack = track;
    }

    this.options?.onRemotePeerUpdated?.({ ...peer });
  }

  private attachRemoteAudio(participantId: string, stream: MediaStream, volume: number): void {
    let audioEl = this.audioElements.get(participantId);
    if (!audioEl) {
      audioEl = new Audio();
      audioEl.autoplay = true;
      audioEl.style.display = 'none';
      document.body.appendChild(audioEl);
      this.audioElements.set(participantId, audioEl);
    }

    audioEl.srcObject = stream;
    audioEl.volume = Math.max(0, Math.min(1, volume));

    audioEl.play().catch(() => {
      // Autoplay policy might require user gesture
    });
  }

  private handleConnectionStatusChanged(
    remoteParticipantId: string,
    status: PeerConnectionStatus
  ): void {
    const peer = this.remotePeers.get(remoteParticipantId);
    if (peer) {
      peer.connectionState = status;
      this.options?.onRemotePeerUpdated?.({ ...peer });
    }
  }

  private notifyLocalState(): void {
    // Handled in reactive hooks
  }

  public getLocalState(): LocalMediaState {
    return { ...this.localState };
  }

  public getRemotePeers(): Map<string, RemotePeerMedia> {
    return new Map(this.remotePeers);
  }

  public destroy(): void {
    this.stopLocalMedia();
    this.peerManager?.closeAll();
    this.deviceManager.destroy();
    this.screenShareManager.destroy();

    this.audioElements.forEach((el) => {
      el.pause();
      el.srcObject = null;
      el.remove();
    });
    this.audioElements.clear();
    this.remotePeers.clear();
  }
}
