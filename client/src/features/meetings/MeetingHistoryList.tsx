import React, { useState, useEffect, useCallback } from 'react';
import { Typography, Input, Button, Space, Empty, Spin, App } from 'antd';
import { Search, RotateCcw, Copy, Check, Users, Clock, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { meetingApi } from '../../services/meeting.service';
import { formatMeetingDate, formatMeetingDuration } from '../../utils';
import { tokens } from '../../styles/tokens';
import type { MeetingRecord } from '../../types';

const { Title, Text } = Typography;

interface MeetingHistoryListProps {
  limit?: number;
  showTitle?: boolean;
}

export const MeetingHistoryList: React.FC<MeetingHistoryListProps> = ({
  limit,
  showTitle = true,
}) => {
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [meetings, setMeetings] = useState<MeetingRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchMeetings = useCallback(async () => {
    try {
      setLoading(true);
      const data = await meetingApi.getMeetingHistory();
      setMeetings(data);
    } catch {
      setMeetings([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  const filteredMeetings = meetings.filter((item) => {
    const code = item.meetingCode || item.code || '';
    const query = searchQuery.toLowerCase();
    return item.title.toLowerCase().includes(query) || code.toLowerCase().includes(query);
  });

  const displayList = limit ? filteredMeetings.slice(0, limit) : filteredMeetings;

  const handleCopyLink = (code: string, id: string) => {
    const link = `${window.location.origin}/meeting/${code}`;
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    message.success('Invite link copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRejoin = (code: string) => {
    navigate(`/meeting/${code}`);
  };

  return (
    <div style={{ width: '100%' }}>
      {showTitle && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            marginBottom: '16px',
          }}
        >
          <div>
            <Title level={4} style={{ margin: 0, fontWeight: 600, color: tokens.colors.textPrimary }}>
              Recent Meetings
            </Title>
            <Text type="secondary" style={{ fontSize: '13px' }}>
              Real-time history from your secure sessions. Rejoin rooms or copy links.
            </Text>
          </div>

          <Space size={8}>
            <Button
              size="middle"
              icon={<RefreshCw size={14} className={loading ? 'animate-spin' : ''} />}
              onClick={fetchMeetings}
              disabled={loading}
            >
              Refresh
            </Button>
            <div style={{ width: '220px' }}>
              <Input
                prefix={<Search size={14} color={tokens.colors.textLight} />}
                placeholder="Search meetings..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                size="middle"
                allowClear
              />
            </div>
          </Space>
        </div>
      )}

      {loading ? (
        <div
          style={{
            padding: '48px 16px',
            backgroundColor: tokens.colors.surfacePrimary,
            borderRadius: tokens.borderRadius.md,
            border: `1px solid ${tokens.colors.surfaceBorder}`,
            textAlign: 'center',
          }}
        >
          <Spin size="default" />
          <div style={{ marginTop: '12px', fontSize: '13px', color: tokens.colors.textSecondary }}>
            Loading meeting history...
          </div>
        </div>
      ) : displayList.length === 0 ? (
        <div
          style={{
            padding: '40px 16px',
            backgroundColor: tokens.colors.surfacePrimary,
            borderRadius: tokens.borderRadius.md,
            border: `1px solid ${tokens.colors.surfaceBorder}`,
            textAlign: 'center',
          }}
        >
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <div>
                <Text type="secondary" style={{ fontSize: '13px', display: 'block' }}>
                  {searchQuery ? 'No meetings matched your search query' : 'No meeting history found'}
                </Text>
                <Text type="secondary" style={{ fontSize: '12px', color: tokens.colors.textMuted }}>
                  Meetings you create or join will automatically appear here.
                </Text>
              </div>
            }
          />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {displayList.map((meet) => {
            const code = meet.meetingCode || meet.code || '';
            const dateStr = meet.startedAt || meet.createdAt;
            return (
              <div
                key={meet.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  backgroundColor: tokens.colors.surfacePrimary,
                  borderRadius: tokens.borderRadius.base,
                  border: `1px solid ${tokens.colors.surfaceBorder}`,
                  transition: 'border-color 0.15s ease',
                  flexWrap: 'wrap',
                  gap: '12px',
                }}
              >
                <div style={{ minWidth: '180px' }}>
                  <div style={{ fontWeight: 600, fontSize: '14px', color: tokens.colors.textPrimary }}>
                    {meet.title}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      marginTop: '3px',
                    }}
                  >
                    <span
                      style={{
                        fontFamily: 'monospace',
                        fontSize: '12px',
                        color: tokens.colors.textMuted,
                        backgroundColor: tokens.colors.surfaceSecondary,
                        padding: '1px 6px',
                        borderRadius: tokens.borderRadius.sm,
                        border: `1px solid ${tokens.colors.surfaceBorder}`,
                      }}
                    >
                      {code}
                    </span>
                    <span style={{ fontSize: '12px', color: tokens.colors.textSecondary }}>
                      {dateStr ? formatMeetingDate(dateStr) : 'Active'}
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    color: tokens.colors.textSecondary,
                    fontSize: '13px',
                  }}
                >
                  {meet.durationMinutes !== undefined && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Clock size={13} color={tokens.colors.textLight} />
                      <span>{formatMeetingDuration(meet.durationMinutes)}</span>
                    </div>
                  )}

                  {meet.participantsCount !== undefined && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Users size={13} color={tokens.colors.textLight} />
                      <span>{meet.participantsCount}</span>
                    </div>
                  )}

                  <Space size={6}>
                    <Button
                      size="small"
                      icon={
                        copiedId === meet.id ? (
                          <Check size={13} color={tokens.colors.success} />
                        ) : (
                          <Copy size={13} />
                        )
                      }
                      onClick={() => handleCopyLink(code, meet.id)}
                    >
                      {copiedId === meet.id ? 'Copied' : 'Link'}
                    </Button>

                    <Button
                      size="small"
                      type="primary"
                      icon={<RotateCcw size={13} />}
                      onClick={() => handleRejoin(code)}
                    >
                      Rejoin
                    </Button>
                  </Space>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
