import React, { useState } from 'react';
import { Button, Avatar, Typography, Tooltip } from 'antd';
import { Users, User, MessageSquarePlus } from 'lucide-react';
import { NewMessageIndicator } from './NewMessageIndicator';
import { formatMessageTime } from '../utils/chat.utils';
import type { Conversation } from '../types/chat.types';
import { tokens } from '../../../styles/tokens';

const { Text } = Typography;

export interface RoomParticipantInfo {
  id: string;
  name?: string;
  displayName?: string;
  isSelf?: boolean;
}

interface ConversationListProps {
  conversations: Conversation[];
  activeConversationId: string | null;
  unreadConvs: Set<string>;
  currentParticipantId: string;
  roomParticipants: RoomParticipantInfo[];
  onSelectConversation: (convId: string) => void;
  onStartDirectMessage: (targetParticipantId: string, targetDisplayName: string) => void;
}

export const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  activeConversationId,
  unreadConvs,
  currentParticipantId,
  roomParticipants,
  onSelectConversation,
  onStartDirectMessage,
}) => {
  const [showDmPicker, setShowDmPicker] = useState(false);

  // Group chat conversation
  const groupConv = conversations.find((c) => c.conversationType === 'group');

  // Direct conversations
  const directConvs = conversations.filter((c) => c.conversationType === 'direct');

  // Participants available for starting a new DM (excluding self)
  const availablePeers = roomParticipants.filter((p) => p.id !== currentParticipantId);

  // Resolve target name for direct conversations
  const getDmTargetName = (conv: Conversation): string => {
    if (conv.targetDisplayName) return conv.targetDisplayName;
    const otherMember = conv.members?.find((m) => m.participantId !== currentParticipantId);
    if (otherMember?.displayName) return otherMember.displayName;
    const peer = roomParticipants.find((p) => p.id === otherMember?.participantId);
    return peer?.displayName || peer?.name || 'Participant';
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: tokens.colors.surfacePrimary,
      }}
    >
      <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
        {/* Section 1: Meeting-wide Group Chat */}
        <div style={{ marginBottom: '14px' }}>
          <div
            style={{
              fontSize: '11px',
              fontWeight: 600,
              color: tokens.colors.textMuted,
              padding: '6px 8px 4px 8px',
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
            }}
          >
            Room Channel
          </div>

          {groupConv && (
            <div
              role="button"
              tabIndex={0}
              onClick={() => onSelectConversation(groupConv.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  onSelectConversation(groupConv.id);
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '9px 10px',
                borderRadius: tokens.borderRadius.base,
                cursor: 'pointer',
                backgroundColor:
                  activeConversationId === groupConv.id
                    ? tokens.colors.surfaceSecondary
                    : 'transparent',
                border: `1px solid ${
                  activeConversationId === groupConv.id
                    ? tokens.colors.accentPrimaryBorder
                    : 'transparent'
                }`,
                transition: 'background-color 0.15s ease',
              }}
            >
              <Avatar
                size={34}
                icon={<Users size={18} />}
                style={{
                  backgroundColor: tokens.colors.accentPrimaryLight,
                  color: tokens.colors.accentPrimary,
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <span
                    style={{
                      fontSize: '13px',
                      fontWeight: 600,
                      color: tokens.colors.textPrimary,
                    }}
                  >
                    Everyone
                  </span>
                  {unreadConvs.has(groupConv.id) && <NewMessageIndicator />}
                </div>

                <div
                  style={{
                    fontSize: '12px',
                    color: tokens.colors.textMuted,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    marginTop: '2px',
                  }}
                >
                  {groupConv.lastMessage
                    ? `${groupConv.lastMessage.isSelf ? 'You: ' : ''}${groupConv.lastMessage.content}`
                    : 'Group meeting conversation'}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Section 2: Direct Messages */}
        <div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 8px 4px 8px',
            }}
          >
            <span
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: tokens.colors.textMuted,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Direct Messages
            </span>
            <Tooltip title="Start a private direct message">
              <Button
                type="text"
                size="small"
                icon={<MessageSquarePlus size={13} color={tokens.colors.accentPrimary} />}
                onClick={() => setShowDmPicker((prev) => !prev)}
                style={{ height: '22px', padding: '0 6px', fontSize: '11px' }}
              >
                New
              </Button>
            </Tooltip>
          </div>

          {/* New DM Picker List */}
          {showDmPicker && (
            <div
              style={{
                padding: '8px',
                marginBottom: '8px',
                backgroundColor: tokens.colors.surfaceSecondary,
                borderRadius: tokens.borderRadius.base,
                border: `1px solid ${tokens.colors.surfaceBorder}`,
              }}
            >
              <div
                style={{
                  fontSize: '11.5px',
                  fontWeight: 600,
                  color: tokens.colors.textSecondary,
                  marginBottom: '6px',
                }}
              >
                Select a participant to message:
              </div>
              {availablePeers.length === 0 ? (
                <Text type="secondary" style={{ fontSize: '11px' }}>
                  No other participants in the room right now.
                </Text>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {availablePeers.map((peer) => {
                    const peerName = peer.displayName || peer.name || 'Participant';
                    return (
                      <Button
                        key={peer.id}
                        type="text"
                        size="small"
                        onClick={() => {
                          onStartDirectMessage(peer.id, peerName);
                          setShowDmPicker(false);
                        }}
                        style={{
                          textAlign: 'left',
                          justifyContent: 'flex-start',
                          fontSize: '12px',
                        }}
                      >
                        <User size={13} style={{ marginRight: '6px' }} />
                        {peerName}
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Existing DMs */}
          {directConvs.length === 0 && !showDmPicker ? (
            <div
              style={{
                padding: '12px 8px',
                textAlign: 'center',
                fontSize: '11.5px',
                color: tokens.colors.textMuted,
              }}
            >
              No private conversations yet. Click "New" or select a participant to message privately.
            </div>
          ) : (
            directConvs.map((conv) => {
              const targetName = getDmTargetName(conv);
              const isSelected = activeConversationId === conv.id;
              const hasUnread = unreadConvs.has(conv.id);

              return (
                <div
                  key={conv.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectConversation(conv.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      onSelectConversation(conv.id);
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '9px 10px',
                    borderRadius: tokens.borderRadius.base,
                    cursor: 'pointer',
                    backgroundColor: isSelected ? tokens.colors.surfaceSecondary : 'transparent',
                    border: `1px solid ${
                      isSelected ? tokens.colors.accentPrimaryBorder : 'transparent'
                    }`,
                    transition: 'background-color 0.15s ease',
                    marginBottom: '2px',
                  }}
                >
                  <Avatar
                    size={34}
                    style={{
                      backgroundColor: tokens.colors.surfaceSecondary,
                      color: tokens.colors.textPrimary,
                      border: `1px solid ${tokens.colors.surfaceBorder}`,
                      fontWeight: 600,
                      fontSize: '13px',
                      flexShrink: 0,
                    }}
                  >
                    {targetName.charAt(0).toUpperCase()}
                  </Avatar>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '13px',
                          fontWeight: 500,
                          color: tokens.colors.textPrimary,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {targetName}
                      </span>
                      {hasUnread && <NewMessageIndicator />}
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginTop: '2px',
                      }}
                    >
                      <div
                        style={{
                          fontSize: '11.5px',
                          color: tokens.colors.textMuted,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: '160px',
                        }}
                      >
                        {conv.lastMessage
                          ? `${conv.lastMessage.isSelf ? 'You: ' : ''}${conv.lastMessage.content}`
                          : 'Direct conversation'}
                      </div>
                      {conv.lastMessage?.createdAt && (
                        <span
                          style={{
                            fontSize: '10px',
                            color: tokens.colors.textLight,
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {formatMessageTime(conv.lastMessage.createdAt)}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
