import React from 'react';
import { Button, Tooltip, Badge } from 'antd';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  MonitorOff,
  MessageSquare,
  Users,
  Settings,
  PhoneOff,
  CircleDot,
  Pause,
  Play,
  Square,
} from 'lucide-react';
import { tokens } from '../../styles/tokens';
import type { RecordingState } from '../../features/recording';

interface MeetingControlDockProps {
  micActive: boolean;
  camActive: boolean;
  screenSharing: boolean;
  chatOpen: boolean;
  rosterOpen: boolean;
  participantCount: number;
  unreadCount?: number;
  recordingState?: RecordingState;
  recordDurationSeconds?: number;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onToggleScreenShare: () => void;
  onToggleChat: () => void;
  onToggleRoster: () => void;
  onOpenSettings?: () => void;
  onStartRecord?: () => void;
  onPauseRecord?: () => void;
  onResumeRecord?: () => void;
  onStopRecord?: () => void;
  onLeave: () => void;
}

export const MeetingControlDock: React.FC<MeetingControlDockProps> = ({
  micActive,
  camActive,
  screenSharing,
  chatOpen,
  rosterOpen,
  participantCount,
  unreadCount = 0,
  recordingState = 'idle',
  recordDurationSeconds = 0,
  onToggleMic,
  onToggleCam,
  onToggleScreenShare,
  onToggleChat,
  onToggleRoster,
  onOpenSettings,
  onStartRecord,
  onPauseRecord,
  onResumeRecord,
  onStopRecord,
  onLeave,
}) => {
  const formatRecordTime = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const isRecording = recordingState === 'recording' || recordingState === 'paused';

  return (
    <div
      style={{
        display: 'inline-flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '10px',
        padding: '8px 18px',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(12px)',
        border: `1px solid ${tokens.colors.surfaceBorder}`,
        borderRadius: '36px',
        boxShadow: tokens.shadows.elevated,
        maxWidth: '95vw',
        boxSizing: 'border-box',
      }}
    >
      {/* Microphone Toggle (Ctrl+D) */}
      <Tooltip title={micActive ? 'Mute Microphone (Ctrl+D)' : 'Unmute Microphone (Ctrl+D)'}>
        <Button
          shape="circle"
          size="large"
          danger={!micActive}
          type={micActive ? 'default' : 'primary'}
          icon={micActive ? <Mic size={18} /> : <MicOff size={18} />}
          onClick={onToggleMic}
          aria-label={micActive ? 'Mute microphone' : 'Unmute microphone'}
        />
      </Tooltip>

      {/* Camera Toggle (Ctrl+E) */}
      <Tooltip title={camActive ? 'Turn Off Camera (Ctrl+E)' : 'Turn On Camera (Ctrl+E)'}>
        <Button
          shape="circle"
          size="large"
          danger={!camActive}
          type={camActive ? 'default' : 'primary'}
          icon={camActive ? <Video size={18} /> : <VideoOff size={18} />}
          onClick={onToggleCam}
          aria-label={camActive ? 'Turn off camera' : 'Turn on camera'}
        />
      </Tooltip>

      {/* Screen Share */}
      <Tooltip title={screenSharing ? 'Stop Screen Sharing' : 'Share Screen'}>
        <Button
          shape="circle"
          size="large"
          type={screenSharing ? 'primary' : 'default'}
          icon={screenSharing ? <MonitorOff size={18} /> : <MonitorUp size={18} />}
          onClick={onToggleScreenShare}
          aria-label="Toggle screen share"
        />
      </Tooltip>

      {/* Screen Share Recording Controls */}
      {isRecording ? (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            backgroundColor: tokens.colors.errorLight,
            borderRadius: '24px',
            border: `1px solid ${tokens.colors.errorBorder}`,
          }}
        >
          {/* Pulsing REC Dot */}
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: tokens.colors.error,
              animation: recordingState === 'recording' ? 'pulse 1.2s infinite' : 'none',
            }}
          />
          <span
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: tokens.colors.error,
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            REC {formatRecordTime(recordDurationSeconds)}
          </span>

          {/* Pause / Resume */}
          {recordingState === 'recording' ? (
            <Tooltip title="Pause Recording">
              <Button
                type="text"
                size="small"
                shape="circle"
                icon={<Pause size={13} color={tokens.colors.error} />}
                onClick={onPauseRecord}
                aria-label="Pause recording"
              />
            </Tooltip>
          ) : (
            <Tooltip title="Resume Recording">
              <Button
                type="text"
                size="small"
                shape="circle"
                icon={<Play size={13} color={tokens.colors.error} />}
                onClick={onResumeRecord}
                aria-label="Resume recording"
              />
            </Tooltip>
          )}

          {/* Stop Recording */}
          <Tooltip title="Stop & Save Recording">
            <Button
              type="text"
              size="small"
              shape="circle"
              icon={<Square size={13} color={tokens.colors.error} fill={tokens.colors.error} />}
              onClick={onStopRecord}
              aria-label="Stop recording"
            />
          </Tooltip>
        </div>
      ) : (
        onStartRecord && (
          <Tooltip
            title={
              screenSharing
                ? 'Record Screen Share (MediaRecorder)'
                : 'Share your screen first to record'
            }
          >
            <Button
              shape="circle"
              size="large"
              type="default"
              disabled={!screenSharing}
              icon={<CircleDot size={18} color={screenSharing ? tokens.colors.error : undefined} />}
              onClick={onStartRecord}
              aria-label="Start screen recording"
            />
          </Tooltip>
        )
      )}

      {/* In-Call Chat */}
      <Tooltip title="In-Call Chat">
        <Badge count={unreadCount} size="small" offset={[-2, 4]}>
          <Button
            shape="circle"
            size="large"
            type={chatOpen ? 'primary' : 'default'}
            icon={<MessageSquare size={18} />}
            onClick={onToggleChat}
            aria-label="Toggle chat panel"
          />
        </Badge>
      </Tooltip>

      {/* Participants Roster */}
      <Tooltip title={`Participants (${participantCount})`}>
        <Badge count={participantCount} overflowCount={99} size="small" offset={[-2, 4]}>
          <Button
            shape="circle"
            size="large"
            type={rosterOpen ? 'primary' : 'default'}
            icon={<Users size={18} />}
            onClick={onToggleRoster}
            aria-label="Toggle participants roster"
          />
        </Badge>
      </Tooltip>

      {/* Settings */}
      {onOpenSettings && (
        <Tooltip title="Device Settings">
          <Button
            shape="circle"
            size="large"
            icon={<Settings size={18} />}
            onClick={onOpenSettings}
            aria-label="Open device settings"
          />
        </Tooltip>
      )}

      {/* Leave Meeting (End Call) */}
      <Tooltip title="Leave or End Meeting">
        <Button
          type="primary"
          danger
          size="large"
          icon={<PhoneOff size={18} />}
          onClick={onLeave}
          style={{
            borderRadius: '24px',
            paddingInline: '18px',
            fontWeight: 600,
          }}
        >
          Leave
        </Button>
      </Tooltip>
    </div>
  );
};
