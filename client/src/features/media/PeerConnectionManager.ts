import type {
  PeerConnectionStatus,
  SignalingDelegate,
} from './media.types';

export interface PeerConnectionCallbacks {
  onRemoteTrack: (remoteParticipantId: string, track: MediaStreamTrack, stream: MediaStream) => void;
  onConnectionStatusChange: (remoteParticipantId: string, status: PeerConnectionStatus) => void;
  onError: (error: Error, remoteParticipantId: string) => void;
}

export class PeerConnectionManager {
  private localParticipantId: string;
  private iceServers: RTCIceServer[];
  private signaling: SignalingDelegate;
  private callbacks: PeerConnectionCallbacks;

  // Remote ID -> RTCPeerConnection
  private peerConnections = new Map<string, RTCPeerConnection>();
  // Remote ID -> pending ICE candidates queue
  private candidateQueues = new Map<string, RTCIceCandidateInit[]>();
  // Remote ID -> making offer lock (Perfect negotiation)
  private makingOfferMap = new Map<string, boolean>();
  // Remote ID -> remote streams
  private remoteStreams = new Map<string, MediaStream>();

  constructor(
    localParticipantId: string,
    signaling: SignalingDelegate,
    callbacks: PeerConnectionCallbacks,
    customIceServers?: RTCIceServer[]
  ) {
    this.localParticipantId = localParticipantId;
    this.signaling = signaling;
    this.callbacks = callbacks;

    // Default STUN servers and optional environment-configured TURN
    this.iceServers = customIceServers || this.buildDefaultIceServers();
  }

  private buildDefaultIceServers(): RTCIceServer[] {
    const servers: RTCIceServer[] = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ];

    const turnUrl = import.meta.env.VITE_TURN_URL;
    const turnUsername = import.meta.env.VITE_TURN_USERNAME;
    const turnCredential = import.meta.env.VITE_TURN_CREDENTIAL;

    if (turnUrl) {
      servers.push({
        urls: turnUrl,
        username: turnUsername,
        credential: turnCredential,
      });
    }

    return servers;
  }

  /**
   * Deterministic "politeness" based on lexical comparison of participant IDs.
   * Ensures zero glare during simultaneous SDP negotiation.
   */
  private isPolitePeer(remoteParticipantId: string): boolean {
    return this.localParticipantId > remoteParticipantId;
  }

  public getOrCreatePeerConnection(
    remoteParticipantId: string,
    localStream: MediaStream | null,
    isInitiator: boolean
  ): RTCPeerConnection {
    let pc = this.peerConnections.get(remoteParticipantId);
    if (pc) return pc;

    pc = new RTCPeerConnection({
      iceServers: this.iceServers,
      iceCandidatePoolSize: 2,
    });

    this.peerConnections.set(remoteParticipantId, pc);
    this.candidateQueues.set(remoteParticipantId, []);
    this.makingOfferMap.set(remoteParticipantId, false);

    // Add local media tracks if available
    if (localStream) {
      localStream.getTracks().forEach((track) => {
        pc?.addTrack(track, localStream);
      });
    }

    // ICE Candidate event
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        this.signaling.sendIceCandidate(remoteParticipantId, event.candidate.toJSON());
      }
    };

    // Track arrival event
    pc.ontrack = (event) => {
      let stream = this.remoteStreams.get(remoteParticipantId);
      if (!stream) {
        stream = event.streams[0] || new MediaStream();
        this.remoteStreams.set(remoteParticipantId, stream);
      }

      if (!stream.getTracks().some((t) => t.id === event.track.id)) {
        stream.addTrack(event.track);
      }

      this.callbacks.onRemoteTrack(remoteParticipantId, event.track, stream);
    };

    // Connection state monitoring
    pc.onconnectionstatechange = () => {
      const state = (pc?.connectionState as PeerConnectionStatus) || 'new';
      this.callbacks.onConnectionStatusChange(remoteParticipantId, state);

      if (state === 'failed') {
        // Attempt ICE restart on failure
        this.restartIce(remoteParticipantId);
      }
    };

    pc.oniceconnectionstatechange = () => {
      const iceState = pc?.iceConnectionState;
      if (iceState === 'disconnected' || iceState === 'failed') {
        this.callbacks.onConnectionStatusChange(remoteParticipantId, 'reconnecting');
      } else if (iceState === 'connected' || iceState === 'completed') {
        this.callbacks.onConnectionStatusChange(remoteParticipantId, 'connected');
      }
    };

    // Perfect Negotiation pattern
    pc.onnegotiationneeded = async () => {
      try {
        this.makingOfferMap.set(remoteParticipantId, true);
        await pc.setLocalDescription();
        if (pc.localDescription) {
          this.signaling.sendOffer(remoteParticipantId, pc.localDescription);
        }
      } catch (err: unknown) {
        this.callbacks.onError(err as Error, remoteParticipantId);
      } finally {
        this.makingOfferMap.set(remoteParticipantId, false);
      }
    };

    // If initiator and has tracks, trigger offer
    if (isInitiator && localStream && localStream.getTracks().length > 0) {
      this.initiateOffer(remoteParticipantId, pc);
    }

    return pc;
  }

  private async initiateOffer(remoteParticipantId: string, pc: RTCPeerConnection) {
    try {
      this.makingOfferMap.set(remoteParticipantId, true);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.signaling.sendOffer(remoteParticipantId, offer);
    } catch (err: unknown) {
      this.callbacks.onError(err as Error, remoteParticipantId);
    } finally {
      this.makingOfferMap.set(remoteParticipantId, false);
    }
  }

  public async handleOffer(
    remoteParticipantId: string,
    offer: RTCSessionDescriptionInit,
    localStream: MediaStream | null
  ): Promise<void> {
    try {
      const pc = this.getOrCreatePeerConnection(remoteParticipantId, localStream, false);
      const isPolite = this.isPolitePeer(remoteParticipantId);
      const isMakingOffer = this.makingOfferMap.get(remoteParticipantId) || false;

      const offerCollision = isMakingOffer || pc.signalingState !== 'stable';
      if (offerCollision) {
        if (!isPolite) {
          // Impolite peer ignores incoming offer
          return;
        }
        // Polite peer rolls back local description to accept remote offer
        if (pc.signalingState !== 'stable') {
          await pc.setLocalDescription({ type: 'rollback' });
        }
      }

      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      // Process any queued ICE candidates
      await this.processQueuedCandidates(remoteParticipantId, pc);

      // Create and send answer if in appropriate signaling state
      if (pc.signalingState === 'have-remote-offer') {
        const answer = await pc.createAnswer();
        if (pc.signalingState === 'have-remote-offer') {
          await pc.setLocalDescription(answer);
          this.signaling.sendAnswer(remoteParticipantId, answer);
        }
      }
    } catch (err) {
      console.warn(`[WebRTC] Safe handled offer negotiation for peer ${remoteParticipantId}:`, err);
    }
  }

  public async handleAnswer(
    remoteParticipantId: string,
    answer: RTCSessionDescriptionInit
  ): Promise<void> {
    try {
      const pc = this.peerConnections.get(remoteParticipantId);
      if (!pc) return;

      if (pc.signalingState === 'have-local-offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        await this.processQueuedCandidates(remoteParticipantId, pc);
      }
    } catch (err) {
      console.warn(`[WebRTC] Safe handled answer negotiation for peer ${remoteParticipantId}:`, err);
    }
  }

  public async handleIceCandidate(
    remoteParticipantId: string,
    candidate: RTCIceCandidateInit
  ): Promise<void> {
    const pc = this.peerConnections.get(remoteParticipantId);
    if (!pc || !pc.remoteDescription) {
      // Queue until remote description is set
      const queue = this.candidateQueues.get(remoteParticipantId) || [];
      queue.push(candidate);
      this.candidateQueues.set(remoteParticipantId, queue);
      return;
    }

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (err) {
      this.callbacks.onError(err as Error, remoteParticipantId);
    }
  }

  private async processQueuedCandidates(remoteParticipantId: string, pc: RTCPeerConnection) {
    const queue = this.candidateQueues.get(remoteParticipantId) || [];
    while (queue.length > 0) {
      const candidate = queue.shift();
      if (candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (err) {
          this.callbacks.onError(err as Error, remoteParticipantId);
        }
      }
    }
  }

  /**
   * Seamlessly replaces a local track (e.g. mic switch, cam switch, screen share toggle)
   * across all active peer connections without dropping WebRTC connections.
   */
  public async replaceTrack(kind: 'audio' | 'video', newTrack: MediaStreamTrack | null): Promise<void> {
    for (const [remoteId, pc] of this.peerConnections.entries()) {
      const sender = pc.getSenders().find((s) => s.track && s.track.kind === kind);
      if (sender) {
        try {
          await sender.replaceTrack(newTrack);
        } catch (err) {
          this.callbacks.onError(err as Error, remoteId);
        }
      } else if (newTrack) {
        // If no sender existed for this track kind, add it
        pc.addTrack(newTrack);
      }
    }
  }

  public restartIce(remoteParticipantId: string): void {
    const pc = this.peerConnections.get(remoteParticipantId);
    if (pc) {
      try {
        pc.restartIce();
      } catch {
        // Fallback for older browsers
        this.initiateOffer(remoteParticipantId, pc);
      }
    }
  }

  public getRemoteStream(remoteParticipantId: string): MediaStream | null {
    return this.remoteStreams.get(remoteParticipantId) || null;
  }

  public closePeer(remoteParticipantId: string): void {
    const pc = this.peerConnections.get(remoteParticipantId);
    if (pc) {
      pc.ontrack = null;
      pc.onicecandidate = null;
      pc.onconnectionstatechange = null;
      pc.oniceconnectionstatechange = null;
      pc.onnegotiationneeded = null;

      pc.getSenders().forEach((sender) => {
        try {
          pc.removeTrack(sender);
        } catch {
          // Ignore
        }
      });

      pc.close();
      this.peerConnections.delete(remoteParticipantId);
    }

    const stream = this.remoteStreams.get(remoteParticipantId);
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
      this.remoteStreams.delete(remoteParticipantId);
    }

    this.candidateQueues.delete(remoteParticipantId);
    this.makingOfferMap.delete(remoteParticipantId);
  }

  public closeAll(): void {
    for (const remoteId of Array.from(this.peerConnections.keys())) {
      this.closePeer(remoteId);
    }
    this.remoteStreams.clear();
    this.candidateQueues.clear();
    this.makingOfferMap.clear();
  }
}

