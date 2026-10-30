export interface EphemeralMember {
  participantId: string;
  displayName: string;
}

export interface EphemeralConversation {
  id: string;
  meetingCode: string;
  conversationType: 'group' | 'direct';
  members: EphemeralMember[];
  createdAt: string;
}

export interface EphemeralReaction {
  id: string;
  messageId: string;
  participantId: string;
  emoji: string;
  createdAt: string;
}

export interface EphemeralRead {
  id: string;
  messageId: string;
  readerParticipantId: string;
  readAt: string;
}

export interface EphemeralMessage {
  id: string;
  conversationId: string;
  senderParticipantId: string;
  senderName: string;
  content: string;
  messageType: 'text';
  clientMessageId?: string;
  createdAt: string;
  editedAt?: string | null;
  deletedAt?: string | null;
  reactions: EphemeralReaction[];
  reads: EphemeralRead[];
}

export class EphemeralChatManager {
  // roomCode -> conversationId -> EphemeralConversation
  private roomConversations = new Map<string, Map<string, EphemeralConversation>>();
  // roomCode -> conversationId -> EphemeralMessage[]
  private roomMessages = new Map<string, Map<string, EphemeralMessage[]>>();

  private normalizeCode(code: string): string {
    return code?.toLowerCase().trim() || '';
  }

  public findOrCreateGroupConversation(
    meetingCode: string,
    createdAt: string
  ): EphemeralConversation {
    const code = this.normalizeCode(meetingCode);
    let convMap = this.roomConversations.get(code);
    if (!convMap) {
      convMap = new Map();
      this.roomConversations.set(code, convMap);
    }

    const groupId = `group-${code}`;
    let groupConv = convMap.get(groupId);
    if (!groupConv) {
      groupConv = {
        id: groupId,
        meetingCode: code,
        conversationType: 'group',
        members: [],
        createdAt,
      };
      convMap.set(groupId, groupConv);
    }

    return groupConv;
  }

  public findOrCreateDirectConversation(
    meetingCode: string,
    p1Id: string,
    p2Id: string,
    p1Name: string,
    p2Name: string,
    createdAt: string
  ): EphemeralConversation {
    const code = this.normalizeCode(meetingCode);
    let convMap = this.roomConversations.get(code);
    if (!convMap) {
      convMap = new Map();
      this.roomConversations.set(code, convMap);
    }

    const sortedIds = [p1Id, p2Id].sort();
    const directId = `direct-${code}-${sortedIds[0]}-${sortedIds[1]}`;

    let directConv = convMap.get(directId);
    if (!directConv) {
      directConv = {
        id: directId,
        meetingCode: code,
        conversationType: 'direct',
        members: [
          { participantId: p1Id, displayName: p1Name },
          { participantId: p2Id, displayName: p2Name },
        ],
        createdAt,
      };
      convMap.set(directId, directConv);
    }

    return directConv;
  }

  public getConversationsForParticipant(
    meetingCode: string,
    participantId: string
  ): EphemeralConversation[] {
    const code = this.normalizeCode(meetingCode);
    const convMap = this.roomConversations.get(code);
    if (!convMap) {
      return [this.findOrCreateGroupConversation(code, new Date().toISOString())];
    }

    const result: EphemeralConversation[] = [];
    for (const conv of convMap.values()) {
      if (
        conv.conversationType === 'group' ||
        conv.members.some((m) => m.participantId === participantId)
      ) {
        result.push(conv);
      }
    }

    return result;
  }

  public getConversationById(
    meetingCode: string,
    conversationId: string
  ): EphemeralConversation | undefined {
    const code = this.normalizeCode(meetingCode);
    return this.roomConversations.get(code)?.get(conversationId);
  }

  public isParticipantInConversation(
    meetingCode: string,
    conversationId: string,
    participantId: string
  ): boolean {
    const conv = this.getConversationById(meetingCode, conversationId);
    if (!conv) return false;
    if (conv.conversationType === 'group') return true;
    return conv.members.some((m) => m.participantId === participantId);
  }

  public createMessage(
    meetingCode: string,
    conversationId: string,
    msg: Omit<EphemeralMessage, 'reactions' | 'reads'>
  ): EphemeralMessage {
    const code = this.normalizeCode(meetingCode);
    let msgMap = this.roomMessages.get(code);
    if (!msgMap) {
      msgMap = new Map();
      this.roomMessages.set(code, msgMap);
    }

    let list = msgMap.get(conversationId);
    if (!list) {
      list = [];
      msgMap.set(conversationId, list);
    }

    const newMsg: EphemeralMessage = {
      ...msg,
      reactions: [],
      reads: [],
    };

    list.push(newMsg);
    return newMsg;
  }

  public getMessageByClientMessageId(
    meetingCode: string,
    conversationId: string,
    clientMessageId: string
  ): EphemeralMessage | undefined {
    const messages = this.getMessages(meetingCode, conversationId);
    return messages.find((m) => m.clientMessageId === clientMessageId);
  }

  public getMessages(meetingCode: string, conversationId: string): EphemeralMessage[] {
    const code = this.normalizeCode(meetingCode);
    return this.roomMessages.get(code)?.get(conversationId) || [];
  }

  public editMessage(
    meetingCode: string,
    conversationId: string,
    messageId: string,
    senderParticipantId: string,
    content: string,
    editedAt: string
  ): EphemeralMessage | undefined {
    const messages = this.getMessages(meetingCode, conversationId);
    const msg = messages.find(
      (m) => m.id === messageId && m.senderParticipantId === senderParticipantId
    );
    if (msg) {
      msg.content = content;
      msg.editedAt = editedAt;
    }
    return msg;
  }

  public deleteMessage(
    meetingCode: string,
    conversationId: string,
    messageId: string,
    senderParticipantId: string,
    deletedAt: string
  ): EphemeralMessage | undefined {
    const messages = this.getMessages(meetingCode, conversationId);
    const msg = messages.find(
      (m) => m.id === messageId && m.senderParticipantId === senderParticipantId
    );
    if (msg) {
      msg.content = 'This message was deleted.';
      msg.deletedAt = deletedAt;
    }
    return msg;
  }

  public toggleReaction(
    meetingCode: string,
    conversationId: string,
    messageId: string,
    participantId: string,
    emoji: string,
    createdAt: string
  ): { action: 'added' | 'removed'; reaction?: EphemeralReaction } {
    const messages = this.getMessages(meetingCode, conversationId);
    const msg = messages.find((m) => m.id === messageId);
    if (!msg) return { action: 'removed' };

    const existingIdx = msg.reactions.findIndex(
      (r) => r.participantId === participantId && r.emoji === emoji
    );

    if (existingIdx >= 0) {
      msg.reactions.splice(existingIdx, 1);
      return { action: 'removed' };
    }

    const newReaction: EphemeralReaction = {
      id: `react-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      messageId,
      participantId,
      emoji,
      createdAt,
    };

    msg.reactions.push(newReaction);
    return { action: 'added', reaction: newReaction };
  }

  public markAsRead(
    meetingCode: string,
    conversationId: string,
    messageIds: string[],
    readerParticipantId: string,
    readAt: string
  ): void {
    const messages = this.getMessages(meetingCode, conversationId);
    for (const msg of messages) {
      if (messageIds.includes(msg.id)) {
        const alreadyRead = msg.reads.some((r) => r.readerParticipantId === readerParticipantId);
        if (!alreadyRead) {
          msg.reads.push({
            id: `read-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            messageId: msg.id,
            readerParticipantId,
            readAt,
          });
        }
      }
    }
  }

  public hasRoom(meetingCode: string): boolean {
    const code = this.normalizeCode(meetingCode);
    return this.roomConversations.has(code) || this.roomMessages.has(code);
  }

  public purgeRoom(meetingCode: string): void {
    const code = this.normalizeCode(meetingCode);
    this.roomConversations.delete(code);
    this.roomMessages.delete(code);
  }
}

export const ephemeralChatManager = new EphemeralChatManager();
