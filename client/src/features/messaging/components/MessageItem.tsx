import React, { useState } from 'react';
import { formatMessageTime } from '../utils/chat.utils';
import { ReactionPicker } from './ReactionPicker';
import { ReadReceipt } from './ReadReceipt';
import type { ChatMessage, AllowedEmoji } from '../types/chat.types';
import { tokens } from '../../../styles/tokens';

interface MessageItemProps {
  message: ChatMessage;
  isConsecutive?: boolean;
  onToggleReaction: (messageId: string, emoji: string) => void;
}

export const MessageItem: React.FC<MessageItemProps> = ({
  message,
  isConsecutive = false,
  onToggleReaction,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const isSelf = !!message.isSelf;
  const isDeleted = !!message.deletedAt;
  const isEdited = !!message.editedAt && !isDeleted;
  const timeFormatted = formatMessageTime(message.createdAt);
  const isReadByOthers = (message.readByParticipantIds || []).filter((id) => id !== message.senderParticipantId).length > 0;

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isSelf ? 'flex-end' : 'flex-start',
        alignSelf: isSelf ? 'flex-end' : 'flex-start',
        maxWidth: '85%',
        marginTop: isConsecutive ? '3px' : '10px',
        position: 'relative',
      }}
    >
      {/* Header: Sender Name & Timestamp (only if not consecutive) */}
      {!isConsecutive && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '11px',
            color: tokens.colors.textMuted,
            marginBottom: '3px',
            paddingInline: '4px',
          }}
        >
          <span style={{ fontWeight: 600, color: isSelf ? tokens.colors.textPrimary : tokens.colors.textSecondary }}>
            {isSelf ? 'You' : message.senderDisplayName}
          </span>
          <span>•</span>
          <span style={{ fontVariantNumeric: 'tabular-nums' }}>{timeFormatted}</span>
        </div>
      )}

      {/* Message Bubble Container with Action Bar on Hover */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: '6px',
          flexDirection: isSelf ? 'row-reverse' : 'row',
        }}
      >
        {/* Main Content Bubble */}
        <div
          style={{
            padding: '8px 12px',
            borderRadius: tokens.borderRadius.base,
            backgroundColor: isSelf
              ? tokens.colors.surfaceSecondary
              : tokens.colors.surfacePrimary,
            border: `1px solid ${
              isSelf ? tokens.colors.accentPrimaryBorder : tokens.colors.surfaceBorder
            }`,
            fontSize: '13px',
            color: isDeleted ? tokens.colors.textLight : tokens.colors.textPrimary,
            fontStyle: isDeleted ? 'italic' : 'normal',
            wordBreak: 'break-word',
            lineHeight: 1.45,
            position: 'relative',
          }}
        >
          {isDeleted ? 'This message was deleted' : message.content}

          {isEdited && (
            <span
              style={{
                fontSize: '10px',
                color: tokens.colors.textLight,
                marginLeft: '6px',
                userSelect: 'none',
              }}
            >
              (edited)
            </span>
          )}
        </div>

        {/* Hover Action: Add Reaction */}
        {!isDeleted && (
          <div
            style={{
              opacity: isHovered ? 1 : 0,
              pointerEvents: isHovered ? 'auto' : 'none',
              transition: 'opacity 0.15s ease',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <ReactionPicker
              onSelectEmoji={(emoji: AllowedEmoji) => onToggleReaction(message.id, emoji)}
            />
          </div>
        )}
      </div>

      {/* Reactions Summary Pills */}
      {message.reactions && message.reactions.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '4px',
            marginTop: '4px',
            paddingInline: '2px',
          }}
        >
          {message.reactions.map((r) => (
            <button
              key={r.emoji}
              type="button"
              onClick={() => onToggleReaction(message.id, r.emoji)}
              title={`${r.count} ${r.count === 1 ? 'reaction' : 'reactions'}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '3px',
                padding: '2px 6px',
                fontSize: '11px',
                borderRadius: '12px',
                cursor: 'pointer',
                backgroundColor: r.hasReacted
                  ? tokens.colors.accentPrimaryLight
                  : tokens.colors.surfaceSecondary,
                border: `1px solid ${
                  r.hasReacted
                    ? tokens.colors.accentPrimaryBorder
                    : tokens.colors.surfaceBorderSubtle
                }`,
                color: r.hasReacted
                  ? tokens.colors.accentPrimary
                  : tokens.colors.textSecondary,
                transition: 'all 0.1s ease',
              }}
            >
              <span>{r.emoji}</span>
              <span style={{ fontSize: '10.5px', fontWeight: 600 }}>{r.count}</span>
            </button>
          ))}
        </div>
      )}

      {/* Footer Info for Self: Delivery & Read Status */}
      {isSelf && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            marginTop: '2px',
            paddingInline: '4px',
          }}
        >
          <ReadReceipt status={message.status} isReadByOthers={isReadByOthers} />
        </div>
      )}
    </div>
  );
};
