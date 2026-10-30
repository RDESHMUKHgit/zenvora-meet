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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [participants, setParticipants] = useState<ParticipantItem[]>([]);
  const [endModalOpen, setEndModalOpen] = useState(false);
  const [deviceSettingsOpen, setDeviceSettingsOpen] = useState(false);

  useDocumentTitle(meeting ? `${meeting.title} · Meeting` : 'Conference Meeting');

  // Real WebRTC Media Engine hook
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

  // Notify on media device errors (permissions, device unavailable)
  useEffect(() => {
    if (mediaError) {
      message.error(mediaError);
    }
  }, [mediaError, message]);

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

  // Duration timer
  useEffect(() => {
    const timer = setInterval(() => {
      setDurationSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Socket.IO Room Lifecycle Integration
  useEffect(() => {
    if (!id || !meeting) return;

    const socket = connectSocket();

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
        // Pre-register existing peers into media engine
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

    // 7. Host Mute All Command
    socket.on('host:mute-all', () => {
      if (myRole !== 'host') {
        if (!isAudioMuted) {
          toggleMicrophone();
        }
        message.warning('The host has muted your microphone');
      }
    });

    // 8. Meeting Ended by Host
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

    // 9. Room Errors (e.g. Capacity Reached)
    socket.on('room:error', (payload: { message: string }) => {
      message.error(payload.message || 'Room error encountered');
    });

    return () => {
      socket.off('room:joined');
      socket.off('room:participants');
      socket.off('participant:joined');
      socket.off('participant:left');
      socket.off('participant:media-updated');
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
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      senderName: displayName,
      isSelf: true,
      content,
      timestamp: timeStr,
    };
    setMessages((prev) => [...prev, newMsg]);
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
          minHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
        }}
      >
        <Spin size="large" />
        <div style={{ fontSize: '15px', color: tokens.colors.textSecondary }}>
          Connecting to secure meeting room...
        </div>
      </div>
    );
  }

  if (loadError || !meeting) {
    return (
      <div style={{ maxWidth: '600px', margin: '60px auto', padding: '24px' }}>
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
    );
  }

  const roomCode = meeting.meetingCode || meeting.code || id;
  const isHost = myRole === 'host';
  const capacityLabel =
    meeting.maxParticipants === 0
      ? `${displayParticipants.length} (Unlimited)`
      : `${displayParticipants.length} / ${meeting.maxParticipants}`;

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
        height: 'calc(100vh - 72px)',
        backgroundColor: tokens.colors.surfaceSecondary,
        overflow: 'hidden',
      }}
    >
      {/* Top Status Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 20px',
          backgroundColor: tokens.colors.surfacePrimary,
          borderBottom: `1px solid ${tokens.colors.surfaceBorder}`,
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Title level={4} style={{ margin: 0, fontWeight: 600, color: tokens.colors.textPrimary }}>
                {meeting.title}
              </Title>
              {isHost && (
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
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

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
              <span
                style={{
                  fontFamily: 'monospace',
                  fontSize: '12px',
                  color: tokens.colors.textMuted,
                  backgroundColor: tokens.colors.surfaceSecondary,
                  padding: '2px 8px',
                  borderRadius: tokens.borderRadius.sm,
                  border: `1px solid ${tokens.colors.surfaceBorder}`,
                }}
              >
                {roomCode}
              </span>
              <Button
                size="small"
                icon={
                  copiedLink ? <Check size={12} color={tokens.colors.success} /> : <Copy size={12} />
                }
                onClick={handleCopyLink}
              >
                {copiedLink ? 'Copied' : 'Copy Link'}
              </Button>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          {/* Capacity Counter */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12.5px',
              color: tokens.colors.textSecondary,
              padding: '4px 10px',
              backgroundColor: tokens.colors.surfaceSecondary,
              borderRadius: tokens.borderRadius.sm,
              border: `1px solid ${tokens.colors.surfaceBorder}`,
            }}
          >
            <Users size={14} color={tokens.colors.textLight} />
            <span>{capacityLabel}</span>
          </div>

          {/* Duration Clock */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              color: tokens.colors.textSecondary,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <Clock size={14} color={tokens.colors.textLight} />
            <span>{formatDuration(durationSeconds)}</span>
          </div>

          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '12px',
              color: tokens.colors.success,
              backgroundColor: tokens.colors.successLight,
              padding: '3px 8px',
              borderRadius: tokens.borderRadius.sm,
            }}
          >
            <ShieldCheck size={13} />
            <span>Encrypted Room</span>
          </div>

          <Button
            size="middle"
            icon={<Settings size={15} />}
            onClick={() => setDeviceSettingsOpen(true)}
          >
            Devices
          </Button>
        </div>
      </div>

      {/* Main Stage & Side Drawer Split */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, position: 'relative' }}>
        {/* Main Video Stage */}
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
          {/* Responsive Live Video Grid */}
          <div style={{ flex: 1, width: '100%', minHeight: 0, overflow: 'auto' }}>
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
            />
          </div>

          {/* Floating Control Dock */}
          <div style={{ padding: '16px 0', zIndex: 10 }}>
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
                    unreadCount={messages.length}
                    onToggleMic={toggleMicrophone}
                    onToggleCam={toggleCamera}
                    onToggleScreenShare={toggleScreenShare}
                    onToggleChat={() => setSidebarTab((prev) => (prev === 'chat' ? null : 'chat'))}
                    onToggleRoster={() => setSidebarTab((prev) => (prev === 'roster' ? null : 'roster'))}
                    onOpenSettings={() => setDeviceSettingsOpen(true)}
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
                unreadCount={messages.length}
                onToggleMic={toggleMicrophone}
                onToggleCam={toggleCamera}
                onToggleScreenShare={toggleScreenShare}
                onToggleChat={() => setSidebarTab((prev) => (prev === 'chat' ? null : 'chat'))}
                onToggleRoster={() => setSidebarTab((prev) => (prev === 'roster' ? null : 'roster'))}
                onOpenSettings={() => setDeviceSettingsOpen(true)}
                onLeave={handleLeaveRoom}
              />
            )}
          </div>
        </div>

        {/* Collapsible Side Panel (Chat or Participants) */}
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
      </div>

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
