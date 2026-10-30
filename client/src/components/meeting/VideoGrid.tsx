import React, { useEffect, useRef, useState } from 'react';
import { Avatar, Popover, Slider } from 'antd';
import {
  Mic,
  MicOff,
  VideoOff,
  Monitor,
  Volume2,
  VolumeX,
  Volume1,
  Shield,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { tokens } from '../../styles/tokens';
import type { ParticipantItem } from './ParticipantSidebar';
import type { RemotePeerMedia, PeerConnectionStatus } from '../../features/media/media.types';

export interface VideoGridProps {
  participants: ParticipantItem[];
  activeSpeakerId?: string;
  localStream: MediaStream | null;
  screenStream: MediaStream | null;
  isAudioMuted?: boolean;
  isVideoOff?: boolean;
  isScreenSharing?: boolean;
  remotePeers: Map<string, RemotePeerMedia>;
  onVolumeChange?: (participantId: string, volume: number) => void;
}

interface VideoTileProps {
  stream: MediaStream | null;
  isSelf: boolean;
  isScreenSharing: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
  displayName: string;
  role?: 'host' | 'cohost' | 'participant';
  connectionStatus?: PeerConnectionStatus;
  isActiveSpeaker?: boolean;
  volume?: number;
  onVolumeChange?: (vol: number) => void;
  style?: React.CSSProperties;
}

export const VideoTile: React.FC<VideoTileProps> = ({
  stream,
  isSelf,
  isScreenSharing,
  isMuted,
  isVideoOff,
  displayName,
  role,
  connectionStatus,
  isActiveSpeaker = false,
  volume = 1.0,
  onVolumeChange,
  style,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [volSliderOpen, setVolSliderOpen] = useState(false);

  useEffect(() => {
    if (videoRef.current) {
      if (stream) {
        if (videoRef.current.srcObject !== stream) {
          videoRef.current.srcObject = stream;
        }
      } else {
        videoRef.current.srcObject = null;
      }
    }
  }, [stream]);

  // Determine avatar letter
  const avatarLetter = (displayName || 'P').trim().charAt(0).toUpperCase();

  // Volume icon helper
  const getVolumeIcon = () => {
    if (volume === 0) return <VolumeX size={14} color={tokens.colors.error} />;
    if (volume < 0.5) return <Volume1 size={14} color={tokens.colors.textSecondary} />;
    return <Volume2 size={14} color={tokens.colors.textSecondary} />;
  };

  const volumeMenu = (
    <div style={{ width: '140px', padding: '4px' }}>
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
        <span style={{ fontWeight: 600 }}>{Math.round(volume * 100)}%</span>
      </div>
      <Slider
        min={0}
        max={100}
        value={Math.round(volume * 100)}
        onChange={(val) => onVolumeChange?.(val / 100)}
        styles={{
          track: { backgroundColor: tokens.colors.accentPrimary },
          handle: { borderColor: tokens.colors.accentPrimary },
        }}
      />
    </div>
  );

  return (
    <div
      style={{
        position: 'relative',
        backgroundColor: isScreenSharing ? '#090d16' : tokens.colors.surfacePrimary,
        borderRadius: tokens.borderRadius.md,
        border: `2px solid ${
          isActiveSpeaker
            ? tokens.colors.accentPrimary
            : tokens.colors.surfaceBorder
        }`,
        boxShadow: isActiveSpeaker
          ? `0 0 0 2px ${tokens.colors.accentPrimaryBorder}, ${tokens.shadows.card}`
          : tokens.shadows.card,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        minHeight: '160px',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        ...style,
      }}
    >
      {/* Video element or placeholder */}
      {isVideoOff && !isScreenSharing ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '12px',
            userSelect: 'none',
          }}
        >
          <Avatar
            size={68}
            style={{
              backgroundColor: isSelf
                ? tokens.colors.accentPrimaryLight
                : tokens.colors.surfaceSecondary,
              color: isSelf ? tokens.colors.accentPrimary : tokens.colors.textPrimary,
              fontSize: '26px',
              fontWeight: 600,
              border: `1px solid ${
                isSelf ? tokens.colors.accentPrimaryBorder : tokens.colors.surfaceBorder
              }`,
            }}
          >
            {avatarLetter}
          </Avatar>
          <div
            style={{
              fontSize: '12.5px',
              color: tokens.colors.textMuted,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <VideoOff size={14} color={tokens.colors.textLight} />
            <span>Camera is off</span>
          </div>
        </div>
      ) : (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isSelf} // Always mute local video playback to prevent echo
          style={{
            width: '100%',
            height: '100%',
            objectFit: isScreenSharing ? 'contain' : 'cover',
            transform: isSelf && !isScreenSharing ? 'scaleX(-1)' : 'none',
            backgroundColor: isScreenSharing ? '#000000' : 'transparent',
          }}
        />
      )}

      {/* Screen Sharing Indicator Tag (Top Left) */}
      {isScreenSharing && (
        <div
          style={{
            position: 'absolute',
            top: '10px',
            left: '10px',
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            backdropFilter: 'blur(8px)',
            color: '#ffffff',
            padding: '3px 8px',
            borderRadius: tokens.borderRadius.sm,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '11px',
            fontWeight: 500,
          }}
        >
          <Monitor size={12} color="#38bdf8" />
          <span>Screen Presentation</span>
        </div>
      )}

      {/* Remote Peer Connection Status Badge (Top Right) */}
      {!isSelf && connectionStatus && connectionStatus !== 'connected' && (
        <div
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            backgroundColor: 'rgba(255, 255, 255, 0.92)',
            backdropFilter: 'blur(8px)',
            padding: '3px 8px',
            borderRadius: tokens.borderRadius.sm,
            border: `1px solid ${tokens.colors.surfaceBorder}`,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '11px',
            color:
              connectionStatus === 'failed'
                ? tokens.colors.error
                : tokens.colors.warning,
          }}
        >
          {connectionStatus === 'connecting' && (
            <>
              <Loader2 size={12} className="spin-animation" />
              <span>Connecting...</span>
            </>
          )}
          {connectionStatus === 'reconnecting' && (
            <>
              <Loader2 size={12} className="spin-animation" />
              <span>Reconnecting...</span>
            </>
          )}
          {connectionStatus === 'failed' && (
            <>
              <AlertCircle size={12} />
              <span>Connection Failed</span>
            </>
          )}
        </div>
      )}

      {/* Bottom Info Bar */}
      <div
        style={{
          position: 'absolute',
          bottom: '10px',
          left: '10px',
          right: '10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pointerEvents: 'none',
        }}
      >
        {/* Name and Role Tag */}
        <div
          style={{
            backgroundColor: 'rgba(255, 255, 255, 0.92)',
            backdropFilter: 'blur(8px)',
            padding: '3px 8px',
            borderRadius: tokens.borderRadius.sm,
            border: `1px solid ${tokens.colors.surfaceBorder}`,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '12px',
            fontWeight: 500,
            color: tokens.colors.textPrimary,
            boxShadow: tokens.shadows.subtle,
            maxWidth: '75%',
          }}
        >
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {displayName} {isSelf && '(You)'}
          </span>

          {role === 'host' && (
            <span
              style={{
                fontSize: '10px',
                fontWeight: 600,
                color: tokens.colors.accentPrimary,
                backgroundColor: tokens.colors.accentPrimaryLight,
                padding: '1px 5px',
                borderRadius: '3px',
                border: `1px solid ${tokens.colors.accentPrimaryBorder}`,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '2px',
              }}
            >
              <Shield size={9} /> Host
            </span>
          )}

          <div style={{ display: 'inline-flex', alignItems: 'center' }}>
            {isMuted ? (
              <MicOff size={13} color={tokens.colors.error} />
            ) : (
              <Mic size={13} color={tokens.colors.success} />
            )}
          </div>
        </div>

        {/* Remote Volume Adjuster */}
        {!isSelf && onVolumeChange && (
          <div style={{ pointerEvents: 'auto' }}>
            <Popover
              content={volumeMenu}
              trigger="click"
              open={volSliderOpen}
              onOpenChange={setVolSliderOpen}
              placement="topRight"
            >
              <button
                type="button"
                aria-label={`Adjust volume for ${displayName}`}
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.92)',
                  backdropFilter: 'blur(8px)',
                  border: `1px solid ${tokens.colors.surfaceBorder}`,
                  borderRadius: tokens.borderRadius.sm,
                  padding: '4px 6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: tokens.shadows.subtle,
                }}
              >
                {getVolumeIcon()}
              </button>
            </Popover>
          </div>
        )}
      </div>
    </div>
  );
};

export const VideoGrid: React.FC<VideoGridProps> = ({
  participants,
  activeSpeakerId,
  localStream,
  screenStream,
  isAudioMuted = false,
  isVideoOff = false,
  isScreenSharing = false,
  remotePeers,
  onVolumeChange,
}) => {
  // Check if anyone (local or remote) is actively sharing their screen
  const isLocalSharing = Boolean(isScreenSharing && screenStream);
  const remoteSharingPeer = Array.from(remotePeers.values()).find(
    (p) => p.isScreenSharing && p.stream
  );
  const activeScreenSharer = isLocalSharing
    ? { isSelf: true, stream: screenStream, name: 'Your Screen' }
    : remoteSharingPeer
    ? {
        isSelf: false,
        stream: remoteSharingPeer.stream,
        name: `${remoteSharingPeer.displayName}'s Screen`,
      }
    : null;

  // Grid calculation when not in presentation/spotlight mode
  const totalTiles = participants.length;
  const getGridConfig = () => {
    if (totalTiles <= 1) return { cols: '1fr', rows: '1fr' };
    if (totalTiles === 2) return { cols: 'repeat(2, 1fr)', rows: '1fr' };
    if (totalTiles <= 4) return { cols: 'repeat(2, 1fr)', rows: 'repeat(2, 1fr)' };
    if (totalTiles <= 6) return { cols: 'repeat(3, 1fr)', rows: 'repeat(2, 1fr)' };
    return { cols: 'repeat(3, 1fr)', rows: 'repeat(auto-fit, minmax(200px, 1fr))' };
  };

  // SPOTLIGHT PRESENTATION MODE: Shared screen occupies primary stage
  if (activeScreenSharer) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          padding: '12px',
          boxSizing: 'border-box',
          gap: '12px',
        }}
      >
        {/* Main Stage: Screen Share */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <VideoTile
            stream={activeScreenSharer.stream}
            isSelf={activeScreenSharer.isSelf}
            isScreenSharing={true}
            isMuted={false}
            isVideoOff={false}
            displayName={activeScreenSharer.name}
            style={{ width: '100%', height: '100%', minHeight: '300px' }}
          />
        </div>

        {/* Filmstrip of participant camera feeds */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            overflowX: 'auto',
            paddingBottom: '4px',
            height: '140px',
            flexShrink: 0,
          }}
        >
          {participants.map((p) => {
            const remote = remotePeers.get(p.id);
            const stream = p.isSelf ? localStream : remote?.stream || null;
            const muted = p.isSelf ? isAudioMuted : (p.isMuted ?? remote?.isAudioMuted ?? false);
            const videoDisabled = p.isSelf
              ? isVideoOff
              : (p.isVideoOff ?? remote?.isVideoOff ?? false);
            const vol = remote?.volume ?? 1.0;

            return (
              <div
                key={p.id}
                style={{
                  width: '200px',
                  height: '100%',
                  flexShrink: 0,
                }}
              >
                <VideoTile
                  stream={stream}
                  isSelf={Boolean(p.isSelf)}
                  isScreenSharing={false}
                  isMuted={muted}
                  isVideoOff={videoDisabled}
                  displayName={p.displayName || p.name}
                  role={p.role}
                  connectionStatus={remote?.connectionState}
                  isActiveSpeaker={p.id === activeSpeakerId}
                  volume={vol}
                  onVolumeChange={(val) => onVolumeChange?.(p.id, val)}
                />
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // STANDARD BALANCED GRID MODE
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
        const remote = remotePeers.get(p.id);
        const stream = p.isSelf ? localStream : remote?.stream || null;
        const muted = p.isSelf ? isAudioMuted : (p.isMuted ?? remote?.isAudioMuted ?? false);
        const videoDisabled = p.isSelf
          ? isVideoOff
          : (p.isVideoOff ?? remote?.isVideoOff ?? false);
        const sharing = p.isSelf
          ? Boolean(isScreenSharing)
          : (p.isScreenSharing ?? remote?.isScreenSharing ?? false);
        const vol = remote?.volume ?? 1.0;

        return (
          <VideoTile
            key={p.id}
            stream={stream}
            isSelf={Boolean(p.isSelf)}
            isScreenSharing={sharing}
            isMuted={muted}
            isVideoOff={videoDisabled}
            displayName={p.displayName || p.name}
            role={p.role}
            connectionStatus={remote?.connectionState}
            isActiveSpeaker={p.id === activeSpeakerId}
            volume={vol}
            onVolumeChange={(val) => onVolumeChange?.(p.id, val)}
          />
        );
      })}
    </div>
  );
};
