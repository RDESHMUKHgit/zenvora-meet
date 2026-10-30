import React, { useState, useRef, useEffect } from 'react';
import { Input, Button, Empty, Typography } from 'antd';
import { Send, X, MessageSquare } from 'lucide-react';
import { tokens } from '../../styles/tokens';
import { AttachmentPreview, type AttachmentItem } from './AttachmentPreview';

const { Text } = Typography;

export interface ChatMessage {
  id: string;
  senderName: string;
  isSelf: boolean;
  content: string;
  timestamp: string;
  attachment?: AttachmentItem;
}

interface ChatPanelProps {
  onClose: () => void;
  messages?: ChatMessage[];
  onSendMessage?: (content: string) => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  onClose,
  messages = [],
  onSendMessage,
}) => {
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    if (onSendMessage) {
      onSendMessage(inputText.trim());
    }
    setInputText('');
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: tokens.colors.surfacePrimary,
        borderLeft: `1px solid ${tokens.colors.surfaceBorder}`,
        width: '340px',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '14px 16px',
          borderBottom: `1px solid ${tokens.colors.surfaceBorder}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MessageSquare size={16} color={tokens.colors.accentPrimary} />
          <span style={{ fontWeight: 600, fontSize: '14px', color: tokens.colors.textPrimary }}>
            In-Call Chat
          </span>
        </div>
        <Button
          type="text"
          size="small"
          icon={<X size={16} />}
          onClick={onClose}
          aria-label="Close chat"
        />
      </div>

      {/* Message List */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {messages.length === 0 ? (
          <div style={{ margin: 'auto', textAlign: 'center', padding: '24px 8px' }}>
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: tokens.colors.textPrimary }}>
                    No messages yet
                  </div>
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    Messages sent during the call will appear here.
                  </Text>
                </div>
              }
            />
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: msg.isSelf ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                alignSelf: msg.isSelf ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                style={{
                  fontSize: '11px',
                  color: tokens.colors.textMuted,
                  marginBottom: '2px',
                  paddingInline: '4px',
                }}
              >
                {msg.isSelf ? 'You' : msg.senderName} • {msg.timestamp}
              </div>

              <div
                style={{
                  padding: '9px 12px',
                  borderRadius: tokens.borderRadius.base,
                  backgroundColor: msg.isSelf
                    ? tokens.colors.surfaceSecondary
                    : tokens.colors.surfacePrimary,
                  border: `1px solid ${
                    msg.isSelf ? tokens.colors.accentPrimaryBorder : tokens.colors.surfaceBorder
                  }`,
                  fontSize: '13px',
                  color: tokens.colors.textPrimary,
                  wordBreak: 'break-word',
                  lineHeight: 1.45,
                }}
              >
                {msg.content}
                {msg.attachment && (
                  <div style={{ marginTop: '8px' }}>
                    <AttachmentPreview attachment={msg.attachment} />
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Composer */}
      <form
        onSubmit={handleSend}
        style={{
          padding: '12px 14px',
          borderTop: `1px solid ${tokens.colors.surfaceBorder}`,
          backgroundColor: tokens.colors.surfaceSecondary,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <Input
          placeholder="Send a message to everyone..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          size="middle"
          style={{ flex: 1 }}
        />
        <Button
          type="primary"
          htmlType="submit"
          icon={<Send size={14} />}
          disabled={!inputText.trim()}
          aria-label="Send message"
        />
      </form>
    </div>
  );
};
