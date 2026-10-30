import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Typography, Button, Result, Spin, App } from 'antd';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { Copy, Check, ShieldCheck, Clock, Settings } from 'lucide-react';
import { useAuth } from '../../contexts';
import { useDocumentTitle } from '../../hooks';
import { meetingApi } from '../../services/meeting.service';
import { VideoGrid, MeetingControlDock, ParticipantSidebar, type ParticipantItem } from '../../components/meeting';
import { ChatPanel, type ChatMessage } from '../../components/chat';
import { ROUTES } from '../../constants';
import { tokens } from '../../styles/tokens';
import type { MeetingRecord } from '../../types';

const { Title } = Typography;

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
      muteMic?: boolean;
      turnOffCam?: boolean;
      meetingRecord?: MeetingRecord;
    }) || {};

  const [meeting, setMeeting] = useState<MeetingRecord | null>(stateData.meetingRecord || null);
  const [loading, setLoading] = useState(!stateData.meetingRecord);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [micActive, setMicActive] = useState(!stateData.muteMic);
  const [camActive, setCamActive] = useState(!stateData.turnOffCam);
  const [screenSharing, setScreenSharing] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<'chat' | 'roster' | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [durationSeconds, setDurationSeconds] = useState(0);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);

  useDocumentTitle(meeting ? `${meeting.title} · Meeting` : 'Conference Meeting');

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
      setMeeting(data);

      // Join room in backend
      const name = stateData.displayName || user?.name || 'Guest User';
      await meetingApi.joinMeeting(id, name);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : `Meeting room '${id}' not found or has expired`;
      setLoadError(msg);
    } finally {
      setLoading(false);
    }
  }, [id, stateData.displayName, user?.name]);

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

  const handleLeave = () => {
    message.info('You have left the meeting');
    navigate(ROUTES.HOME);
  };

  const handleSendMessage = (content: string) => {
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const newMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      senderName: stateData.displayName || user?.name || 'You',
      isSelf: true,
      content,
      timestamp: timeStr,
    };
    setMessages((prev) => [...prev, newMsg]);
  };

  // Participant list based on real state
  const myName = stateData.displayName || user?.name || 'You';
  const participants: ParticipantItem[] = [
    {
      id: 'local-user',
      name: myName,
      role: meeting?.hostUserId === user?.id ? 'host' : 'participant',
      isMuted: !micActive,
      isVideoOff: !camActive,
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
          title="Meeting Not Found"
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
            <Title level={4} style={{ margin: 0, fontWeight: 600, color: tokens.colors.textPrimary }}>
              {meeting.title}
            </Title>
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
            onClick={() => navigate(ROUTES.SETTINGS)}
          >
            Settings
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
          {/* Responsive Video Grid */}
          <div style={{ flex: 1, width: '100%', minHeight: 0, overflow: 'auto' }}>
            <VideoGrid
              participants={participants}
              activeSpeakerId="local-user"
              localVideoRef={localVideoRef}
            />
          </div>

          {/* Floating Control Dock (Pinned at bottom center) */}
          <div style={{ padding: '16px 0', zIndex: 10 }}>
            <MeetingControlDock
              micActive={micActive}
              camActive={camActive}
              screenSharing={screenSharing}
              chatOpen={sidebarTab === 'chat'}
              rosterOpen={sidebarTab === 'roster'}
              participantCount={participants.length}
              unreadCount={messages.length}
              onToggleMic={() => setMicActive((v) => !v)}
              onToggleCam={() => setCamActive((v) => !v)}
              onToggleScreenShare={() => setScreenSharing((v) => !v)}
              onToggleChat={() => setSidebarTab((prev) => (prev === 'chat' ? null : 'chat'))}
              onToggleRoster={() => setSidebarTab((prev) => (prev === 'roster' ? null : 'roster'))}
              onOpenSettings={() => navigate(ROUTES.SETTINGS)}
              onLeave={handleLeave}
            />
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
            participants={participants}
            isHost={meeting.hostUserId === user?.id}
            onMuteAll={() => message.info('All participants have been muted')}
          />
        )}
      </div>
    </div>
  );
};
