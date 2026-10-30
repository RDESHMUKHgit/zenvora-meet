import { useState, useEffect, useCallback, useRef } from 'react';
import { Temporal } from '@js-temporal/polyfill';
import { connectSocket } from '../../../services/socket.service';
import { chatApiService } from '../services/chat.service';
import type { Conversation, ChatMessage, ReactionSummary } from '../types/chat.types';

interface UseMessagingProps {
  meetingCode: string;
  participantId: string;
  displayName: string;
  isChatOpen: boolean;
}

export function useMessaging({
  meetingCode,
  participantId,
  displayName,
  isChatOpen,
}: UseMessagingProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, ChatMessage[]>>(() => {
    if (typeof window === 'undefined' || !meetingCode) return {};
    try {
      const cached = localStorage.getItem(`rd_chat_messages_${meetingCode.toLowerCase()}`);
      return cached ? JSON.parse(cached) : {};
    } catch {
      return {};
    }
  });
  const [unreadConvs, setUnreadConvs] = useState<Set<string>>(new Set());
  const [loadingConvs, setLoadingConvs] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const activeConvRef = useRef<string | null>(null);
  activeConvRef.current = activeConversationId;

  const isChatOpenRef = useRef<boolean>(isChatOpen);
  isChatOpenRef.current = isChatOpen;

  // Persist messages to localStorage for refresh preservation
  useEffect(() => {
    if (typeof window === 'undefined' || !meetingCode) return;
    if (Object.keys(messages).length > 0) {
      try {
        localStorage.setItem(`rd_chat_messages_${meetingCode.toLowerCase()}`, JSON.stringify(messages));
      } catch {
        // Storage quota fallback
      }
    }
  }, [messages, meetingCode]);

  // Initialize conversations list
  const loadConversations = useCallback(async () => {
    if (!meetingCode || !participantId) return;
    try {
      setLoadingConvs(true);
      const convList = await chatApiService.getConversations(meetingCode, participantId);
      setConversations(convList);

      // Default to the group conversation if no active conversation is selected
      if (!activeConvRef.current && convList.length > 0) {
        const groupConv = convList.find((c) => c.conversationType === 'group') || convList[0];
        setActiveConversationId(groupConv.id);
      }
    } catch {
      // Ephemeral or offline initial load
    } finally {
      setLoadingConvs(false);
    }
  }, [meetingCode, participantId]);

  // Load message history for a conversation
  const loadMessages = useCallback(
    async (convId: string) => {
      if (!meetingCode || !convId || !participantId) return;
      try {
        setLoadingMessages(true);
        const history = await chatApiService.getMessages(meetingCode, convId, participantId);
        const mapped = history.map((m) => ({
          ...m,
          isSelf: m.senderParticipantId === participantId,
        }));

        setMessages((prev) => {
          const localList = prev[convId] || [];
          const map = new Map<string, ChatMessage>();
          for (const m of localList) {
            map.set(m.id, m);
          }
          for (const m of mapped) {
            map.set(m.id, m);
          }
          const merged = Array.from(map.values()).sort((a, b) =>
            (a.createdAt || '').localeCompare(b.createdAt || '')
          );
          return {
            ...prev,
            [convId]: merged,
          };
        });

        // Mark unread messages as read
        const unreadIds = mapped
          .filter((m) => m.senderParticipantId !== participantId && !m.readByParticipantIds?.includes(participantId))
          .map((m) => m.id);

        if (unreadIds.length > 0 && isChatOpenRef.current) {
          const socket = connectSocket();
          socket.emit('message:read', {
            meetingCode,
            conversationId: convId,
            participantId,
            messageIds: unreadIds,
          });
          chatApiService.markAsRead(meetingCode, convId, unreadIds, participantId).catch(() => {});
        }
      } catch {
        // Fallback for empty or newly created rooms
      } finally {
        setLoadingMessages(false);
      }
    },
    [meetingCode, participantId]
  );

  // Switch active conversation
  const selectConversation = useCallback(
    (convId: string) => {
      if (activeConvRef.current === convId) return;

      const socket = connectSocket();
      if (activeConvRef.current) {
        socket.emit('chat:leave', {
          meetingCode,
          conversationId: activeConvRef.current,
          participantId,
        });
      }

      setActiveConversationId(convId);
      setUnreadConvs((prev) => {
        const next = new Set(prev);
        next.delete(convId);
        return next;
      });

      socket.emit('chat:join', {
        meetingCode,
        conversationId: convId,
        participantId,
      });

      loadMessages(convId);
    },
    [meetingCode, participantId, loadMessages]
  );

  // Send a text message
  const sendMessage = useCallback(
    (content: string) => {
      const trimmed = content.trim();
      const currentConvId = activeConvRef.current;
      if (!trimmed || !currentConvId || !meetingCode || !participantId) return;

      const clientMessageId = crypto.randomUUID();
      const nowIso = Temporal.Now.instant().toString();

      // Create optimistic message
      const optimisticMsg: ChatMessage = {
        id: clientMessageId,
        conversationId: currentConvId,
        senderParticipantId: participantId,
        senderDisplayName: displayName,
        messageType: 'text',
        content: trimmed,
        clientMessageId,
        createdAt: nowIso,
        reactions: [],
        readByParticipantIds: [participantId],
        isSelf: true,
        status: 'sending',
      };

      setMessages((prev) => ({
        ...prev,
        [currentConvId]: [...(prev[currentConvId] || []), optimisticMsg],
      }));

      // Update conversation's last message
      setConversations((prev) =>
        prev.map((c) =>
          c.id === currentConvId ? { ...c, lastMessage: optimisticMsg } : c
        )
      );

      const socket = connectSocket();
      socket.emit(
        'message:send',
        {
          meetingCode,
          conversationId: currentConvId,
          participantId,
          content: trimmed,
          clientMessageId,
        },
        (response?: { success: boolean; message?: ChatMessage; error?: string }) => {
          if (response?.success && response.message) {
            const confirmedMsg: ChatMessage = {
              ...response.message,
              isSelf: true,
              status: 'sent',
            };
            setMessages((prev) => ({
              ...prev,
              [currentConvId]: (prev[currentConvId] || []).map((m) =>
                m.clientMessageId === clientMessageId ? confirmedMsg : m
              ),
            }));
            setConversations((prev) =>
              prev.map((c) =>
                c.id === currentConvId ? { ...c, lastMessage: confirmedMsg } : c
              )
            );
          } else {
            const errMsg = response?.error || 'Failed to deliver message';
            setErrorMessage(errMsg);
            setMessages((prev) => ({
              ...prev,
              [currentConvId]: (prev[currentConvId] || []).map((m) =>
                m.clientMessageId === clientMessageId ? { ...m, status: 'failed' } : m
              ),
            }));
          }
        }
      );
    },
    [meetingCode, participantId, displayName]
  );

  // Toggle emoji reaction
  const toggleReaction = useCallback(
    (messageId: string, emoji: string) => {
      const currentConvId = activeConvRef.current;
      if (!currentConvId || !meetingCode || !participantId) return;

      // Optimistic update
      setMessages((prev) => {
        const list = prev[currentConvId] || [];
        const updated = list.map((m) => {
          if (m.id !== messageId) return m;

          const existingReaction = m.reactions?.find((r) => r.emoji === emoji);
          let newReactions: ReactionSummary[];

          if (existingReaction) {
            if (existingReaction.hasReacted) {
              // Remove own reaction
              const newCount = existingReaction.count - 1;
              if (newCount <= 0) {
                newReactions = (m.reactions || []).filter((r) => r.emoji !== emoji);
              } else {
                newReactions = (m.reactions || []).map((r) =>
                  r.emoji === emoji
                    ? {
                        ...r,
                        count: newCount,
                        hasReacted: false,
                        participantIds: r.participantIds.filter((p) => p !== participantId),
                      }
                    : r
                );
              }
            } else {
              // Add reaction
              newReactions = (m.reactions || []).map((r) =>
                r.emoji === emoji
                  ? {
                      ...r,
                      count: r.count + 1,
                      hasReacted: true,
                      participantIds: [...r.participantIds, participantId],
                    }
                  : r
              );
            }
          } else {
            // New reaction entry
            newReactions = [
              ...(m.reactions || []),
              {
                emoji,
                count: 1,
                hasReacted: true,
                participantIds: [participantId],
              },
            ];
          }

          return { ...m, reactions: newReactions };
        });

        return { ...prev, [currentConvId]: updated };
      });

      const socket = connectSocket();
      socket.emit('message:reaction', {
        meetingCode,
        conversationId: currentConvId,
        messageId,
        participantId,
        emoji,
      });
    },
    [meetingCode, participantId]
  );

  // Start or open a direct message conversation
  const startDirectMessage = useCallback(
    async (targetParticipantId: string, targetDisplayName: string) => {
      if (!meetingCode || !participantId || targetParticipantId === participantId) return null;

      try {
        const conv = await chatApiService.createDirectConversation(
          meetingCode,
          participantId,
          targetParticipantId
        );

        const enrichedConv: Conversation = {
          ...conv,
          targetParticipantId,
          targetDisplayName,
        };

        setConversations((prev) => {
          const exists = prev.find((c) => c.id === conv.id);
          if (exists) {
            return prev.map((c) => (c.id === conv.id ? { ...c, targetDisplayName } : c));
          }
          return [...prev, enrichedConv];
        });

        selectConversation(conv.id);
        return conv;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to start direct message';
        setErrorMessage(msg);
        return null;
      }
    },
    [meetingCode, participantId, selectConversation]
  );

  // Setup initial load and socket event subscribers
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Automatically join socket channel and load messages whenever activeConversationId changes
  useEffect(() => {
    if (!activeConversationId || !meetingCode || !participantId) return;

    const socket = connectSocket();
    socket.emit('chat:join', {
      meetingCode,
      conversationId: activeConversationId,
      participantId,
    });
    loadMessages(activeConversationId);
  }, [activeConversationId, meetingCode, participantId, loadMessages]);

  useEffect(() => {
    if (!meetingCode || !participantId) return;

    const socket = connectSocket();

    // Handlers
    const handleMessageNew = (newMsg: ChatMessage) => {
      const isSelf = newMsg.senderParticipantId === participantId;
      const isCurrentActive = activeConvRef.current === newMsg.conversationId;
      const enrichedMsg: ChatMessage = {
        ...newMsg,
        isSelf,
        status: 'sent',
      };

      if (!activeConvRef.current && !newMsg.conversationId.includes('direct')) {
        setActiveConversationId(newMsg.conversationId);
      }

      setMessages((prev) => {
        const list = prev[newMsg.conversationId] || [];
        // Deduplicate against optimistic clientMessageId if present
        const index = newMsg.clientMessageId
          ? list.findIndex((m) => m.clientMessageId === newMsg.clientMessageId)
          : -1;

        let nextList: ChatMessage[];
        if (index >= 0) {
          nextList = [...list];
          nextList[index] = enrichedMsg;
        } else {
          const idIndex = list.findIndex((m) => m.id === newMsg.id);
          if (idIndex >= 0) {
            nextList = [...list];
            nextList[idIndex] = enrichedMsg;
          } else {
            nextList = [...list, enrichedMsg];
          }
        }
        return { ...prev, [newMsg.conversationId]: nextList };
      });

      // Update last message in conversations list
      setConversations((prev) => {
        const convExists = prev.some((c) => c.id === newMsg.conversationId);
        if (convExists) {
          return prev.map((c) =>
            c.id === newMsg.conversationId ? { ...c, lastMessage: enrichedMsg } : c
          );
        }
        // If it's a DM we haven't seen in our list yet, re-fetch conversations
        loadConversations();
        return prev;
      });

      // Handle read status and unread indicator
      if (isCurrentActive && isChatOpenRef.current) {
        if (!isSelf) {
          socket.emit('message:read', {
            meetingCode,
            conversationId: newMsg.conversationId,
            participantId,
            messageIds: [newMsg.id],
          });
          chatApiService
            .markAsRead(meetingCode, newMsg.conversationId, [newMsg.id], participantId)
            .catch(() => {});
        }
      } else {
        if (!isSelf) {
          setUnreadConvs((prev) => {
            const next = new Set(prev);
            next.add(newMsg.conversationId);
            return next;
          });
        }
      }
    };

    const handleMessageReaction = (payload: {
      conversationId: string;
      messageId: string;
      participantId: string;
      emoji: string;
      action: 'added' | 'removed';
    }) => {
      setMessages((prev) => {
        const list = prev[payload.conversationId] || [];
        const updated = list.map((m) => {
          if (m.id !== payload.messageId) return m;

          const existing = m.reactions?.find((r) => r.emoji === payload.emoji);
          let nextReactions: ReactionSummary[];

          if (payload.action === 'added') {
            if (existing) {
              const alreadyHas = existing.participantIds.includes(payload.participantId);
              if (alreadyHas) return m;
              nextReactions = (m.reactions || []).map((r) =>
                r.emoji === payload.emoji
                  ? {
                      ...r,
                      count: r.count + 1,
                      hasReacted:
                        payload.participantId === participantId ? true : r.hasReacted,
                      participantIds: [...r.participantIds, payload.participantId],
                    }
                  : r
              );
            } else {
              nextReactions = [
                ...(m.reactions || []),
                {
                  emoji: payload.emoji,
                  count: 1,
                  hasReacted: payload.participantId === participantId,
                  participantIds: [payload.participantId],
                },
              ];
            }
          } else {
            // Removed
            if (!existing) return m;
            const newCount = existing.count - 1;
            if (newCount <= 0) {
              nextReactions = (m.reactions || []).filter((r) => r.emoji !== payload.emoji);
            } else {
              nextReactions = (m.reactions || []).map((r) =>
                r.emoji === payload.emoji
                  ? {
                      ...r,
                      count: newCount,
                      hasReacted:
                        payload.participantId === participantId ? false : r.hasReacted,
                      participantIds: r.participantIds.filter((p) => p !== payload.participantId),
                    }
                  : r
              );
            }
          }

          return { ...m, reactions: nextReactions };
        });

        return { ...prev, [payload.conversationId]: updated };
      });
    };

    const handleMessageRead = (payload: {
      conversationId: string;
      readerParticipantId: string;
      messageIds: string[];
    }) => {
      setMessages((prev) => {
        const list = prev[payload.conversationId] || [];
        const idSet = new Set(payload.messageIds);
        const updated = list.map((m) => {
          if (!idSet.has(m.id)) return m;
          const readBy = m.readByParticipantIds || [];
          if (readBy.includes(payload.readerParticipantId)) return m;
          return {
            ...m,
            readByParticipantIds: [...readBy, payload.readerParticipantId],
          };
        });
        return { ...prev, [payload.conversationId]: updated };
      });
    };

    const handleChatError = (payload: { message: string }) => {
      setErrorMessage(payload.message);
    };

    socket.on('message:new', handleMessageNew);
    socket.on('message:reaction', handleMessageReaction);
    socket.on('message:read', handleMessageRead);
    socket.on('chat:error', handleChatError);

    return () => {
      socket.off('message:new', handleMessageNew);
      socket.off('message:reaction', handleMessageReaction);
      socket.off('message:read', handleMessageRead);
      socket.off('chat:error', handleChatError);
    };
  }, [meetingCode, participantId, loadConversations, loadMessages]);

  // When chat is opened, mark active conversation as read
  useEffect(() => {
    if (isChatOpen && activeConversationId) {
      setUnreadConvs((prev) => {
        if (!prev.has(activeConversationId)) return prev;
        const next = new Set(prev);
        next.delete(activeConversationId);
        return next;
      });

      const currentMsgs = messages[activeConversationId] || [];
      const unreadIds = currentMsgs
        .filter(
          (m) =>
            m.senderParticipantId !== participantId &&
            !m.readByParticipantIds?.includes(participantId)
        )
        .map((m) => m.id);

      if (unreadIds.length > 0) {
        const socket = connectSocket();
        socket.emit('message:read', {
          meetingCode,
          conversationId: activeConversationId,
          participantId,
          messageIds: unreadIds,
        });
        chatApiService
          .markAsRead(meetingCode, activeConversationId, unreadIds, participantId)
          .catch(() => {});
      }
    }
  }, [isChatOpen, activeConversationId, messages, meetingCode, participantId]);

  const activeConversation =
    conversations.find((c) => c.id === activeConversationId) || null;
  const activeMessages = activeConversationId
    ? messages[activeConversationId] || []
    : [];
  const hasAnyUnread = unreadConvs.size > 0;

  return {
    conversations,
    activeConversationId,
    activeConversation,
    activeMessages,
    unreadConvs,
    hasAnyUnread,
    loadingConvs,
    loadingMessages,
    errorMessage,
    clearError: () => setErrorMessage(null),
    selectConversation,
    sendMessage,
    toggleReaction,
    startDirectMessage,
    reloadConversations: loadConversations,
  };
}

