import React, { useState } from 'react';
import { Input, Button, Avatar, Typography, Space } from 'antd';
import { Users, Search, Mic, MicOff, Video, VideoOff, X, Shield } from 'lucide-react';
import { tokens } from '../../styles/tokens';

const { Text } = Typography;

export interface ParticipantItem {
  id: string;
  name: string;
  displayName?: string;
  role: 'host' | 'cohost' | 'participant';
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing?: boolean;
  isSelf?: boolean;
}

interface ParticipantSidebarProps {
  onClose: () => void;
  participants: ParticipantItem[];
  isHost?: boolean;
  onMuteAll?: () => void;
}

export const ParticipantSidebar: React.FC<ParticipantSidebarProps> = ({
  onClose,
  participants,
  isHost = false,
  onMuteAll,
}) => {
  const [search, setSearch] = useState('');

  const filtered = participants.filter((p) => {
    const n = (p.displayName || p.name || '').toLowerCase();
    return n.includes(search.toLowerCase());
  });

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: tokens.colors.surfacePrimary,
        borderLeft: `1px solid ${tokens.colors.surfaceBorder}`,
        width: '340px',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '14px 16px',
          borderBottom: `1px solid ${tokens.colors.surfaceBorder}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Users size={16} color={tokens.colors.accentPrimary} />
          <span style={{ fontWeight: 600, fontSize: '14px', color: tokens.colors.textPrimary }}>
            Participants ({participants.length})
          </span>
        </div>
        <Button
          type="text"
          size="small"
          icon={<X size={16} />}
          onClick={onClose}
          aria-label="Close roster"
        />
      </div>

      {/* Search Input */}
      <div style={{ padding: '10px 14px', borderBottom: `1px solid ${tokens.colors.surfaceBorderSubtle}` }}>
        <Input
          prefix={<Search size={14} color={tokens.colors.textLight} />}
          placeholder="Search participants..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          size="middle"
          allowClear
        />
      </div>

      {/* Participant List */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}
      >
        {filtered.map((item) => {
          const participantName = item.displayName || item.name || 'Participant';
          return (
            <div
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 10px',
                borderRadius: tokens.borderRadius.base,
                backgroundColor: tokens.colors.surfaceSecondary,
                border: `1px solid ${tokens.colors.surfaceBorderSubtle}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                <Avatar
                  size={32}
                  style={{
                    backgroundColor: tokens.colors.accentPrimary,
                    color: '#ffffff',
                    fontSize: '13px',
                    fontWeight: 600,
                    flexShrink: 0,
                  }}
                >
                  {participantName.charAt(0).toUpperCase()}
                </Avatar>

                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: '13px',
                      fontWeight: 500,
                      color: tokens.colors.textPrimary,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {participantName} {item.isSelf && '(You)'}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {item.role === 'host' && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          fontSize: '10.5px',
                          fontWeight: 600,
                          color: tokens.colors.accentPrimary,
                        }}
                      >
                        <Shield size={10} /> Host
                      </span>
                    )}
                    {item.role === 'participant' && (
                      <Text type="secondary" style={{ fontSize: '11px' }}>
                        Participant
                      </Text>
                    )}
                  </div>
                </div>
              </div>

              <Space size={6}>
                <div
                  style={{
                    padding: '4px',
                    borderRadius: tokens.borderRadius.sm,
                    color: item.isMuted ? tokens.colors.error : tokens.colors.textSecondary,
                  }}
                >
                  {item.isMuted ? <MicOff size={14} /> : <Mic size={14} />}
                </div>
                <div
                  style={{
                    padding: '4px',
                    borderRadius: tokens.borderRadius.sm,
                    color: item.isVideoOff ? tokens.colors.error : tokens.colors.textSecondary,
                  }}
                >
                  {item.isVideoOff ? <VideoOff size={14} /> : <Video size={14} />}
                </div>
              </Space>
            </div>
          );
        })}
      </div>

      {/* Host Controls Footer */}
      {isHost && (
        <div
          style={{
            padding: '12px 14px',
            borderTop: `1px solid ${tokens.colors.surfaceBorder}`,
            backgroundColor: tokens.colors.surfaceSecondary,
            display: 'flex',
            gap: '8px',
          }}
        >
          <Button size="middle" danger style={{ flex: 1 }} onClick={onMuteAll}>
            Mute All
          </Button>
        </div>
      )}
    </div>
  );
};
