import React, { useState } from 'react';
import { Button, Alert } from 'antd';
import { X, MessageSquare, ListFilter } from 'lucide-react';
import { ConversationList, type RoomParticipantInfo } from './ConversationList';
import { ConversationView } from './ConversationView';
import { NewMessageIndicator } from './NewMessageIndicator';
import type { Conversation, ChatMessage } from '../types/chat.types';
import { tokens } from '../../../styles/tokens';

interface ChatPanelProps {
  onClose: () => void;
  conversations: Conversation[];
  activeConversationId: string | null;
  activeConversation: Conversation | null;
  activeMessages: ChatMessage[];
  unreadConvs: Set<string>;
  hasAnyUnread: boolean;
  currentParticipantId: string;
  roomParticipants: RoomParticipantInfo[];
  errorMessage?: string | null;
  onClearError?: () => void;
  onSelectConversation: (convId: string) => void;
  onSendMessage: (content: string) => void;
  onToggleReaction: (messageId: string, emoji: string) => void;
  onStartDirectMessage: (targetParticipantId: string, targetDisplayName: string) => void;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  onClose,
  conversations,
  activeConversationId,
  activeConversation,
  activeMessages,
  unreadConvs,
  hasAnyUnread,
  currentParticipantId,
  roomParticipants,
  errorMessage,
  onClearError,
  onSelectConversation,
  onSendMessage,
  onToggleReaction,
  onStartDirectMessage,
}) => {
  // Navigation mode: 'chat' (viewing conversation) or 'list' (browsing conversations)
  const [viewMode, setViewMode] = useState<'chat' | 'list'>('chat');

  const handleSelectConv = (convId: string) => {
    onSelectConversation(convId);
    setViewMode('chat');
  };

  const handleStartDm = (targetId: string, targetName: string) => {
    onStartDirectMessage(targetId, targetName);
    setViewMode('chat');
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
        maxWidth: '100vw',
      }}
    >
      {/* Top Header */}
      <div
        style={{
          padding: '12px 14px',
          borderBottom: `1px solid ${tokens.colors.surfaceBorder}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: tokens.colors.surfacePrimary,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MessageSquare size={16} color={tokens.colors.accentPrimary} />
          <span style={{ fontWeight: 600, fontSize: '14px', color: tokens.colors.textPrimary }}>
            In-Call Chat
          </span>
          {hasAnyUnread && viewMode === 'chat' && <NewMessageIndicator />}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Button
            type={viewMode === 'list' ? 'primary' : 'text'}
            size="small"
            icon={<ListFilter size={15} />}
            onClick={() => setViewMode((prev) => (prev === 'list' ? 'chat' : 'list'))}
            title={viewMode === 'list' ? 'Back to chat view' : 'All conversations'}
            aria-label="Toggle conversations list"
          />
          <Button
            type="text"
            size="small"
            icon={<X size={16} />}
            onClick={onClose}
            aria-label="Close chat"
          />
        </div>
      </div>

      {/* Error notification banner if any */}
      {errorMessage && (
        <Alert
          message={errorMessage}
          type="warning"
          closable
          onClose={onClearError}
          style={{
            margin: '6px 10px',
            fontSize: '12px',
            padding: '4px 8px',
          }}
        />
      )}

      {/* Content Area */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {viewMode === 'list' ? (
          <ConversationList
            conversations={conversations}
            activeConversationId={activeConversationId}
            unreadConvs={unreadConvs}
            currentParticipantId={currentParticipantId}
            roomParticipants={roomParticipants}
            onSelectConversation={handleSelectConv}
            onStartDirectMessage={handleStartDm}
          />
        ) : (
          <ConversationView
            conversation={activeConversation}
            messages={activeMessages}
            currentParticipantId={currentParticipantId}
            onBack={() => setViewMode('list')}
            onSendMessage={onSendMessage}
            onToggleReaction={onToggleReaction}
          />
        )}
      </div>
    </div>
  );
};
