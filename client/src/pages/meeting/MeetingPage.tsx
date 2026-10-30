import React, { useState, useEffect, useCallback } from 'react';
import {
  Typography,
  Button,
  Result,
  Spin,
  Modal,
  App,
  Dropdown,
  Select,
  Drawer,
  Alert,
  type MenuProps,
} from 'antd';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import {
  Copy,
  Check,
  ShieldCheck,
  Clock,
  Settings,
  Users,
  PhoneOff,
  LogOut,
  Mic,
  Video,
  Volume2,
  CheckCircle2,
  AlertTriangle,
  Download,
  WifiOff,
  Radio,
  FileVideo,
} from 'lucide-react';
import { useAuth } from '../../contexts';
import { useDocumentTitle } from '../../hooks';
import { meetingApi } from '../../services/meeting.service';
import { connectSocket, getSocket } from '../../services/socket.service';
import {
  VideoGrid,
  MeetingControlDock,
  ParticipantSidebar,
  type ParticipantItem,
} from '../../components/meeting';
import { ChatPanel, type ChatMessage } from '../../components/chat';
import { useMediaEngine } from '../../features/media';
import { useScreenRecorder } from '../../features/recording';
import { ROUTES } from '../../constants';
import { tokens } from '../../styles/tokens';
import type { MeetingRecord } from '../../types';

const { Title, Text } = Typography;

export const MeetingPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { message } = App.useApp();

  const stateData =
    (location.state as {
      meetingTitle?: string;
      displayName?: string;
      participantId?: string;
      hostToken?: string;
      role?: 'host' | 'participant';
      muteMic?: boolean;
      turnOffCam?: boolean;
      meetingRecord?: MeetingRecord;
    }) || {};

  const [meeting, setMeeting] = useState<MeetingRecord | null>(stateData.meetingRecord || null);
  const [loading, setLoading] = useState(!stateData.meetingRecord);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Participant identity
  const [participantId] = useState<string>(() => {
    return (
      stateData.participantId ||
      localStorage.getItem(`rd_p_id_${id}`) ||
      crypto.randomUUID()
    );
  });

  const [hostToken] = useState<string | undefined>(() => {
    return (
      stateData.hostToken ||
      localStorage.getItem(`rd_host_token_${id}`) ||
      undefined
    );
  });

  const [displayName] = useState<string>(() => {
    return stateData.displayName || user?.name || 'Guest User';
  });

  const [myRole, setMyRole] = useState<'host' | 'cohost' | 'participant'>(stateData.role || 'participant');
  const [copiedLink, setCopiedLink] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'chat' | 'roster' | null>(null);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [participants, setParticipants] = useState<ParticipantItem[]>([]);
  const [endModalOpen, setEndModalOpen] = useState(false);
  const [deviceSettingsOpen, setDeviceSettingsOpen] = useState(false);
  const [socketConnected, setSocketConnected] = useState(true);
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 768 : false));

  useDocumentTitle(meeting ? `${meeting.title} · Meeting` : 'Conference Meeting');

  // Handle window resize for mobile vs desktop responsive layout
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Real WebRTC Media Engine
  const {
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
    setAudioInputDevice,
    setVideoInputDevice,
    setAudioOutputDevice,
    setRemoteVolume,
    syncRoomParticipants,
  } = useMediaEngine({
    meetingCode: id || '',
    participantId,
    displayName,
    socket: getSocket(),
    initialMuteAudio: stateData.muteMic ?? false,
    initialTurnOffVideo: stateData.turnOffCam ?? false,
  });

  // MediaRecorder Screen Share Recording
  const {
    recordingState,
    durationSeconds: recordDurationSeconds,
    recordingResult,
    consentModalOpen,
    downloadModalOpen,
    recordingError,
    requestStartRecording,
    confirmStartRecording,
    cancelConsent,
    pauseRecording,
    resumeRecording,
    stopRecording,
    discardRecording,
    downloadRecording,
  } = useScreenRecorder();

  // Notify on media device errors or recording errors
  useEffect(() => {
    if (mediaError) {
      message.error(mediaError);
    }
  }, [mediaError, message]);

  useEffect(() => {
    if (recordingError) {
      message.error(recordingError);
    }
  }, [recordingError, message]);

  // Load and verify meeting from PostgreSQL backend
  const verifyRoom = useCallback(async () => {
    if (!id) {
      setLoadError('No meeting ID provided');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setLoadError(null);
      const data = await meetingApi.getMeetingByCode(id);
      setMeeting(data.meeting);

      // Join room in backend if not already joined in state
      if (!stateData.participantId) {
        const joinRes = await meetingApi.joinMeeting(id, displayName);
        setMyRole(joinRes.participant.role);
        localStorage.setItem(`rd_p_id_${id}`, joinRes.participant.id);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : `Meeting room '${id}' not found or has expired`;
      setLoadError(msg);
    } finally {
      setLoading(false);
    }
  }, [id, displayName, stateData.participantId]);

  useEffect(() => {
    if (!meeting) {
      verifyRoom();
    }
  }, [meeting, verifyRoom]);

  // Meeting duration timer
  useEffect(() => {
    const timer = setInterval(() => {
      setDurationSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Socket.IO Room Lifecycle & Messaging Integration
  useEffect(() => {
    if (!id || !meeting) return;

    const socket = connectSocket();

    const onConnect = () => setSocketConnected(true);
    const onDisconnect = () => setSocketConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    // 1. Join Socket Room
    socket.emit('room:join', {
      meetingCode: id,
      participantId,
      displayName,
      hostToken,
      userId: user?.id || null,
      isMuted: isAudioMuted,
      isVideoOff,
    });

    // 2. Room Joined Confirmation
    socket.on('room:joined', (payload: {
      meetingCode: string;
      participant: ParticipantItem;
      room: { participants: ParticipantItem[] };
    }) => {
      if (payload.participant.role) {
        setMyRole(payload.participant.role);
      }
      if (payload.room?.participants) {
        setParticipants(
          payload.room.participants.map((p) => ({
            ...p,
            isSelf: p.id === participantId,
          }))
        );
        syncRoomParticipants(payload.room.participants);
      }
    });

    // 3. Live Participants List Update
    socket.on('room:participants', (payload: { participants: ParticipantItem[]; count: number }) => {
      if (payload.participants) {
        setParticipants(
          payload.participants.map((p) => ({
            ...p,
            isSelf: p.id === participantId,
          }))
        );
        syncRoomParticipants(payload.participants);
      }
    });

    // 4. Participant Joined notification
    socket.on('participant:joined', (payload: { participant: ParticipantItem }) => {
      const name = payload.participant.displayName || payload.participant.name;
      message.info(`${name} joined the room`);
    });

    // 5. Participant Left notification
    socket.on('participant:left', (payload: { participantId: string; displayName: string }) => {
      message.info(`${payload.displayName} left the room`);
    });

    // 6. Media State Updates from peers
    socket.on(
      'participant:media-updated',
      (payload: { participantId: string; isMuted?: boolean; isVideoOff?: boolean; isScreenSharing?: boolean }) => {
        setParticipants((prev) =>
          prev.map((p) =>
            p.id === payload.participantId
              ? {
                  ...p,
                  isMuted: payload.isMuted !== undefined ? payload.isMuted : p.isMuted,
                  isVideoOff: payload.isVideoOff !== undefined ? payload.isVideoOff : p.isVideoOff,
                  isScreenSharing:
                    payload.isScreenSharing !== undefined
                      ? payload.isScreenSharing
                      : p.isScreenSharing,
                }
              : p
          )
        );
      }
    );

    // 7. In-Call Chat Messaging
    socket.on(
      'chat:message',
      (payload: {
        id: string;
        senderParticipantId: string;
        senderName: string;
        content: string;
        timestamp: string;
      }) => {
        const isSelf = payload.senderParticipantId === participantId;
        const msgTime = new Date(payload.timestamp).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        });

        const newMsg: ChatMessage = {
          id: payload.id,
          senderName: payload.senderName,
          isSelf,
          content: payload.content,
          timestamp: msgTime,
        };

        setMessages((prev) => [...prev, newMsg]);

        if (!isSelf && sidebarTab !== 'chat') {
          setUnreadChatCount((prev) => prev + 1);
        }
      }
    );

    // 8. Host Mute All Command
    socket.on('host:mute-all', () => {
      if (myRole !== 'host') {
        if (!isAudioMuted) {
          toggleMicrophone();
        }
        message.warning('The host has muted your microphone');
      }
    });

    // 9. Meeting Ended by Host
    socket.on('meeting:ended', (payload: { reason?: string }) => {
      Modal.info({
        title: 'Meeting Ended',
        content: payload.reason || 'The host has ended this meeting for all participants.',
        okText: 'Return to Homepage',
        onOk: () => {
          navigate(ROUTES.HOME);
        },
      });
      setTimeout(() => {
        navigate(ROUTES.HOME);
      }, 3500);
    });

    // 10. Room Errors
    socket.on('room:error', (payload: { message: string }) => {
      message.error(payload.message || 'Room error encountered');
    });

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('room:joined');
      socket.off('room:participants');
      socket.off('participant:joined');
      socket.off('participant:left');
      socket.off('participant:media-updated');
      socket.off('chat:message');
      socket.off('host:mute-all');
      socket.off('meeting:ended');
      socket.off('room:error');
    };
  }, [
    id,
    meeting,
    participantId,
    displayName,
    hostToken,
    user?.id,
    myRole,
    isAudioMuted,
    isVideoOff,
    sidebarTab,
    syncRoomParticipants,
    toggleMicrophone,
    message,
    navigate,
  ]);

  const formatDuration = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleCopyLink = () => {
    const link = window.location.href;
    navigator.clipboard.writeText(link);
    setCopiedLink(true);
    message.success('Invite link copied to clipboard');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  // Leave room (participant or host leave)
  const handleLeaveRoom = async () => {
    if (id) {
      const socket = connectSocket();
      socket.emit('room:leave', { meetingCode: id, participantId });
      await meetingApi.leaveMeeting(id, participantId);
    }
    message.info('You left the meeting');
    navigate(ROUTES.HOME);
  };

  // Explicit termination by host for everyone
  const handleEndMeetingForEveryone = async () => {
    if (!id) return;
    try {
      await meetingApi.endMeeting(id, hostToken);
      message.success('Meeting ended for all participants');
      navigate(ROUTES.HOME);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to end meeting';
      message.error(msg);
    }
  };

  const handleMuteAll = () => {
    if (id && myRole === 'host') {
      const socket = connectSocket();
      socket.emit('host:action', {
        meetingCode: id,
        hostToken,
        userId: user?.id || null,
        action: 'mute-all',
      });
      message.success('Mute all request sent');
    }
  };

  const handleSendMessage = (content: string) => {
    if (!id || !content.trim()) return;
    const socket = connectSocket();
    socket.emit('chat:message', {
      meetingCode: id,
      participantId,
      content: content.trim(),
    });
  };

  const handleToggleChat = () => {
    setSidebarTab((prev) => {
      const next = prev === 'chat' ? null : 'chat';
      if (next === 'chat') {
        setUnreadChatCount(0);
      }
      return next;
    });
  };

  const handleToggleRoster = () => {
    setSidebarTab((prev) => (prev === 'roster' ? null : 'roster'));
  };

  // Synchronize local states with display list
  const displayParticipants: ParticipantItem[] =
    participants.length > 0
      ? participants.map((p) =>
          p.id === participantId
            ? {
                ...p,
                isMuted: isAudioMuted,
                isVideoOff: isVideoOff,
                isScreenSharing: isScreenSharing,
                isSelf: true,
              }
            : p
        )
      : [
          {
            id: participantId,
            name: displayName,
            role: myRole,
            isMuted: isAudioMuted,
            isVideoOff: isVideoOff,
            isScreenSharing: isScreenSharing,
            isSelf: true,
          },
        ];

  if (loading) {
    return (
      <div
        style={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          backgroundColor: tokens.colors.surfaceSecondary,
        }}
      >
        <Spin size="large" />
        <div style={{ fontSize: '15px', color: tokens.colors.textSecondary, fontWeight: 500 }}>
          Securing connection to meeting room...
        </div>
      </div>
    );
  }

  if (loadError || !meeting) {
    return (
      <div
        style={{
          width: '100vw',
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: tokens.colors.surfaceSecondary,
        }}
      >
        <div style={{ maxWidth: '520px', padding: '24px' }}>
          <Result
            status="404"
            title="Meeting Not Found or Ended"
            subTitle={loadError || `The meeting code '${id}' does not exist or has expired.`}
            extra={[
              <Button type="primary" key="home" onClick={() => navigate(ROUTES.HOME)}>
                Return to Homepage
              </Button>,
              <Button key="retry" onClick={verifyRoom}>
                Retry Connection
              </Button>,
            ]}
          />
        </div>
      </div>
    );
  }

  const roomCode = meeting.meetingCode || meeting.code || id;
  const isHost = myRole === 'host';
  const capacityLabel =
    meeting.maxParticipants === 0
      ? `${displayParticipants.length} (Unlimited)`
      : `${displayParticipants.length} / ${meeting.maxParticipants}`;

  const hasPermissionError =
    devices.permissions.camera === 'denied' || devices.permissions.microphone === 'denied';

  const hostLeaveMenu: MenuProps['items'] = [
    {
      key: 'leave',
      icon: <LogOut size={14} />,
      label: 'Leave Room (Keep Meeting Open)',
      onClick: handleLeaveRoom,
    },
    {
      key: 'end',
      danger: true,
      icon: <PhoneOff size={14} />,
      label: 'End Meeting for Everyone',
      onClick: () => setEndModalOpen(true),
    },
  ];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100vw',
        height: '100vh',
        backgroundColor: tokens.colors.surfaceSecondary,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {/* Top Status Bar (Occupies Viewport Header) */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 18px',
          backgroundColor: tokens.colors.surfacePrimary,
          borderBottom: `1px solid ${tokens.colors.surfaceBorder}`,
          flexShrink: 0,
          zIndex: 10,
        }}
      >
        {/* Room Title & Code */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Title
                level={5}
                style={{
                  margin: 0,
                  fontWeight: 600,
                  color: tokens.colors.textPrimary,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: isMobile ? '130px' : '260px',
                }}
              >
                {meeting.title}
              </Title>
              {isHost && (
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    color: tokens.colors.accentPrimary,
                    backgroundColor: tokens.colors.accentPrimaryLight,
                    padding: '2px 6px',
                    borderRadius: tokens.borderRadius.sm,
                    border: `1px solid ${tokens.colors.accentPrimaryBorder}`,
                  }}
                >
                  HOST
                </span>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: '11.5px',
                  color: tokens.colors.textMuted,
                  backgroundColor: tokens.colors.surfaceSecondary,
                  padding: '2px 6px',
                  borderRadius: tokens.borderRadius.sm,
                  border: `1px solid ${tokens.colors.surfaceBorder}`,
                }}
              >
                {roomCode}
              </span>
              <Button
                size="small"
                style={{ paddingInline: '6px', height: '22px', fontSize: '11px' }}
                icon={
                  copiedLink ? <Check size={11} color={tokens.colors.success} /> : <Copy size={11} />
                }
                onClick={handleCopyLink}
              >
                {copiedLink ? 'Copied' : 'Copy'}
              </Button>
            </div>
          </div>
        </div>

        {/* Live Status Badges & Device Settings */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Active Screen Recording Pill */}
          {(recordingState === 'recording' || recordingState === 'paused') && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '11.5px',
                fontWeight: 600,
                color: tokens.colors.error,
                backgroundColor: tokens.colors.errorLight,
                padding: '3px 8px',
                borderRadius: tokens.borderRadius.sm,
                border: `1px solid ${tokens.colors.errorBorder}`,
              }}
            >
              <Radio size={12} className="spin-animation" />
              <span>REC</span>
            </div>
          )}

          {/* Participant Count */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '12px',
              color: tokens.colors.textSecondary,
              padding: '3px 8px',
              backgroundColor: tokens.colors.surfaceSecondary,
              borderRadius: tokens.borderRadius.sm,
              border: `1px solid ${tokens.colors.surfaceBorder}`,
            }}
          >
            <Users size={13} color={tokens.colors.textLight} />
            <span>{capacityLabel}</span>
          </div>

          {/* Duration Clock */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '12.5px',
              color: tokens.colors.textSecondary,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <Clock size={13} color={tokens.colors.textLight} />
            <span>{formatDuration(durationSeconds)}</span>
          </div>

          {/* Encrypted Room Badge (Desktop) */}
          {!isMobile && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '11.5px',
                color: tokens.colors.success,
                backgroundColor: tokens.colors.successLight,
                padding: '3px 7px',
                borderRadius: tokens.borderRadius.sm,
              }}
            >
              <ShieldCheck size={13} />
              <span>Encrypted</span>
            </div>
          )}

          {/* Device Settings Action */}
          <Button
            size="small"
            icon={<Settings size={14} />}
            onClick={() => setDeviceSettingsOpen(true)}
          >
            Devices
          </Button>
        </div>
      </header>

      {/* Socket Disconnected Alert Banner */}
      {!socketConnected && (
        <Alert
          type="warning"
          showIcon
          icon={<WifiOff size={15} />}
          message="Connection to meeting server was lost. Reconnecting..."
          banner
        />
      )}

      {/* Permission Denied Alert Banner */}
      {hasPermissionError && (
        <Alert
          type="error"
          showIcon
          icon={<AlertTriangle size={15} />}
          message="Camera or microphone access is blocked. Please allow device permissions in your browser address bar to transmit media."
          banner
          closable
        />
      )}

      {/* Main Video Stage & Side Panel Split */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, position: 'relative' }}>
        {/* Video Canvas Stage */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            alignItems: 'center',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Responsive Adaptive Video Grid */}
          <div style={{ flex: 1, width: '100%', minHeight: 0, overflow: 'hidden' }}>
            <VideoGrid
              participants={displayParticipants}
              activeSpeakerId={participantId}
              localStream={localStream}
              screenStream={screenStream}
              isAudioMuted={isAudioMuted}
              isVideoOff={isVideoOff}
              isScreenSharing={isScreenSharing}
              remotePeers={remotePeers}
              onVolumeChange={setRemoteVolume}
              meetingCode={roomCode}
              onCopyLink={handleCopyLink}
              copiedLink={copiedLink}
            />
          </div>

          {/* Floating Responsive Meeting Control Dock */}
          <div style={{ padding: '12px 0 16px 0', zIndex: 10 }}>
            {isHost ? (
              <Dropdown menu={{ items: hostLeaveMenu }} placement="topRight">
                <div>
                  <MeetingControlDock
                    micActive={!isAudioMuted}
                    camActive={!isVideoOff}
                    screenSharing={isScreenSharing}
                    chatOpen={sidebarTab === 'chat'}
                    rosterOpen={sidebarTab === 'roster'}
                    participantCount={displayParticipants.length}
                    unreadCount={unreadChatCount}
                    recordingState={recordingState}
                    recordDurationSeconds={recordDurationSeconds}
                    onToggleMic={toggleMicrophone}
                    onToggleCam={toggleCamera}
                    onToggleScreenShare={toggleScreenShare}
                    onToggleChat={handleToggleChat}
                    onToggleRoster={handleToggleRoster}
                    onOpenSettings={() => setDeviceSettingsOpen(true)}
                    onStartRecord={() => requestStartRecording(screenStream)}
                    onPauseRecord={pauseRecording}
                    onResumeRecord={resumeRecording}
                    onStopRecord={stopRecording}
                    onLeave={() => setEndModalOpen(true)}
                  />
                </div>
              </Dropdown>
            ) : (
              <MeetingControlDock
                micActive={!isAudioMuted}
                camActive={!isVideoOff}
                screenSharing={isScreenSharing}
                chatOpen={sidebarTab === 'chat'}
                rosterOpen={sidebarTab === 'roster'}
                participantCount={displayParticipants.length}
                unreadCount={unreadChatCount}
                recordingState={recordingState}
                recordDurationSeconds={recordDurationSeconds}
                onToggleMic={toggleMicrophone}
                onToggleCam={toggleCamera}
                onToggleScreenShare={toggleScreenShare}
                onToggleChat={handleToggleChat}
                onToggleRoster={handleToggleRoster}
                onOpenSettings={() => setDeviceSettingsOpen(true)}
                onStartRecord={() => requestStartRecording(screenStream)}
                onPauseRecord={pauseRecording}
                onResumeRecord={resumeRecording}
                onStopRecord={stopRecording}
                onLeave={handleLeaveRoom}
              />
            )}
          </div>
        </div>

        {/* Side Panel: Desktop side-by-side vs Mobile/Tablet Drawer */}
        {!isMobile ? (
          <>
            {sidebarTab === 'chat' && (
              <ChatPanel
                onClose={() => setSidebarTab(null)}
                messages={messages}
                onSendMessage={handleSendMessage}
              />
            )}

            {sidebarTab === 'roster' && (
              <ParticipantSidebar
                onClose={() => setSidebarTab(null)}
                participants={displayParticipants}
                isHost={isHost}
                onMuteAll={handleMuteAll}
                remotePeers={remotePeers}
                onVolumeChange={setRemoteVolume}
              />
            )}
          </>
        ) : (
          <Drawer
            open={Boolean(sidebarTab)}
            onClose={() => setSidebarTab(null)}
            placement="right"
            width="100%"
            styles={{ body: { padding: 0 } }}
            title={sidebarTab === 'chat' ? 'In-Call Chat' : 'Participants'}
          >
            {sidebarTab === 'chat' && (
              <ChatPanel
                onClose={() => setSidebarTab(null)}
                messages={messages}
                onSendMessage={handleSendMessage}
              />
            )}

            {sidebarTab === 'roster' && (
              <ParticipantSidebar
                onClose={() => setSidebarTab(null)}
                participants={displayParticipants}
                isHost={isHost}
                onMuteAll={handleMuteAll}
                remotePeers={remotePeers}
                onVolumeChange={setRemoteVolume}
              />
            )}
          </Drawer>
        )}
      </div>

      {/* Screen Share Recording Consent Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Radio size={18} color={tokens.colors.error} />
            <span>Record Screen Share</span>
          </div>
        }
        open={consentModalOpen}
        onCancel={cancelConsent}
        footer={[
          <Button key="cancel" onClick={cancelConsent}>
            Cancel
          </Button>,
          <Button
            key="confirm"
            type="primary"
            danger
            onClick={confirmStartRecording}
          >
            Consent & Start Recording
          </Button>,
        ]}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '6px 0' }}>
          <p style={{ margin: 0, fontSize: '13.5px', color: tokens.colors.textPrimary, lineHeight: 1.5 }}>
            You are about to start recording your active screen presentation using your browser's native MediaRecorder API.
          </p>

          <div
            style={{
              padding: '10px 12px',
              backgroundColor: tokens.colors.surfaceSecondary,
              borderRadius: tokens.borderRadius.sm,
              border: `1px solid ${tokens.colors.surfaceBorder}`,
              fontSize: '12px',
              color: tokens.colors.textSecondary,
              lineHeight: 1.45,
            }}
          >
            <strong>Audio Notice:</strong> System and application audio are captured only if permitted and supported by your operating system and browser. Audio presence cannot be guaranteed in every recording environment.
          </div>

          <p style={{ margin: 0, fontSize: '12.5px', color: tokens.colors.textMuted }}>
            Please ensure that all meeting participants have consented to this recording. The recording is generated entirely in your local browser session and will be downloaded directly to your computer when stopped.
          </p>
        </div>
      </Modal>

      {/* Recording Completed & Download Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileVideo size={18} color={tokens.colors.accentPrimary} />
            <span>Recording Ready to Download</span>
          </div>
        }
        open={downloadModalOpen}
        onCancel={discardRecording}
        width={560}
        footer={[
          <Button key="discard" onClick={discardRecording}>
            Discard
          </Button>,
          <Button
            key="download"
            type="primary"
            icon={<Download size={14} />}
            onClick={() =>
              downloadRecording(
                `rd-meet-${roomCode}-${new Date().toISOString().replace(/[:.]/g, '-')}.webm`
              )
            }
          >
            Download Recording
          </Button>,
        ]}
      >
        {recordingResult && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', padding: '6px 0' }}>
            <video
              src={recordingResult.blobUrl}
              controls
              style={{
                width: '100%',
                maxHeight: '280px',
                borderRadius: tokens.borderRadius.base,
                backgroundColor: '#000000',
              }}
            />

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '12.5px',
                color: tokens.colors.textSecondary,
                padding: '8px 12px',
                backgroundColor: tokens.colors.surfaceSecondary,
                borderRadius: tokens.borderRadius.sm,
                border: `1px solid ${tokens.colors.surfaceBorder}`,
              }}
            >
              <span>Duration: <strong>{formatDuration(recordingResult.durationSeconds)}</strong></span>
              <span>Size: <strong>{(recordingResult.sizeBytes / (1024 * 1024)).toFixed(2)} MB</strong></span>
              <span>Format: <strong>{recordingResult.mimeType.split(';')[0]}</strong></span>
            </div>
          </div>
        )}
      </Modal>

      {/* In-Meeting Audio / Video Device Settings Modal */}
      <Modal
        title="Audio & Video Settings"
        open={deviceSettingsOpen}
        onCancel={() => setDeviceSettingsOpen(false)}
        footer={[
          <Button key="ok" type="primary" onClick={() => setDeviceSettingsOpen(false)}>
            Done
          </Button>,
        ]}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: '8px 0' }}>
          {/* Microphone Selector */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <Mic size={16} color={tokens.colors.accentPrimary} />
              <Text strong style={{ fontSize: '13px' }}>Microphone</Text>
            </div>
            <Select
              style={{ width: '100%' }}
              value={devices.selectedAudioInputId || undefined}
              onChange={setAudioInputDevice}
              placeholder="Select microphone..."
              options={devices.audioInputs.map((d) => ({
                label: d.label || `Microphone ${d.deviceId.slice(0, 5)}`,
                value: d.deviceId,
              }))}
            />
          </div>

          {/* Camera Selector */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <Video size={16} color={tokens.colors.accentPrimary} />
              <Text strong style={{ fontSize: '13px' }}>Camera</Text>
            </div>
            <Select
              style={{ width: '100%' }}
              value={devices.selectedVideoInputId || undefined}
              onChange={setVideoInputDevice}
              placeholder="Select camera..."
              options={devices.videoInputs.map((d) => ({
                label: d.label || `Camera ${d.deviceId.slice(0, 5)}`,
                value: d.deviceId,
              }))}
            />
          </div>

          {/* Speaker / Audio Output Selector */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
              <Volume2 size={16} color={tokens.colors.accentPrimary} />
              <Text strong style={{ fontSize: '13px' }}>Speaker (Audio Output)</Text>
            </div>
            <Select
              style={{ width: '100%' }}
              value={devices.selectedAudioOutputId || undefined}
              onChange={setAudioOutputDevice}
              placeholder="Default system output"
              disabled={devices.audioOutputs.length === 0}
              options={devices.audioOutputs.map((d) => ({
                label: d.label || `Speaker ${d.deviceId.slice(0, 5)}`,
                value: d.deviceId,
              }))}
            />
            {devices.audioOutputs.length === 0 && (
              <div style={{ fontSize: '11px', color: tokens.colors.textMuted, marginTop: '4px' }}>
                Audio output device selection is handled by system default on this browser.
              </div>
            )}
          </div>

          {/* Permissions Info */}
          <div
            style={{
              padding: '10px 12px',
              backgroundColor: tokens.colors.surfaceSecondary,
              borderRadius: tokens.borderRadius.sm,
              border: `1px solid ${tokens.colors.surfaceBorder}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              fontSize: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Camera Permission:</span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontWeight: 600,
                  color:
                    devices.permissions.camera === 'granted'
                      ? tokens.colors.success
                      : tokens.colors.warning,
                }}
              >
                {devices.permissions.camera === 'granted' ? (
                  <CheckCircle2 size={13} />
                ) : (
                  <AlertTriangle size={13} />
                )}
                {devices.permissions.camera.toUpperCase()}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span>Microphone Permission:</span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontWeight: 600,
                  color:
                    devices.permissions.microphone === 'granted'
                      ? tokens.colors.success
                      : tokens.colors.warning,
                }}
              >
                {devices.permissions.microphone === 'granted' ? (
                  <CheckCircle2 size={13} />
                ) : (
                  <AlertTriangle size={13} />
                )}
                {devices.permissions.microphone.toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      </Modal>

      {/* Host End Meeting Confirmation Modal */}
      <Modal
        title="End Meeting or Leave"
        open={endModalOpen}
        onCancel={() => setEndModalOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setEndModalOpen(false)}>
            Cancel
          </Button>,
          <Button key="leave" onClick={handleLeaveRoom}>
            Leave Only
          </Button>,
          <Button key="end" type="primary" danger onClick={handleEndMeetingForEveryone}>
            End Meeting for Everyone
          </Button>,
        ]}
      >
        <p style={{ color: tokens.colors.textSecondary, fontSize: '13.5px' }}>
          As the host, you can leave the room while allowing other participants to stay, or
          terminate the session completely for everyone.
        </p>
      </Modal>
    </div>
  );
};
