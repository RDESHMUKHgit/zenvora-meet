import type {
  IMediaEngine,
  MediaEngineInitOptions,
  LocalMediaState,
  RemotePeerMedia,
  ScreenShareOptions,
  SignalingDelegate,
} from './media.types';

/**
 * Base abstract class for RD Video Meet Media Engines.
 * Designed to cleanly abstract the transport layer (Phase 1 P2P Mesh vs. Phase 2 SFU).
 */
export abstract class MediaEngine implements IMediaEngine {
  protected options: MediaEngineInitOptions | null = null;
  protected signaling: SignalingDelegate | null = null;

  abstract initialize(options: MediaEngineInitOptions, signaling: SignalingDelegate): Promise<void>;
  abstract startLocalMedia(constraints?: MediaStreamConstraints): Promise<MediaStream>;
  abstract stopLocalMedia(): void;
  abstract toggleMicrophone(enabled?: boolean): Promise<boolean>;
  abstract toggleCamera(enabled?: boolean): Promise<boolean>;
  abstract startScreenShare(options?: ScreenShareOptions): Promise<MediaStream>;
  abstract stopScreenShare(): Promise<void>;
  abstract setAudioInputDevice(deviceId: string): Promise<void>;
  abstract setVideoInputDevice(deviceId: string): Promise<void>;
  abstract setAudioOutputDevice(deviceId: string): Promise<void>;
  abstract setRemoteVolume(participantId: string, volume: number): void;
  abstract registerPeer(participantId: string, displayName: string): void;
  abstract handlePeerJoined(participantId: string, displayName: string, isInitiator: boolean): Promise<void>;
  abstract handlePeerLeft(participantId: string): void;
  abstract handleSignalOffer(senderId: string, offer: RTCSessionDescriptionInit): Promise<void>;
  abstract handleSignalAnswer(senderId: string, answer: RTCSessionDescriptionInit): Promise<void>;
  abstract handleSignalIceCandidate(senderId: string, candidate: RTCIceCandidateInit): Promise<void>;
  abstract handlePeerMediaUpdated(
    participantId: string,
    media: { isMuted?: boolean; isVideoOff?: boolean; isScreenSharing?: boolean }
  ): void;
  abstract getLocalState(): LocalMediaState;
  abstract getRemotePeers(): Map<string, RemotePeerMedia>;
  abstract destroy(): void;
}
