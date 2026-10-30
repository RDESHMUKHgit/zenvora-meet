import React, { useState, useEffect, useCallback } from 'react';
import { Typography, Input, Button, Table, Space, Modal, App, Spin, Empty } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { Search, RotateCcw, Copy, Check, Info, Video, Calendar, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useDocumentTitle } from '../../hooks';
import { meetingApi } from '../../services/meeting.service';
import { CreateMeetingModal } from '../../features/meetings';
import { formatMeetingDate } from '../../utils';
import { tokens } from '../../styles/tokens';
import type { MeetingRecord } from '../../types';

const { Title, Text } = Typography;

export const HistoryPage: React.FC = () => {
  useDocumentTitle('Meeting History');
  const navigate = useNavigate();
  const { message } = App.useApp();

  const [meetings, setMeetings] = useState<MeetingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingRecord | null>(null);
  const [createModalOpen, setCreateModalOpen] = useState(false);

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

  const filteredMeetings = meetings.filter((m) => {
    const code = m.meetingCode || m.code || '';
    const host = m.hostName || '';
    const query = search.toLowerCase();
    return (
      m.title.toLowerCase().includes(query) ||
      code.toLowerCase().includes(query) ||
      host.toLowerCase().includes(query)
    );
  });

  const handleCopyLink = (code: string, id: string) => {
    const link = `${window.location.origin}/meeting/${code}`;
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    message.success('Meeting link copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const columns: ColumnsType<MeetingRecord> = [
    {
      title: 'Meeting Topic',
      dataIndex: 'title',
      key: 'title',
      render: (title: string, record) => {
        const code = record.meetingCode || record.code || '';
        return (
          <div>
            <div style={{ fontWeight: 600, color: tokens.colors.textPrimary }}>{title}</div>
            <span
              style={{
                fontSize: '11px',
                color: tokens.colors.textMuted,
                fontFamily: 'monospace',
                backgroundColor: tokens.colors.surfaceSecondary,
                padding: '1px 5px',
                borderRadius: '4px',
              }}
            >
              {code}
            </span>
          </div>
        );
      },
    },
    {
      title: 'Date & Time',
      key: 'startedAt',
      render: (_, record) => {
        const dateStr = record.startedAt || record.createdAt;
        return (
          <span style={{ fontSize: '13px', color: tokens.colors.textSecondary }}>
            {dateStr ? formatMeetingDate(dateStr) : 'Active'}
          </span>
        );
      },
    },
    {
      title: 'Type / Status',
      key: 'status',
      render: (_, record) => (
        <span
          style={{
            fontSize: '12px',
            textTransform: 'capitalize',
            padding: '2px 8px',
            borderRadius: '4px',
            backgroundColor: record.isEphemeral ? tokens.colors.accentSecondaryLight : tokens.colors.surfaceSecondary,
            color: record.isEphemeral ? tokens.colors.accentPrimary : tokens.colors.textSecondary,
          }}
        >
          {record.isEphemeral ? 'Ephemeral' : record.status || 'Active'}
        </span>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record) => {
        const code = record.meetingCode || record.code || '';
        return (
          <Space size={6} align="center">
            <Button
              size="small"
              icon={
                copiedId === record.id ? (
                  <Check size={13} color={tokens.colors.success} />
                ) : (
                  <Copy size={13} />
                )
              }
              onClick={() => handleCopyLink(code, record.id)}
            >
              {copiedId === record.id ? 'Copied' : 'Copy'}
            </Button>

            <Button
              size="small"
              type="primary"
              icon={<RotateCcw size={13} />}
              onClick={() => navigate(`/meeting/${code}`)}
            >
              Rejoin
            </Button>

            <Button
              size="small"
              icon={<Info size={13} />}
              onClick={() => setSelectedMeeting(record)}
              aria-label="View meeting details"
            />
          </Space>
        );
      },
    },
  ];

  return (
    <div className="page-container" style={{ paddingBottom: '48px' }}>
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          marginBottom: '28px',
        }}
      >
        <div>
          <Title level={2} style={{ margin: 0, fontWeight: 700, color: tokens.colors.textPrimary }}>
            Meeting History
          </Title>
          <Text type="secondary" style={{ fontSize: '14px', marginTop: '4px', display: 'block' }}>
            Review past video sessions, access room codes, and rejoin existing conferences.
          </Text>
        </div>

        <Space size={10}>
          <Button
            icon={<RefreshCw size={15} className={loading ? 'animate-spin' : ''} />}
            onClick={fetchMeetings}
            disabled={loading}
          >
            Refresh
          </Button>
          <Button
            type="primary"
            icon={<Video size={16} />}
            onClick={() => setCreateModalOpen(true)}
            style={{ height: '40px' }}
          >
            New Meeting
          </Button>
        </Space>
      </div>

      {/* Filter and Search Bar */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          marginBottom: '20px',
        }}
      >
        <div style={{ width: '280px' }}>
          <Input
            prefix={<Search size={15} color={tokens.colors.textLight} />}
            placeholder="Search by topic or code..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            allowClear
          />
        </div>
      </div>

      {/* History Table */}
      <div
        style={{
          backgroundColor: tokens.colors.surfacePrimary,
          border: `1px solid ${tokens.colors.surfaceBorder}`,
          borderRadius: tokens.borderRadius.lg,
          overflow: 'hidden',
        }}
      >
        {loading ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <Spin size="large" />
            <div style={{ marginTop: '16px', color: tokens.colors.textSecondary }}>
              Loading your meetings from database...
            </div>
          </div>
        ) : meetings.length === 0 ? (
          <div style={{ padding: '60px 20px', textAlign: 'center' }}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <div>
                  <div style={{ fontWeight: 600, fontSize: '15px', color: tokens.colors.textPrimary }}>
                    No meeting history found
                  </div>
                  <Text type="secondary" style={{ fontSize: '13px' }}>
                    You have not hosted or joined any recorded meetings yet.
                  </Text>
                </div>
              }
            >
              <Button type="primary" icon={<Video size={15} />} onClick={() => setCreateModalOpen(true)}>
                Create Your First Meeting
              </Button>
            </Empty>
          </div>
        ) : (
          <Table<MeetingRecord>
            columns={columns}
            dataSource={filteredMeetings}
            rowKey="id"
            pagination={{ pageSize: 8, showSizeChanger: false }}
            locale={{
              emptyText: (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description="No meetings matched your search criteria"
                />
              ),
            }}
            scroll={{ x: 680 }}
          />
        )}
      </div>

      {/* Meeting Details Modal */}
      {selectedMeeting && (
        <Modal
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={18} color={tokens.colors.accentPrimary} />
              <span>Meeting Details</span>
            </div>
          }
          open={!!selectedMeeting}
          onCancel={() => setSelectedMeeting(null)}
          footer={[
            <Button key="close" onClick={() => setSelectedMeeting(null)}>
              Close
            </Button>,
            <Button
              key="rejoin"
              type="primary"
              icon={<RotateCcw size={14} />}
              onClick={() => {
                const code = selectedMeeting.meetingCode || selectedMeeting.code || '';
                navigate(`/meeting/${code}`);
              }}
            >
              Rejoin Room
            </Button>,
          ]}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingTop: '10px' }}>
            <div>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                TOPIC
              </Text>
              <div style={{ fontSize: '16px', fontWeight: 600, color: tokens.colors.textPrimary }}>
                {selectedMeeting.title}
              </div>
            </div>

            <div>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                ROOM CODE
              </Text>
              <div
                style={{
                  fontFamily: 'monospace',
                  fontSize: '14px',
                  color: tokens.colors.accentPrimary,
                  fontWeight: 600,
                }}
              >
                {selectedMeeting.meetingCode || selectedMeeting.code}
              </div>
            </div>

            <div>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                CREATED / STARTED AT
              </Text>
              <div style={{ fontSize: '14px', color: tokens.colors.textPrimary }}>
                {formatMeetingDate(selectedMeeting.startedAt || selectedMeeting.createdAt)}
              </div>
            </div>

            <div>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                LIFECYCLE
              </Text>
              <div style={{ fontSize: '14px', color: tokens.colors.textPrimary }}>
                {selectedMeeting.isEphemeral ? 'Ephemeral (24-hour retention)' : 'Permanent Room'}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Create Meeting Modal */}
      <CreateMeetingModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onMeetingCreated={() => fetchMeetings()}
      />
    </div>
  );
};
