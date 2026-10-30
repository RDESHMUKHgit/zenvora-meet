import { useState, useEffect, useRef, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { P2PMediaEngine } from './P2PMediaEngine';
import type {
  RemotePeerMedia,
  AvailableMediaDevices,
  SignalingDelegate,
} from './media.types';

interface UseMediaEngineParams {
  meetingCode: string;
  participantId: string;
  displayName: string;
  socket: Socket | null;
  initialMuteAudio?: boolean;
  initialTurnOffVideo?: boolean;
}

export const useMediaEngine = ({
  meetingCode,
  participantId,
  displayName,
  socket,
  initialMuteAudio = false,
  initialTurnOffVideo = false,
}: UseMediaEngineParams) => {
  const engineRef = useRef<P2PMediaEngine | null>(null);

  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(initialMuteAudio);
  const [isVideoOff, setIsVideoOff] = useState<boolean>(initialTurnOffVideo);
  const [isScreenSharing, setIsScreenSharing] = useState<boolean>(false);
  const [remotePeers, setRemotePeers] = useState<Map<string, RemotePeerMedia>>(new Map());
  const [devices, setDevices] = useState<AvailableMediaDevices>({
    audioInputs: [],
    videoInputs: [],
    audioOutputs: [],
    selectedAudioInputId: null,
    selectedVideoInputId: null,
    selectedAudioOutputId: null,
    permissions: { camera: 'unknown', microphone: 'unknown' },
  });
  const [mediaError, setMediaError] = useState<string | null>(null);

  // Initialize engine
  useEffect(() => {
    if (!meetingCode || !participantId || !socket) return;

    const engine = new P2PMediaEngine();
    engineRef.current = engine;

    const signalingDelegate: SignalingDelegate = {
      sendOffer: (targetId, offer) => {
        socket.emit('signal:offer', {
          meetingCode,
          targetParticipantId: targetId,
          senderParticipantId: participantId,
          offer,
        });
      },
      sendAnswer: (targetId, answer) => {
        socket.emit('signal:answer', {
          meetingCode,
          targetParticipantId: targetId,
          senderParticipantId: participantId,
          answer,
        });
      },
      sendIceCandidate: (targetId, candidate) => {
        socket.emit('signal:ice-candidate', {
          meetingCode,
          targetParticipantId: targetId,
          senderParticipantId: participantId,
          candidate,
        });
      },
      sendMediaToggle: (media) => {
        socket.emit('media:toggle', {
          meetingCode,
          participantId,
          ...media,
        });
      },
    };

    engine
      .initialize(
        {
          meetingCode,
          localParticipantId: participantId,
          displayName,
          initialMuteAudio,
          initialTurnOffVideo,
          onLocalStream: (stream) => {
            setLocalStream(stream);
          },
          onRemotePeerUpdated: (peer) => {
            setRemotePeers((prev) => {
              const updated = new Map(prev);
              updated.set(peer.participantId, peer);
              return updated;
            });
          },
          onRemotePeerRemoved: (pId) => {
            setRemotePeers((prev) => {
              const updated = new Map(prev);
              updated.delete(pId);
              return updated;
            });
          },
          onDeviceStateChanged: (devState) => {
            setDevices(devState);
          },
          onMediaError: (err, ctx) => {
            console.error(`Media Engine Error [${ctx}]:`, err);
            setMediaError(`${err.message} (${ctx})`);
          },
        },
        signalingDelegate
      )
      .then(async () => {
        // Start local media tracks
        try {
          const stream = await engine.startLocalMedia();
          setLocalStream(stream);
        } catch {
          // Handled in onMediaError
        }
      });

    // Socket signaling listeners
    const handleSignalOffer = (data: { senderParticipantId: string; offer: RTCSessionDescriptionInit }) => {
      engine.handleSignalOffer(data.senderParticipantId, data.offer);
    };

    const handleSignalAnswer = (data: { senderParticipantId: string; answer: RTCSessionDescriptionInit }) => {
      engine.handleSignalAnswer(data.senderParticipantId, data.answer);
    };

    const handleSignalCandidate = (data: { senderParticipantId: string; candidate: RTCIceCandidateInit }) => {
      engine.handleSignalIceCandidate(data.senderParticipantId, data.candidate);
    };

    const handlePeerJoined = (data: { participant: { id: string; displayName: string } }) => {
      if (data.participant.id !== participantId) {
        // Initiate WebRTC connection to newly joined peer
        engine.handlePeerJoined(data.participant.id, data.participant.displayName, true);
      }
    };

    const handlePeerLeft = (data: { participantId: string }) => {
      engine.handlePeerLeft(data.participantId);
    };

    const handleMediaUpdated = (data: {
      participantId: string;
      isMuted?: boolean;
      isVideoOff?: boolean;
      isScreenSharing?: boolean;
    }) => {
      engine.handlePeerMediaUpdated(data.participantId, data);
    };

    const handleRoomJoined = (data: { room?: { participants?: { id: string; displayName?: string; name?: string }[] } }) => {
      if (data.room?.participants) {
        data.room.participants.forEach((p) => {
          if (p.id !== participantId) {
            engine.registerPeer(p.id, p.displayName || p.name || 'Participant');
          }
        });
      }
    };

    socket.on('signal:offer', handleSignalOffer);
    socket.on('signal:answer', handleSignalAnswer);
    socket.on('signal:ice-candidate', handleSignalCandidate);
    socket.on('room:joined', handleRoomJoined);
    socket.on('participant:joined', handlePeerJoined);
    socket.on('participant:left', handlePeerLeft);
    socket.on('participant:media-updated', handleMediaUpdated);

    return () => {
      socket.off('signal:offer', handleSignalOffer);
      socket.off('signal:answer', handleSignalAnswer);
      socket.off('signal:ice-candidate', handleSignalCandidate);
      socket.off('room:joined', handleRoomJoined);
      socket.off('participant:joined', handlePeerJoined);
      socket.off('participant:left', handlePeerLeft);
      socket.off('participant:media-updated', handleMediaUpdated);

      engine.destroy();
      engineRef.current = null;
    };
  }, [meetingCode, participantId, displayName, socket, initialMuteAudio, initialTurnOffVideo]);

  // Actions
  const toggleMicrophone = useCallback(async () => {
    if (!engineRef.current) return false;
    const active = await engineRef.current.toggleMicrophone();
    setIsAudioMuted(!active);
    return active;
  }, []);

  const toggleCamera = useCallback(async () => {
    if (!engineRef.current) return false;
    const active = await engineRef.current.toggleCamera();
    setIsVideoOff(!active);
    return active;
  }, []);

  const toggleScreenShare = useCallback(async () => {
    if (!engineRef.current) return false;
    if (isScreenSharing) {
      await engineRef.current.stopScreenShare();
      setIsScreenSharing(false);
      setScreenStream(null);
      return false;
    } else {
      try {
        const stream = await engineRef.current.startScreenShare();
        setIsScreenSharing(true);
        setScreenStream(stream);
        return true;
      } catch {
        return false;
      }
    }
  }, [isScreenSharing]);

  const setAudioInputDevice = useCallback(async (deviceId: string) => {
    await engineRef.current?.setAudioInputDevice(deviceId);
  }, []);

  const setVideoInputDevice = useCallback(async (deviceId: string) => {
    await engineRef.current?.setVideoInputDevice(deviceId);
  }, []);

  const setAudioOutputDevice = useCallback(async (deviceId: string) => {
    await engineRef.current?.setAudioOutputDevice(deviceId);
  }, []);

  const setRemoteVolume = useCallback((remoteId: string, volume: number) => {
    engineRef.current?.setRemoteVolume(remoteId, volume);
  }, []);

  const syncRoomParticipants = useCallback(
    (peers: { id: string; displayName?: string; name?: string }[]) => {
      peers.forEach((p) => {
        if (p.id !== participantId) {
          engineRef.current?.registerPeer(p.id, p.displayName || p.name || 'Participant');
        }
      });
    },
    [participantId]
  );

  // Accessible keyboard shortcuts: Ctrl/Cmd + D for mic, Ctrl/Cmd + E for cam
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Avoid capturing shortcuts while typing in an input, textarea, or contenteditable
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          target.getAttribute('role') === 'textbox')
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        toggleMicrophone();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        toggleCamera();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleMicrophone, toggleCamera]);

  const retryMediaAccess = useCallback(async (constraints?: MediaStreamConstraints): Promise<boolean> => {
    if (!engineRef.current) return false;
    try {
      setMediaError(null);
      const stream = await engineRef.current.retryMedia(constraints);
      setLocalStream(stream);
      return stream.getTracks().length > 0;
    } catch {
      return false;
    }
  }, []);

  return {
    localStream,
    screenStream,
    isAudioMuted,
    isVideoOff,
    isScreenSharing,
    remotePeers,
    devices,
    mediaError,
    toggleMicrophone,
    toggleCamera,
    toggleScreenShare,
    retryMediaAccess,
    setAudioInputDevice,
    setVideoInputDevice,
    setAudioOutputDevice,
    setRemoteVolume,
    syncRoomParticipants,
  };
};
