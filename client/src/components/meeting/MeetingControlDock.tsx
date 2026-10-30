import React from 'react';
import { Button, Tooltip, Badge } from 'antd';
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  MessageSquare,
  Users,
  Settings,
  PhoneOff,
} from 'lucide-react';
import { tokens } from '../../styles/tokens';

interface MeetingControlDockProps {
  micActive: boolean;
  camActive: boolean;
  screenSharing: boolean;
  chatOpen: boolean;
  rosterOpen: boolean;
  participantCount: number;
  unreadCount?: number;
  onToggleMic: () => void;
  onToggleCam: () => void;
  onToggleScreenShare: () => void;
  onToggleChat: () => void;
  onToggleRoster: () => void;
  onOpenSettings?: () => void;
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
  onToggleMic,
  onToggleCam,
  onToggleScreenShare,
  onToggleChat,
  onToggleRoster,
  onOpenSettings,
  onLeave,
}) => {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '10px',
        padding: '8px 18px',
        backgroundColor: tokens.colors.surfacePrimary,
        border: `1px solid ${tokens.colors.surfaceBorder}`,
        borderRadius: '32px',
        boxShadow: tokens.shadows.elevated,
      }}
    >
      {/* Microphone Toggle */}
      <Tooltip title={micActive ? 'Mute Microphone' : 'Unmute Microphone'}>
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

      {/* Camera Toggle */}
      <Tooltip title={camActive ? 'Turn Off Camera' : 'Turn On Camera'}>
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
      <Tooltip title={screenSharing ? 'Stop Sharing' : 'Share Screen'}>
        <Button
          shape="circle"
          size="large"
          type={screenSharing ? 'primary' : 'default'}
          icon={<MonitorUp size={18} />}
          onClick={onToggleScreenShare}
          aria-label="Toggle screen share"
        />
      </Tooltip>

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
      <Tooltip title="Leave Meeting">
        <Button
          type="primary"
          danger
          size="large"
          icon={<PhoneOff size={18} />}
          onClick={onLeave}
          style={{
            borderRadius: '20px',
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
