import React from 'react';
import { Button, Typography } from 'antd';
import { ArrowLeft, Users, Shield } from 'lucide-react';
import { MessageList } from './MessageList';
import { MessageComposer } from './MessageComposer';
import type { Conversation, ChatMessage } from '../types/chat.types';
import { tokens } from '../../../styles/tokens';

const { Text } = Typography;

interface ConversationViewProps {
  conversation: Conversation | null;
  messages: ChatMessage[];
  currentParticipantId: string;
  onBack?: () => void;
  onSendMessage: (content: string) => void;
  onToggleReaction: (messageId: string, emoji: string) => void;
}

export const ConversationView: React.FC<ConversationViewProps> = ({
  conversation,
  messages,
  currentParticipantId,
  onBack,
  onSendMessage,
  onToggleReaction,
}) => {
  const isGroup = conversation?.conversationType === 'group';

  let title = 'Meeting Chat';
  let subtitle = 'Visible to everyone in this meeting';

  if (!isGroup && conversation) {
    const otherMember = conversation.members?.find((m) => m.participantId !== currentParticipantId);
    title = conversation.targetDisplayName || otherMember?.displayName || 'Direct Message';
    subtitle = 'Private 1-to-1 conversation';
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: tokens.colors.surfacePrimary,
      }}
    >
      {/* Conversation Header Bar */}
      <div
        style={{
          padding: '10px 14px',
          borderBottom: `1px solid ${tokens.colors.surfaceBorder}`,
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          backgroundColor: tokens.colors.surfaceSecondary,
        }}
      >
        {onBack && (
          <Button
            type="text"
            size="small"
            icon={<ArrowLeft size={16} />}
            onClick={onBack}
            aria-label="Back to conversations list"
            style={{ width: '28px', height: '28px', padding: 0 }}
          />
        )}

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {isGroup ? (
              <Users size={14} color={tokens.colors.accentPrimary} />
            ) : (
              <Shield size={13} color={tokens.colors.accentSecondary} />
            )}
            <span
              style={{
                fontSize: '13.5px',
                fontWeight: 600,
                color: tokens.colors.textPrimary,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {title}
            </span>
          </div>
          <Text
            type="secondary"
            style={{
              fontSize: '11px',
              display: 'block',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {subtitle}
          </Text>
        </div>
      </div>

      {/* Messages Stream */}
      <MessageList
        messages={messages}
        onToggleReaction={onToggleReaction}
        emptyPrompt={
          isGroup
            ? 'No messages yet. Messages sent here are visible to everyone in the room.'
            : `Say hello to ${title} in private.`
        }
      />

      {/* Message Composer */}
      <MessageComposer
        onSendMessage={onSendMessage}
        placeholder={isGroup ? 'Send message to everyone...' : `Message ${title} directly...`}
      />
    </div>
  );
};

