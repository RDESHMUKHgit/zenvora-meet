import api from '../../../services/api';
import type { Conversation, ChatMessage } from '../types/chat.types';

export const chatApiService = {
  /**
   * Fetch all conversations for a meeting (group chat + DMs involving this participant)
   */
  async getConversations(meetingCode: string, participantId: string): Promise<Conversation[]> {
    const res = await api.get<{ success: boolean; data: { conversations: Conversation[] } }>(
      `/meetings/${encodeURIComponent(meetingCode)}/conversations`,
      {
        params: { participantId },
      }
    );
    return res.data?.data?.conversations || [];
  },

  /**
   * Fetch messages for a specific conversation
   */
  async getMessages(
    meetingCode: string,
    conversationId: string,
    participantId: string
  ): Promise<ChatMessage[]> {
    const res = await api.get<{ success: boolean; data: { messages: ChatMessage[] } }>(
      `/meetings/${encodeURIComponent(meetingCode)}/conversations/${encodeURIComponent(conversationId)}/messages`,
      {
        params: { participantId },
      }
    );
    return res.data?.data?.messages || [];
  },

  /**
   * Create or retrieve an existing direct message conversation with another participant
   */
  async createDirectConversation(
    meetingCode: string,
    participantId: string,
    targetParticipantId: string
  ): Promise<Conversation> {
    const res = await api.post<{ success: boolean; data: { conversation: Conversation } }>(
      `/meetings/${encodeURIComponent(meetingCode)}/conversations/direct`,
      {
        participantId,
        targetParticipantId,
      }
    );
    return res.data.data.conversation;
  },

  /**
   * Mark message(s) in a conversation as read
   */
  async markAsRead(
    meetingCode: string,
    conversationId: string,
    messageIds: string[],
    participantId: string
  ): Promise<void> {
    if (!messageIds || messageIds.length === 0) return;
    await api.post(
      `/meetings/${encodeURIComponent(meetingCode)}/conversations/${encodeURIComponent(conversationId)}/read`,
      {
        participantId,
        messageIds,
      }
    );
  },
};

