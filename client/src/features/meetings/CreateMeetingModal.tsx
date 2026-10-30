import React, { useState } from 'react';
import { Modal, Input, Switch, Button, Space, Typography, App } from 'antd';
import { Video, Mic, Copy, Check, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { meetingApi } from '../../services/meeting.service';
import { FormField } from '../../components/forms';
import { tokens } from '../../styles/tokens';

const { Text } = Typography;

interface CreateMeetingModalProps {
  open: boolean;
  onClose: () => void;
  onMeetingCreated?: (code: string) => void;
}

export const CreateMeetingModal: React.FC<CreateMeetingModalProps> = ({
  open,
  onClose,
  onMeetingCreated,
}) => {
  const navigate = useNavigate();
  const { message } = App.useApp();

  const [title, setTitle] = useState('Sync Discussion');
  const [isEphemeral, setIsEphemeral] = useState(true);
  const [muteMic, setMuteMic] = useState(false);
  const [turnOffCam, setTurnOffCam] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleStartInstant = async () => {
    try {
      setLoading(true);
      const meeting = await meetingApi.createMeeting({
        title: title.trim() || 'Sync Discussion',
        isEphemeral,
      });

      message.success(`Meeting created: ${meeting.meetingCode}`);
      onClose();
      if (onMeetingCreated) onMeetingCreated(meeting.meetingCode);

      navigate(`/meeting/${meeting.meetingCode}`, {
        state: {
          meetingTitle: meeting.title,
          muteMic,
          turnOffCam,
          meetingRecord: meeting,
        },
      });
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to create meeting room';
      message.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyInvite = async () => {
    try {
      setLoading(true);
      const meeting = await meetingApi.createMeeting({
        title: title.trim() || 'Sync Discussion',
        isEphemeral,
      });

      const link = `${window.location.origin}/meeting/${meeting.meetingCode}`;
      await navigator.clipboard.writeText(link);
      setCopiedLink(true);
      message.success(`Meeting room ${meeting.meetingCode} created and link copied!`);
      if (onMeetingCreated) onMeetingCreated(meeting.meetingCode);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to generate meeting link';
      message.error(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Video size={18} color={tokens.colors.accentPrimary} />
          <span style={{ fontWeight: 600 }}>Create New Meeting</span>
        </div>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={480}
      destroyOnClose
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', paddingTop: '12px' }}>
        <FormField label="Meeting Topic" id="meeting-title">
          <Input
            id="meeting-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Full-Stack Architecture Review"
            maxLength={80}
            size="middle"
          />
        </FormField>

        {/* Room Persistence & Security */}
        <div
          style={{
            padding: '14px',
            backgroundColor: tokens.colors.surfaceSecondary,
            border: `1px solid ${tokens.colors.surfaceBorder}`,
            borderRadius: tokens.borderRadius.base,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Space size={8} align="center">
              <Clock size={16} color={tokens.colors.textSecondary} />
              <div>
                <Text style={{ fontSize: '13px', fontWeight: 500, color: tokens.colors.textPrimary, display: 'block' }}>
                  Ephemeral Meeting (24h Expiry)
                </Text>
                <Text type="secondary" style={{ fontSize: '11.5px' }}>
                  Automatically cleaned up after 24 hours via Temporal lifecycle.
                </Text>
              </div>
            </Space>
            <Switch
              size="small"
              checked={isEphemeral}
              onChange={setIsEphemeral}
            />
          </div>
        </div>

        {/* Audio & Video Entry Preferences */}
        <div
          style={{
            padding: '14px',
            backgroundColor: tokens.colors.surfaceSecondary,
            border: `1px solid ${tokens.colors.surfaceBorder}`,
            borderRadius: tokens.borderRadius.base,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Space size={8} align="center">
              <Mic size={15} color={tokens.colors.textSecondary} />
              <Text style={{ fontSize: '13px', color: tokens.colors.textPrimary }}>
                Mute microphone on entry
              </Text>
            </Space>
            <Switch size="small" checked={muteMic} onChange={setMuteMic} />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Space size={8} align="center">
              <Video size={15} color={tokens.colors.textSecondary} />
              <Text style={{ fontSize: '13px', color: tokens.colors.textPrimary }}>
                Turn off camera on entry
              </Text>
            </Space>
            <Switch size="small" checked={turnOffCam} onChange={setTurnOffCam} />
          </div>
        </div>

        {/* Modal Actions */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '8px',
          }}
        >
          <Button
            icon={
              copiedLink ? <Check size={14} color={tokens.colors.success} /> : <Copy size={14} />
            }
            onClick={handleCopyInvite}
            loading={loading}
          >
            {copiedLink ? 'Link Copied' : 'Create & Copy Link'}
          </Button>

          <Space size={8}>
            <Button onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="primary" onClick={handleStartInstant} loading={loading}>
              Start Meeting
            </Button>
          </Space>
        </div>
      </div>
    </Modal>
  );
};
