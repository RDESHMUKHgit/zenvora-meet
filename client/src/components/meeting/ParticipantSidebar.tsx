import React, { useState } from 'react';
import { Input, Button, Avatar, Typography, Space, Popover, Slider } from 'antd';
import {
  Users,
  Search,
  Mic,
  MicOff,
  Video,
  VideoOff,
  X,
  Shield,
  Volume2,
  VolumeX,
  Volume1,
  Monitor,
  Loader2,
  MessageSquare,
} from 'lucide-react';
import { tokens } from '../../styles/tokens';
import type { RemotePeerMedia } from '../../features/media/media.types';

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
  remotePeers?: Map<string, RemotePeerMedia>;
  onVolumeChange?: (participantId: string, volume: number) => void;
  onDirectMessage?: (participant: ParticipantItem) => void;
}

export const ParticipantSidebar: React.FC<ParticipantSidebarProps> = ({
  onClose,
  participants,
  isHost = false,
  onMuteAll,
  remotePeers,
  onVolumeChange,
  onDirectMessage,
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
          const remote = remotePeers?.get(item.id);
          const vol = remote?.volume ?? 1.0;
          const conn = remote?.connectionState;
          const sharing = item.isScreenSharing || remote?.isScreenSharing;

          const getVolIcon = () => {
            if (vol === 0) return <VolumeX size={13} color={tokens.colors.error} />;
            if (vol < 0.5) return <Volume1 size={13} color={tokens.colors.textSecondary} />;
            return <Volume2 size={13} color={tokens.colors.textSecondary} />;
          };

          const volumePopoverContent = (
            <div style={{ width: '130px', padding: '4px' }}>
              <div
                style={{
                  fontSize: '11px',
                  color: tokens.colors.textMuted,
                  marginBottom: '6px',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span>Volume</span>
                <span style={{ fontWeight: 600 }}>{Math.round(vol * 100)}%</span>
              </div>
              <Slider
                min={0}
                max={100}
                value={Math.round(vol * 100)}
                onChange={(val) => onVolumeChange?.(item.id, val / 100)}
                styles={{
                  track: { backgroundColor: tokens.colors.accentPrimary },
                  handle: { borderColor: tokens.colors.accentPrimary },
                }}
              />
            </div>
          );

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
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, flex: 1 }}>
                <Avatar
                  size={32}
                  style={{
                    backgroundColor: item.isSelf
                      ? tokens.colors.accentPrimaryLight
                      : tokens.colors.surfaceTertiary,
                    color: item.isSelf
                      ? tokens.colors.accentPrimary
                      : tokens.colors.textPrimary,
                    fontSize: '13px',
                    fontWeight: 600,
                    flexShrink: 0,
                    border: `1px solid ${
                      item.isSelf
                        ? tokens.colors.accentPrimaryBorder
                        : tokens.colors.surfaceBorder
                    }`,
                  }}
                >
                  {participantName.charAt(0).toUpperCase()}
                </Avatar>

                <div style={{ minWidth: 0, flex: 1 }}>
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
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
                    {sharing && (
                      <span
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '3px',
                          fontSize: '10.5px',
                          color: tokens.colors.accentSecondary,
                        }}
                      >
                        <Monitor size={10} /> Sharing
                      </span>
                    )}
                    {!item.isSelf && conn && conn !== 'connected' && (
                      <span
                        style={{
                          fontSize: '10px',
                          color:
                            conn === 'failed'
                              ? tokens.colors.error
                              : tokens.colors.warning,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '2px',
                        }}
                      >
                        {conn === 'connecting' && <Loader2 size={9} className="spin-animation" />}
                        {conn}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <Space size={4}>
                {/* Direct Message Action */}
                {!item.isSelf && onDirectMessage && (
                  <Button
                    type="text"
                    size="small"
                    style={{ padding: '2px 4px', height: 'auto', minWidth: 'auto' }}
                    icon={<MessageSquare size={13} color={tokens.colors.accentPrimary} />}
                    onClick={() => onDirectMessage(item)}
                    title={`Send direct message to ${participantName}`}
                    aria-label={`Send direct message to ${participantName}`}
                  />
                )}

                {/* Remote Volume Popover */}
                {!item.isSelf && onVolumeChange && (
                  <Popover content={volumePopoverContent} trigger="click" placement="left">
                    <Button
                      type="text"
                      size="small"
                      style={{ padding: '2px 4px', height: 'auto', minWidth: 'auto' }}
                      icon={getVolIcon()}
                    />
                  </Popover>
                )}

                <div
                  style={{
                    padding: '3px',
                    borderRadius: tokens.borderRadius.sm,
                    color: item.isMuted ? tokens.colors.error : tokens.colors.textSecondary,
                  }}
                >
                  {item.isMuted ? <MicOff size={13} /> : <Mic size={13} />}
                </div>
                <div
                  style={{
                    padding: '3px',
                    borderRadius: tokens.borderRadius.sm,
                    color: item.isVideoOff ? tokens.colors.error : tokens.colors.textSecondary,
                  }}
                >
                  {item.isVideoOff ? <VideoOff size={13} /> : <Video size={13} />}
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
