/**
 * WebRTC and Media Feature Type Definitions
 */

export type PeerConnectionStatus =
  | 'new'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'failed'
  | 'disconnected'
  | 'closed';

export interface DevicePermissionState {
  camera: 'granted' | 'denied' | 'prompt' | 'unknown';
  microphone: 'granted' | 'denied' | 'prompt' | 'unknown';
}

export interface AvailableMediaDevices {
  audioInputs: MediaDeviceInfo[];
  videoInputs: MediaDeviceInfo[];
  audioOutputs: MediaDeviceInfo[];
  selectedAudioInputId: string | null;
  selectedVideoInputId: string | null;
  selectedAudioOutputId: string | null;
  permissions: DevicePermissionState;
}

export interface LocalMediaState {
  stream: MediaStream | null;
  screenStream: MediaStream | null;
  isAudioMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  hasScreenAudio: boolean;
}

export interface RemotePeerMedia {
  participantId: string;
  displayName: string;
  stream: MediaStream | null;
  screenStream: MediaStream | null;
  audioTrack: MediaStreamTrack | null;
  videoTrack: MediaStreamTrack | null;
  isAudioMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  volume: number; // 0.0 to 1.0 (local user adjustment)
  connectionState: PeerConnectionStatus;
}

export interface MediaEngineInitOptions {
  meetingCode: string;
  localParticipantId: string;
  displayName: string;
  initialMuteAudio?: boolean;
  initialTurnOffVideo?: boolean;
  iceServers?: RTCIceServer[];
  onLocalStream?: (stream: MediaStream) => void;
  onRemotePeerUpdated?: (peer: RemotePeerMedia) => void;
  onRemotePeerRemoved?: (participantId: string) => void;
  onDeviceStateChanged?: (devices: AvailableMediaDevices) => void;
  onMediaError?: (error: Error, context: string) => void;
}

export interface ScreenShareOptions {
  captureSystemAudio?: boolean;
}

export interface SignalingDelegate {
  sendOffer(targetParticipantId: string, offer: RTCSessionDescriptionInit): void;
  sendAnswer(targetParticipantId: string, answer: RTCSessionDescriptionInit): void;
  sendIceCandidate(targetParticipantId: string, candidate: RTCIceCandidateInit): void;
  sendMediaToggle(media: { isMuted?: boolean; isVideoOff?: boolean; isScreenSharing?: boolean }): void;
}

export interface IMediaEngine {
  initialize(options: MediaEngineInitOptions, signaling: SignalingDelegate): Promise<void>;
  startLocalMedia(constraints?: MediaStreamConstraints): Promise<MediaStream>;
  stopLocalMedia(): void;
  toggleMicrophone(enabled?: boolean): Promise<boolean>;
  toggleCamera(enabled?: boolean): Promise<boolean>;
  startScreenShare(options?: ScreenShareOptions): Promise<MediaStream>;
  stopScreenShare(): Promise<void>;
  setAudioInputDevice(deviceId: string): Promise<void>;
  setVideoInputDevice(deviceId: string): Promise<void>;
  setAudioOutputDevice(deviceId: string): Promise<void>;
  setRemoteVolume(participantId: string, volume: number): void;
  registerPeer(participantId: string, displayName: string): void;
  handlePeerJoined(participantId: string, displayName: string, isInitiator: boolean): Promise<void>;
  handlePeerLeft(participantId: string): void;
  handleSignalOffer(senderId: string, offer: RTCSessionDescriptionInit): Promise<void>;
  handleSignalAnswer(senderId: string, answer: RTCSessionDescriptionInit): Promise<void>;
  handleSignalIceCandidate(senderId: string, candidate: RTCIceCandidateInit): Promise<void>;
  handlePeerMediaUpdated(
    participantId: string,
    media: { isMuted?: boolean; isVideoOff?: boolean; isScreenSharing?: boolean }
  ): void;
  getLocalState(): LocalMediaState;
  getRemotePeers(): Map<string, RemotePeerMedia>;
  destroy(): void;
}
