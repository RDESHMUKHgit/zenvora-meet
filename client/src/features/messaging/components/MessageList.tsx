import React, { useEffect, useRef } from 'react';
import { Empty, Typography } from 'antd';
import { MessageItem } from './MessageItem';
import { formatMessageDate, isConsecutiveMessage } from '../utils/chat.utils';
import type { ChatMessage } from '../types/chat.types';
import { tokens } from '../../../styles/tokens';

const { Text } = Typography;

interface MessageListProps {
  messages: ChatMessage[];
  onToggleReaction: (messageId: string, emoji: string) => void;
  emptyPrompt?: string;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  onToggleReaction,
  emptyPrompt = 'Send a message to start the conversation.',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px 16px',
        }}
      >
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={
            <div>
              <div style={{ fontSize: '13px', fontWeight: 500, color: tokens.colors.textPrimary }}>
                No messages yet
              </div>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {emptyPrompt}
              </Text>
            </div>
          }
        />
      </div>
    );
  }

  let lastDateLabel = '';

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        overflowY: 'auto',
        padding: '12px 16px',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {messages.map((msg, index) => {
        const dateLabel = formatMessageDate(msg.createdAt);
        const showDateDivider = dateLabel !== lastDateLabel;
        if (showDateDivider) {
          lastDateLabel = dateLabel;
        }

        const prevMsg = index > 0 ? messages[index - 1] : null;
        const isConsecutive =
          !showDateDivider &&
          !!prevMsg &&
          isConsecutiveMessage(
            prevMsg.createdAt,
            prevMsg.senderParticipantId,
            msg.createdAt,
            msg.senderParticipantId
          );

        return (
          <React.Fragment key={msg.id}>
            {showDateDivider && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '14px 0 8px 0',
                }}
              >
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 500,
                    color: tokens.colors.textMuted,
                    backgroundColor: tokens.colors.surfaceSecondary,
                    padding: '2px 8px',
                    borderRadius: '10px',
                    border: `1px solid ${tokens.colors.surfaceBorderSubtle}`,
                  }}
                >
                  {dateLabel}
                </span>
              </div>
            )}
            <MessageItem
              message={msg}
              isConsecutive={isConsecutive}
              onToggleReaction={onToggleReaction}
            />
          </React.Fragment>
        );
      })}
      <div ref={bottomRef} style={{ height: '1px' }} />
    </div>
  );
};
