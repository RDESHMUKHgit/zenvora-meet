import React, { useState } from 'react';
import { Input, Button, Alert, App } from 'antd';
import { LogIn, KeyRound, User, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { FormField } from '../../components/forms';
import { useAuth } from '../../contexts';
import { meetingApi } from '../../services/meeting.service';
import { tokens } from '../../styles/tokens';

export const JoinMeetingArea: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { message } = App.useApp();

  const [meetingCode, setMeetingCode] = useState('');
  const [displayName, setDisplayName] = useState(user?.name || '');
  const [isValidating, setIsValidating] = useState(false);
  const [errors, setErrors] = useState<{ code?: string; name?: string; general?: string }>({});

  const extractMeetingCode = (input: string): string => {
    let clean = input.trim().toLowerCase();
    if (clean.includes('/meeting/')) {
      clean = clean.split('/meeting/')[1]?.split('?')[0] || clean;
    }
    return clean;
  };

  const validate = (): boolean => {
    const newErrors: { code?: string; name?: string } = {};

    const cleanCode = extractMeetingCode(meetingCode);
    if (!cleanCode) {
      newErrors.code = 'Meeting ID or invite link is required';
    } else if (cleanCode.length < 5) {
      newErrors.code = 'Please enter a valid meeting code (e.g. rdm-abc-xyz)';
    }

    const cleanName = displayName.trim();
    if (!cleanName) {
      newErrors.name = 'Please provide your display name';
    } else if (cleanName.length < 2) {
      newErrors.name = 'Display name must be at least 2 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    const finalCode = extractMeetingCode(meetingCode);
    const finalName = displayName.trim();

    try {
      setIsValidating(true);
      setErrors({});

      // Validate against PostgreSQL backend
      const meeting = await meetingApi.getMeetingByCode(finalCode);

      // Register participant record in backend
      await meetingApi.joinMeeting(finalCode, finalName);

      message.success(`Joining ${meeting.title}...`);
      navigate(`/meeting/${finalCode}`, {
        state: {
          meetingTitle: meeting.title,
          displayName: finalName,
          meetingRecord: meeting,
        },
      });
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error ? err.message : `Meeting '${finalCode}' not found or has expired`;
      setErrors({ general: errorMsg });
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <form onSubmit={handleJoin} style={{ width: '100%', maxWidth: '420px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {errors.general && (
          <Alert
            type="error"
            message={errors.general}
            showIcon
            closable
            onClose={() => setErrors((p) => ({ ...p, general: undefined }))}
            style={{ fontSize: '13px' }}
          />
        )}

        <FormField label="Meeting Code or Link" id="join-meeting-code" error={errors.code}>
          <Input
            id="join-meeting-code"
            prefix={<KeyRound size={14} color={tokens.colors.textLight} />}
            value={meetingCode}
            onChange={(e) => {
              setMeetingCode(e.target.value);
              if (errors.code || errors.general) {
                setErrors((prev) => ({ ...prev, code: undefined, general: undefined }));
              }
            }}
            placeholder="e.g. rdm-abc-xyz or paste invite URL"
            size="middle"
          />
        </FormField>

        <FormField label="Your Display Name" id="join-display-name" error={errors.name}>
          <Input
            id="join-display-name"
            prefix={<User size={14} color={tokens.colors.textLight} />}
            value={displayName}
            onChange={(e) => {
              setDisplayName(e.target.value);
              if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }));
            }}
            placeholder="Enter how you appear in meeting"
            size="middle"
          />
        </FormField>

        <Button
          type="default"
          htmlType="submit"
          icon={isValidating ? <Loader2 size={15} className="animate-spin" /> : <LogIn size={15} />}
          loading={isValidating}
          style={{
            marginTop: '4px',
            height: '42px',
            fontWeight: 500,
            borderColor: tokens.colors.accentPrimary,
            color: tokens.colors.accentPrimary,
          }}
        >
          {isValidating ? 'Verifying Room...' : 'Join Meeting'}
        </Button>
      </div>
    </form>
  );
};
