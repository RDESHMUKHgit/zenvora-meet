export type ConversationType = 'group' | 'direct';

export interface ConversationMember {
  id?: string;
  conversationId: string;
  userId?: string | null;
  participantId: string;
  displayName?: string;
}

export interface ReactionSummary {
  emoji: string;
  count: number;
  hasReacted: boolean;
  participantIds: string[];
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderUserId?: string | null;
  senderParticipantId: string;
  senderDisplayName: string;
  messageType: 'text';
  content: string;
  clientMessageId?: string;
  createdAt: string;
  editedAt?: string | null;
  deletedAt?: string | null;
  reactions: ReactionSummary[];
  readByParticipantIds: string[];
  isSelf?: boolean;
  status?: 'sending' | 'sent' | 'failed';
}

export interface Conversation {
  id: string;
  meetingId: string;
  conversationType: ConversationType;
  createdAt: string;
  members: ConversationMember[];
  title?: string;
  targetParticipantId?: string;
  targetDisplayName?: string;
  hasUnread?: boolean;
  lastMessage?: ChatMessage | null;
}

export const ALLOWED_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🎉'] as const;
export type AllowedEmoji = (typeof ALLOWED_EMOJIS)[number];
