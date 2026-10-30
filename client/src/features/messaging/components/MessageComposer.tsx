import React, { useState, useRef, useEffect } from 'react';
import { Input, Button } from 'antd';
import type { TextAreaRef } from 'antd/es/input/TextArea';
import { Send } from 'lucide-react';
import { tokens } from '../../../styles/tokens';

const { TextArea } = Input;

const MAX_CHAR_LIMIT = 5000;

interface MessageComposerProps {
  onSendMessage: (content: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export const MessageComposer: React.FC<MessageComposerProps> = ({
  onSendMessage,
  placeholder = 'Type a message...',
  disabled = false,
}) => {
  const [content, setContent] = useState('');
  const textareaRef = useRef<TextAreaRef>(null);

  const trimmed = content.trim();
  const isOverLimit = content.length > MAX_CHAR_LIMIT;
  const canSend = trimmed.length > 0 && !isOverLimit && !disabled;

  const handleSend = () => {
    if (!canSend) return;
    onSendMessage(trimmed);
    setContent('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Re-focus after sending
  useEffect(() => {
    if (!disabled) {
      textareaRef.current?.focus();
    }
  }, [disabled]);

  return (
    <div
      style={{
        padding: '10px 14px',
        borderTop: `1px solid ${tokens.colors.surfaceBorder}`,
        backgroundColor: tokens.colors.surfaceSecondary,
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <TextArea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            autoSize={{ minRows: 1, maxRows: 4 }}
            maxLength={MAX_CHAR_LIMIT + 50}
            style={{
              resize: 'none',
              padding: '6px 10px',
              fontSize: '13px',
              borderRadius: tokens.borderRadius.base,
              borderColor: isOverLimit ? tokens.colors.error : undefined,
            }}
          />
        </div>

        <Button
          type="primary"
          icon={<Send size={14} />}
          onClick={handleSend}
          disabled={!canSend}
          aria-label="Send message"
          style={{
            height: '32px',
            width: '34px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            flexShrink: 0,
          }}
        />
      </div>

      {content.length > 4000 && (
        <div
          style={{
            fontSize: '11px',
            color: isOverLimit ? tokens.colors.error : tokens.colors.textMuted,
            textAlign: 'right',
            paddingRight: '4px',
          }}
        >
          {content.length} / {MAX_CHAR_LIMIT}
        </div>
      )}
    </div>
  );
};
