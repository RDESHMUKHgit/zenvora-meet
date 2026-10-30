import React, { useState } from 'react';
import { Typography, Button, Space } from 'antd';
import { Video, ShieldCheck, Cpu } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts';
import { useDocumentTitle } from '../../hooks';
import { LiveClock, BackgroundAesthetics } from '../../components/common';
import { CreateMeetingModal, JoinMeetingArea, MeetingHistoryList } from '../../features/meetings';
import { ROUTES } from '../../constants';
import { tokens } from '../../styles/tokens';

const { Title, Paragraph, Text } = Typography;

export const HomePage: React.FC = () => {
  useDocumentTitle('Video Collaboration');
  const { isAuthenticated } = useAuth();
  const [createModalOpen, setCreateModalOpen] = useState(false);

  return (
    <div className="page-container" style={{ minHeight: 'calc(100vh - 140px)' }}>
      {/* Sparse, subtle background decorative icons */}
      <BackgroundAesthetics />

      {/* Hero & Quick Actions Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '40px',
          alignItems: 'start',
          paddingTop: '24px',
          paddingBottom: '48px',
        }}
      >
        {/* Left Column: Clock, Value Statement, Create Action */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div>
            <LiveClock />
          </div>

          <div>
            <Title
              level={1}
              style={{
                fontSize: '2.25rem',
                fontWeight: 700,
                color: tokens.colors.textPrimary,
                lineHeight: 1.25,
                letterSpacing: '-0.025em',
                margin: 0,
              }}
            >
              Clear, reliable video meetings for focused teams
            </Title>

            <Paragraph
              style={{
                fontSize: '1.05rem',
                color: tokens.colors.textSecondary,
                lineHeight: 1.6,
                marginTop: '14px',
                marginBottom: 0,
                maxWidth: '520px',
              }}
            >
              High-definition audio and video with encrypted signaling, seamless screen sharing, and
              instant room generation without unnecessary clutter.
            </Paragraph>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px' }}>
            <Button
              type="primary"
              size="large"
              icon={<Video size={18} />}
              onClick={() => setCreateModalOpen(true)}
              style={{ height: '44px', paddingInline: '22px', fontSize: '15px' }}
            >
              Create Meeting
            </Button>
          </div>

          {/* Key Architectural Anchors (clean, restrained, no pills/badges) */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '24px',
              paddingTop: '16px',
              borderTop: `1px solid ${tokens.colors.surfaceBorderSubtle}`,
            }}
          >
            <Space size={8} align="center">
              <ShieldCheck size={16} color={tokens.colors.accentPrimary} />
              <Text style={{ fontSize: '13px', color: tokens.colors.textMuted }}>
                Encrypted Peer Signaling
              </Text>
            </Space>

            <Space size={8} align="center">
              <Cpu size={16} color={tokens.colors.accentSecondary} />
              <Text style={{ fontSize: '13px', color: tokens.colors.textMuted }}>
                Low-Latency WebRTC
              </Text>
            </Space>
          </div>
        </div>

        {/* Right Column: Join Meeting Panel */}
        <div
          style={{
            padding: '28px',
            backgroundColor: tokens.colors.surfacePrimary,
            border: `1px solid ${tokens.colors.surfaceBorder}`,
            borderRadius: tokens.borderRadius.lg,
            boxShadow: tokens.shadows.card,
          }}
        >
          <div style={{ marginBottom: '18px' }}>
            <Title level={4} style={{ margin: 0, fontWeight: 600 }}>
              Join a Meeting
            </Title>
            <Text type="secondary" style={{ fontSize: '13px' }}>
              Enter the meeting ID or direct room link provided by your host.
            </Text>
          </div>

          <JoinMeetingArea />
        </div>
      </div>

      {/* Meeting History Section for Authenticated Users */}
      {isAuthenticated ? (
        <div
          style={{
            borderTop: `1px solid ${tokens.colors.surfaceBorder}`,
            paddingTop: '36px',
            marginTop: '12px',
          }}
        >
          <MeetingHistoryList limit={4} />

          <div style={{ textAlign: 'center', marginTop: '20px' }}>
            <Link
              to={ROUTES.HISTORY}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '13px',
                fontWeight: 500,
                color: tokens.colors.accentPrimary,
                textDecoration: 'none',
              }}
            >
              View all meeting history
            </Link>
          </div>
        </div>
      ) : (
        <div
          style={{
            borderTop: `1px solid ${tokens.colors.surfaceBorder}`,
            paddingTop: '32px',
            marginTop: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <div>
            <Text style={{ fontWeight: 600, color: tokens.colors.textPrimary, display: 'block' }}>
              Want to keep track of your meetings?
            </Text>
            <Text type="secondary" style={{ fontSize: '13px' }}>
              Sign in to automatically save room links, review session lengths, and manage your
              audio preferences.
            </Text>
          </div>
          <Link to={ROUTES.LOGIN}>
            <Button type="default">Sign In to Account</Button>
          </Link>
        </div>
      )}

      {/* Create Meeting Configuration Modal */}
      <CreateMeetingModal open={createModalOpen} onClose={() => setCreateModalOpen(false)} />
    </div>
  );
};
