import React, { useState, useEffect } from 'react';
import { Typography, Space } from 'antd';
import { Clock } from 'lucide-react';
import { getLiveClockData } from '../../utils';
import { tokens } from '../../styles/tokens';

const { Text } = Typography;

interface LiveClockProps {
  timeZone?: string;
  compact?: boolean;
}

export const LiveClock: React.FC<LiveClockProps> = ({ timeZone, compact = false }) => {
  const [clockData, setClockData] = useState(() => getLiveClockData(timeZone));

  useEffect(() => {
    const interval = setInterval(() => {
      setClockData(getLiveClockData(timeZone));
    }, 1000);

    return () => clearInterval(interval);
  }, [timeZone]);

  if (compact) {
    return (
      <Space size={6} align="center" orientation="horizontal">
        <Clock size={14} color={tokens.colors.textMuted} />
        <Text style={{ fontSize: '13px', fontWeight: 500, color: tokens.colors.textSecondary }}>
          {clockData.timeString}
        </Text>
      </Space>
    );
  }

  return (
    <div
      style={{
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        padding: '10px 16px',
        backgroundColor: tokens.colors.surfacePrimary,
        border: `1px solid ${tokens.colors.surfaceBorder}`,
        borderRadius: tokens.borderRadius.md,
        boxShadow: tokens.shadows.subtle,
      }}
    >
      <Space size={8} align="center" orientation="horizontal">
        <Clock size={16} color={tokens.colors.accentPrimary} />
        <Text
          style={{
            fontSize: '18px',
            fontWeight: 600,
            color: tokens.colors.textPrimary,
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: '-0.01em',
          }}
        >
          {clockData.timeString}
        </Text>
      </Space>
      <Text
        style={{
          fontSize: '12px',
          color: tokens.colors.textMuted,
          marginTop: '2px',
          paddingLeft: '24px',
        }}
      >
        {clockData.dateString}
      </Text>
    </div>
  );
};

