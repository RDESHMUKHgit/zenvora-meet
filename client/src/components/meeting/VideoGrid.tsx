import React from 'react';
import { Avatar } from 'antd';
import { Mic, MicOff } from 'lucide-react';
import { tokens } from '../../styles/tokens';
import type { ParticipantItem } from './ParticipantSidebar';

interface VideoGridProps {
  participants: ParticipantItem[];
  activeSpeakerId?: string;
  localVideoRef?: React.RefObject<HTMLVideoElement | null>;
}

export const VideoGrid: React.FC<VideoGridProps> = ({
  participants,
  activeSpeakerId,
  localVideoRef,
}) => {
  const count = participants.length;

  // Determine grid template based on participant count (1, 2, 3-4, 5-9)
  const getGridConfig = () => {
    if (count <= 1) return { cols: '1fr', rows: '1fr' };
    if (count === 2) return { cols: 'repeat(2, 1fr)', rows: '1fr' };
    if (count <= 4) return { cols: 'repeat(2, 1fr)', rows: 'repeat(2, 1fr)' };
    return { cols: 'repeat(3, 1fr)', rows: 'repeat(auto-fit, minmax(200px, 1fr))' };
  };

  const { cols, rows } = getGridConfig();

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: cols,
        gridTemplateRows: rows,
        gap: '12px',
        width: '100%',
        height: '100%',
        padding: '12px',
        boxSizing: 'border-box',
      }}
    >
      {participants.map((p) => {
        const isSpeaker = p.id === activeSpeakerId;
        return (
          <div
            key={p.id}
            style={{
              position: 'relative',
              backgroundColor: tokens.colors.surfacePrimary,
              borderRadius: tokens.borderRadius.md,
              border: `2px solid ${isSpeaker ? tokens.colors.accentPrimary : tokens.colors.surfaceBorder}`,
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '220px',
              aspectRatio: '16/9',
              boxShadow: tokens.shadows.card,
            }}
          >
            {/* Video Feed or Avatar */}
            {p.isVideoOff ? (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '12px',
                }}
              >
                <Avatar
                  size={64}
                  style={{
                    backgroundColor: tokens.colors.surfaceSecondary,
                    color: tokens.colors.accentPrimary,
                    fontSize: '24px',
                    fontWeight: 600,
                    border: `1px solid ${tokens.colors.surfaceBorder}`,
                  }}
                >
                  {p.name.charAt(0).toUpperCase()}
                </Avatar>
                <div style={{ fontSize: '13px', color: tokens.colors.textSecondary }}>
                  Camera is off
                </div>
              </div>
            ) : p.isSelf ? (
              <video
                ref={localVideoRef as React.RefObject<HTMLVideoElement>}
                autoPlay
                playsInline
                muted
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  transform: 'scaleX(-1)', // Mirror local camera
                }}
              />
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  backgroundColor: tokens.colors.surfaceSecondary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Avatar
                  size={56}
                  style={{
                    backgroundColor: tokens.colors.accentSecondary,
                    color: '#ffffff',
                    fontSize: '20px',
                    fontWeight: 600,
                  }}
                >
                  {p.name.charAt(0).toUpperCase()}
                </Avatar>
              </div>
            )}

            {/* Floating Participant Name Tag (Bottom Left) */}
            <div
              style={{
                position: 'absolute',
                bottom: '10px',
                left: '10px',
                backgroundColor: 'rgba(255, 255, 255, 0.92)',
                backdropFilter: 'blur(8px)',
                padding: '4px 10px',
                borderRadius: tokens.borderRadius.sm,
                border: `1px solid ${tokens.colors.surfaceBorder}`,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: 500,
                color: tokens.colors.textPrimary,
                boxShadow: tokens.shadows.subtle,
              }}
            >
              <span>{p.name} {p.isSelf && '(You)'}</span>
              {p.isMuted ? (
                <MicOff size={12} color={tokens.colors.error} />
              ) : (
                <Mic size={12} color={tokens.colors.success} />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
