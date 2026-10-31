import React, { useState, useEffect } from 'react';
import { Modal, Input, Switch, Select, Button, Space, Typography, App } from 'antd';
import { Video, Mic, Copy, Check, Users, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts';
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
  const { user } = useAuth();
  const { message } = App.useApp();

  const [title, setTitle] = useState('Sync Discussion');
  const [displayName, setDisplayName] = useState(
    () => user?.name || (typeof window !== 'undefined' ? localStorage.getItem('rd_display_name') : null) || ''
  );
  const [maxParticipants, setMaxParticipants] = useState<number>(0);
  const isEphemeral = true;
  const [muteMic, setMuteMic] = useState(false);
  const [turnOffCam, setTurnOffCam] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    if (user?.name && !displayName) {
      setDisplayName(user.name);
    }
  }, [user, displayName]);

  const validate = (): boolean => {
    if (!displayName.trim()) {
      setNameError('Please enter your display name');
      return false;
    }
    if (displayName.trim().length < 2) {
      setNameError('Display name must be at least 2 characters');
      return false;
    }
    setNameError(null);
    return true;
  };

  const handleStartInstant = async () => {
    if (!validate()) return;

    try {
      setLoading(true);
      const res = await meetingApi.createMeeting({
        title: title.trim() || 'Sync Discussion',
        displayName: displayName.trim(),
        maxParticipants,
        isEphemeral,
      });

      // Securely store hostToken and participant identity for host authorization
      if (res.hostToken) {
        localStorage.setItem(`rd_host_token_${res.meeting.meetingCode}`, res.hostToken);
      }
      localStorage.setItem('rd_display_name', displayName.trim());
      localStorage.setItem(`rd_display_name_${res.meeting.meetingCode}`, displayName.trim());
      localStorage.setItem(`rd_p_id_${res.meeting.meetingCode}`, res.participant.id);

      message.success(`Meeting created: ${res.meeting.meetingCode}`);
      onClose();
      if (onMeetingCreated) onMeetingCreated(res.meeting.meetingCode);

      navigate(`/meeting/${res.meeting.meetingCode}`, {
        state: {
          meetingTitle: res.meeting.title,
          displayName: displayName.trim(),
          hostToken: res.hostToken,
          participantId: res.participant.id,
          role: 'host',
          muteMic,
          turnOffCam,
          meetingRecord: res.meeting,
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
    if (!validate()) return;

    try {
      setLoading(true);
      const res = await meetingApi.createMeeting({
        title: title.trim() || 'Sync Discussion',
        displayName: displayName.trim(),
        maxParticipants,
        isEphemeral,
      });

      if (res.hostToken) {
        localStorage.setItem(`rd_host_token_${res.meeting.meetingCode}`, res.hostToken);
      }

      const link = `${window.location.origin}/meeting/${res.meeting.meetingCode}`;
      await navigator.clipboard.writeText(link);
      setCopiedLink(true);
      message.success(`Meeting ${res.meeting.meetingCode} created and link copied!`);
      if (onMeetingCreated) onMeetingCreated(res.meeting.meetingCode);
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
          <span style={{ fontWeight: 600 }}>Create Meeting & Instant Host</span>
        </div>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={480}
      destroyOnHidden
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', paddingTop: '10px' }}>
        {/* Meeting Topic */}
        <FormField label="Meeting Topic" id="meeting-title">
          <Input
            id="meeting-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Full-Stack Sync"
            maxLength={80}
            size="middle"
          />
        </FormField>

        {/* Display Name (Required for guests, customizable for users) */}
        <FormField label="Your Host Display Name" id="host-display-name" error={nameError || undefined} required>
          <Input
            id="host-display-name"
            prefix={<User size={15} color={tokens.colors.textLight} />}
            value={displayName}
            onChange={(e) => {
              setDisplayName(e.target.value);
              if (nameError) setNameError(null);
            }}
            placeholder="How you will appear as host"
            maxLength={50}
            size="middle"
          />
        </FormField>

        {/* Maximum Total Participants Configuration */}
        <FormField label="Maximum Total Participants" id="max-participants">
          <Select
            id="max-participants"
            value={maxParticipants}
            onChange={(val) => setMaxParticipants(val)}
            style={{ width: '100%' }}
            size="middle"
            suffixIcon={<Users size={14} color={tokens.colors.textLight} />}
            options={[
              { value: 0, label: 'Unlimited (No cap)' },
              { value: 2, label: '2 Participants (1-on-1 Meeting)' },
              { value: 4, label: '4 Participants (Small Team)' },
              { value: 8, label: '8 Participants (Group Discussion)' },
            ]}
          />
        </FormField>

        {/* Audio & Video Entry Preferences */}
        <div
          style={{
            padding: '12px 14px',
            backgroundColor: tokens.colors.surfaceSecondary,
            border: `1px solid ${tokens.colors.surfaceBorder}`,
            borderRadius: tokens.borderRadius.base,
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
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
            marginTop: '6px',
          }}
        >
          <Button
            icon={
              copiedLink ? <Check size={14} color={tokens.colors.success} /> : <Copy size={14} />
            }
            onClick={handleCopyInvite}
            loading={loading}
          >
            {copiedLink ? 'Link Copied' : 'Create & Copy'}
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
