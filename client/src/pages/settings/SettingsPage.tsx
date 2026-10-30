import React, { useState, useEffect, useRef } from 'react';
import { Typography, Tabs, Select, Switch, Input, Button, Space, App } from 'antd';
import { Mic, Video, User, Sliders, Check } from 'lucide-react';
import { useAuth } from '../../contexts';
import { useDocumentTitle } from '../../hooks';
import { FormField } from '../../components/forms';
import { tokens } from '../../styles/tokens';
import type { DeviceSettings, AppPreferences } from '../../types';

const { Title, Text } = Typography;

export const SettingsPage: React.FC = () => {
  useDocumentTitle('Settings');
  const { user, updateProfile } = useAuth();
  const { message } = App.useApp();

  // Profile Form State
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [jobTitle, setJobTitle] = useState(user?.jobTitle || '');
  const [timezone, setTimezone] = useState(user?.timezone || 'Asia/Kolkata');

  // Device Settings State
  const [devices, setDevices] = useState<DeviceSettings>(() => {
    try {
      const stored = localStorage.getItem('rd_device_settings');
      if (stored) return JSON.parse(stored);
    } catch {
      // fallback
    }
    return {
      audioInputId: 'default-mic',
      videoInputId: 'default-cam',
      audioOutputId: 'default-speaker',
      noiseSuppression: true,
      mirrorVideo: true,
      hdQuality: true,
    };
  });

  // Preferences State
  const [preferences, setPreferences] = useState<AppPreferences>(() => {
    try {
      const stored = localStorage.getItem('rd_app_preferences');
      if (stored) return JSON.parse(stored);
    } catch {
      // fallback
    }
    return {
      theme: 'light',
      timeFormat: '12h',
      autoMuteMic: false,
      autoTurnOffCamera: false,
    };
  });

  // Audio Test State
  const [isTestingMic, setIsTestingMic] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const animationFrameRef = useRef<number | null>(null);

  // Sync profile when user changes
  useEffect(() => {
    if (user) {
      setName(user.name);
      setEmail(user.email);
      setJobTitle(user.jobTitle || '');
      setTimezone(user.timezone || 'Asia/Kolkata');
    }
  }, [user]);

  // Handle Audio Meter Simulation during Test
  useEffect(() => {
    if (isTestingMic) {
      const updateMeter = () => {
        // Natural speech level oscillation simulation
        const randomFluctuation = Math.sin(Date.now() / 150) * 25 + 40 + Math.random() * 20;
        setMicLevel(Math.max(10, Math.min(95, Math.floor(randomFluctuation))));
        animationFrameRef.current = requestAnimationFrame(updateMeter);
      };
      animationFrameRef.current = requestAnimationFrame(updateMeter);
    } else {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      setMicLevel(0);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isTestingMic]);

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile({ name, email, jobTitle, timezone });
    message.success('Profile updated successfully');
  };

  const handleDeviceChange = <K extends keyof DeviceSettings>(key: K, value: DeviceSettings[K]) => {
    const updated = { ...devices, [key]: value };
    setDevices(updated);
    localStorage.setItem('rd_device_settings', JSON.stringify(updated));
    message.success('Device setting updated');
  };

  const handlePreferenceChange = <K extends keyof AppPreferences>(
    key: K,
    value: AppPreferences[K],
  ) => {
    const updated = { ...preferences, [key]: value };
    setPreferences(updated);
    localStorage.setItem('rd_app_preferences', JSON.stringify(updated));
    message.success('Preference updated');
  };

  const audioInputOptions = [
    { value: 'default-mic', label: 'Default - MacBook Pro Microphone' },
    { value: 'external-mic', label: 'External USB Audio Interface' },
    { value: 'headset-mic', label: 'Wireless Headset Mic' },
  ];

  const videoInputOptions = [
    { value: 'default-cam', label: 'FaceTime HD Camera (Built-in)' },
    { value: 'external-cam', label: 'UltraHD 4K Webcam' },
    { value: 'virtual-cam', label: 'Virtual Camera Source' },
  ];

  const audioOutputOptions = [
    { value: 'default-speaker', label: 'Default - Internal Speakers' },
    { value: 'external-speaker', label: 'External Audio Output' },
    { value: 'headphones', label: 'Wireless Headphones' },
  ];

  const timezoneOptions = [
    { value: 'Asia/Kolkata', label: 'Asia/Kolkata (IST +05:30)' },
    { value: 'America/New_York', label: 'America/New York (EST -05:00)' },
    { value: 'America/Los_Angeles', label: 'America/Los Angeles (PST -08:00)' },
    { value: 'Europe/London', label: 'Europe/London (GMT +00:00)' },
    { value: 'Asia/Tokyo', label: 'Asia/Tokyo (JST +09:00)' },
    { value: 'Australia/Sydney', label: 'Australia/Sydney (AEST +10:00)' },
  ];

  const tabItems = [
    {
      key: 'audio-video',
      label: (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <Video size={16} /> Devices & Media
        </span>
      ),
      children: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', maxWidth: '640px' }}>
          <div>
            <Title level={4} style={{ margin: 0, fontWeight: 600 }}>
              Hardware Devices
            </Title>
            <Text type="secondary" style={{ fontSize: '13px' }}>
              Select audio and video input devices for conference calls.
            </Text>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <FormField label="Microphone (Audio Input)" id="mic-select">
              <Select
                id="mic-select"
                value={devices.audioInputId}
                options={audioInputOptions}
                onChange={(val) => handleDeviceChange('audioInputId', val)}
                style={{ width: '100%' }}
              />
            </FormField>

            {/* Live Audio Test Area */}
            <div
              style={{
                padding: '16px',
                backgroundColor: tokens.colors.surfaceSecondary,
                borderRadius: tokens.borderRadius.base,
                border: `1px solid ${tokens.colors.surfaceBorder}`,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: '10px',
                }}
              >
                <Space size={8}>
                  <Mic size={15} color={tokens.colors.textSecondary} />
                  <span
                    style={{ fontSize: '13px', fontWeight: 500, color: tokens.colors.textPrimary }}
                  >
                    Microphone Test
                  </span>
                </Space>

                <Button
                  size="small"
                  type={isTestingMic ? 'primary' : 'default'}
                  onClick={() => setIsTestingMic(!isTestingMic)}
                >
                  {isTestingMic ? 'Stop Test' : 'Test Mic'}
                </Button>
              </div>

              {/* Meter Bar */}
              <div
                style={{
                  height: '8px',
                  backgroundColor: tokens.colors.surfaceBorder,
                  borderRadius: '4px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${micLevel}%`,
                    backgroundColor:
                      micLevel > 80 ? tokens.colors.warning : tokens.colors.accentPrimary,
                    transition: 'width 0.08s ease-out, background-color 0.15s ease',
                  }}
                />
              </div>
            </div>

            <FormField label="Camera (Video Input)" id="cam-select">
              <Select
                id="cam-select"
                value={devices.videoInputId}
                options={videoInputOptions}
                onChange={(val) => handleDeviceChange('videoInputId', val)}
                style={{ width: '100%' }}
              />
            </FormField>

            <FormField label="Speakers (Audio Output)" id="speaker-select">
              <Select
                id="speaker-select"
                value={devices.audioOutputId}
                options={audioOutputOptions}
                onChange={(val) => handleDeviceChange('audioOutputId', val)}
                style={{ width: '100%' }}
              />
            </FormField>
          </div>

          <div
            style={{
              paddingTop: '16px',
              borderTop: `1px solid ${tokens.colors.surfaceBorderSubtle}`,
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div
                  style={{ fontWeight: 500, fontSize: '14px', color: tokens.colors.textPrimary }}
                >
                  High-Definition Video
                </div>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  Enable 720p/1080p stream transmission where bandwidth permits
                </Text>
              </div>
              <Switch
                checked={devices.hdQuality}
                onChange={(val) => handleDeviceChange('hdQuality', val)}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div
                  style={{ fontWeight: 500, fontSize: '14px', color: tokens.colors.textPrimary }}
                >
                  Noise Suppression
                </div>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  Filter background room noise using audio processing
                </Text>
              </div>
              <Switch
                checked={devices.noiseSuppression}
                onChange={(val) => handleDeviceChange('noiseSuppression', val)}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div
                  style={{ fontWeight: 500, fontSize: '14px', color: tokens.colors.textPrimary }}
                >
                  Mirror Video Preview
                </div>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  Flip your local camera feed horizontally for a natural view
                </Text>
              </div>
              <Switch
                checked={devices.mirrorVideo}
                onChange={(val) => handleDeviceChange('mirrorVideo', val)}
              />
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'preferences',
      label: (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <Sliders size={16} /> Meeting Defaults
        </span>
      ),
      children: (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '640px' }}>
          <div>
            <Title level={4} style={{ margin: 0, fontWeight: 600 }}>
              Entry Behavior
            </Title>
            <Text type="secondary" style={{ fontSize: '13px' }}>
              Configure your default microphone and camera states when connecting to rooms.
            </Text>
          </div>

          <div
            style={{
              padding: '16px',
              backgroundColor: tokens.colors.surfacePrimary,
              border: `1px solid ${tokens.colors.surfaceBorder}`,
              borderRadius: tokens.borderRadius.base,
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div
                  style={{ fontWeight: 500, fontSize: '14px', color: tokens.colors.textPrimary }}
                >
                  Always mute microphone on join
                </div>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  Microphone will be muted whenever you enter a meeting room
                </Text>
              </div>
              <Switch
                checked={preferences.autoMuteMic}
                onChange={(val) => handlePreferenceChange('autoMuteMic', val)}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div
                  style={{ fontWeight: 500, fontSize: '14px', color: tokens.colors.textPrimary }}
                >
                  Always turn camera off on join
                </div>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  Camera will be disabled by default upon entering a room
                </Text>
              </div>
              <Switch
                checked={preferences.autoTurnOffCamera}
                onChange={(val) => handlePreferenceChange('autoTurnOffCamera', val)}
              />
            </div>
          </div>
        </div>
      ),
    },
    {
      key: 'profile',
      label: (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <User size={16} /> Profile
        </span>
      ),
      children: (
        <form
          onSubmit={handleSaveProfile}
          style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '520px' }}
        >
          <div>
            <Title level={4} style={{ margin: 0, fontWeight: 600 }}>
              Account & Profile
            </Title>
            <Text type="secondary" style={{ fontSize: '13px' }}>
              Update your display identity and timezone settings.
            </Text>
          </div>

          <FormField label="Full Name" id="profile-name">
            <Input id="profile-name" value={name} onChange={(e) => setName(e.target.value)} />
          </FormField>

          <FormField label="Work Email" id="profile-email">
            <Input id="profile-email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </FormField>

          <FormField label="Job Title" id="profile-title">
            <Input
              id="profile-title"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
            />
          </FormField>

          <FormField label="Preferred Timezone" id="profile-timezone">
            <Select
              id="profile-timezone"
              value={timezone}
              options={timezoneOptions}
              onChange={setTimezone}
              style={{ width: '100%' }}
            />
          </FormField>

          <Button
            type="primary"
            htmlType="submit"
            icon={<Check size={14} />}
            style={{ width: 'fit-content', marginTop: '8px' }}
          >
            Save Changes
          </Button>
        </form>
      ),
    },
  ];

  return (
    <div className="page-container" style={{ paddingBottom: '48px' }}>
      <div style={{ marginBottom: '24px' }}>
        <Title level={2} style={{ margin: 0, fontWeight: 700, color: tokens.colors.textPrimary }}>
          Preferences & Settings
        </Title>
        <Text type="secondary" style={{ fontSize: '14px', marginTop: '4px', display: 'block' }}>
          Manage your audio, video, meeting defaults, and account information.
        </Text>
      </div>

      <div
        style={{
          backgroundColor: tokens.colors.surfacePrimary,
          border: `1px solid ${tokens.colors.surfaceBorder}`,
          borderRadius: tokens.borderRadius.lg,
          padding: '24px',
        }}
      >
        <Tabs defaultActiveKey="audio-video" items={tabItems} />
      </div>
    </div>
  );
};
