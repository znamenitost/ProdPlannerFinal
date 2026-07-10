import {
  getChatContacts,
  getChatConversations,
  getChatMessages,
  markChatRead,
  openDirectChat,
  sendChatMessage
} from '../../services/api';
import { avatarDisplayUrl } from '../../utils/avatarUrl';

function emptyStream() {
  return new ReadableStream({
    start(controller) {
      controller.close();
    }
  });
}

function resolveAvatar(userId, avatarUrl) {
  if (userId) return avatarDisplayUrl(userId, { size: 96 });
  return avatarUrl || undefined;
}

function previewFromMessage(dto) {
  const text = String(dto?.text || '').trim();
  if (text) return text;
  const files = dto?.attachments || [];
  if (files.length === 1) return `📎 ${files[0].fileName}`;
  if (files.length > 1) return `📎 ${files.length} файла`;
  return '';
}

export function mapServerMessage(dto, currentUserId) {
  const isOwn = dto.senderUserId === currentUserId;
  const parts = [];
  if (dto.text) {
    parts.push({ type: 'text', text: dto.text });
  }
  for (const file of dto.attachments || []) {
    parts.push({
      type: 'file',
      mediaType: file.contentType || 'application/octet-stream',
      url: file.url,
      filename: file.fileName
    });
  }
  if (parts.length === 0) {
    parts.push({ type: 'text', text: '' });
  }

  return {
    id: String(dto.id),
    conversationId: String(dto.conversationId),
    role: isOwn ? 'user' : 'assistant',
    status: 'sent',
    createdAt: dto.createdAt,
    author: {
      id: dto.senderUserId,
      displayName: dto.senderFullName,
      avatarUrl: resolveAvatar(dto.senderUserId, dto.senderAvatarUrl),
      role: isOwn ? 'user' : 'assistant'
    },
    parts
  };
}

export function mapServerConversation(dto, currentUserId) {
  const isTeam = dto.type === 'Team';
  const participants = [];
  if (!isTeam && dto.peerUserId) {
    participants.push({
      id: dto.peerUserId,
      displayName: dto.peerFullName,
      avatarUrl: resolveAvatar(dto.peerUserId, dto.peerAvatarUrl),
      isOnline: Boolean(dto.peerIsOnline),
      role: 'assistant'
    });
  }

  const lastAt = dto.lastMessage?.createdAt;
  const unread = dto.unreadCount || 0;

  return {
    id: String(dto.id),
    title: dto.title || (isTeam ? 'Общий чат' : 'Чат'),
    subtitle: isTeam
      ? 'Вся команда'
      : dto.peerIsOnline
        ? 'В сети'
        : previewFromMessage(dto.lastMessage) || 'Личные сообщения',
    avatarUrl: isTeam
      ? undefined
      : resolveAvatar(dto.peerUserId, dto.peerAvatarUrl),
    participants,
    unreadCount: unread,
    readState: unread > 0 ? 'unread' : 'read',
    lastMessageAt: lastAt,
    metadata: {
      type: dto.type,
      peerUserId: dto.peerUserId || null,
      lastPreview: previewFromMessage(dto.lastMessage)
    }
  };
}

/**
 * Adapter bridging ProductionPlanner chat API + SignalR to MUI X Chat.
 */
export function createProductionChatAdapter({
  currentUserId,
  onUnreadMaybeChanged
}) {
  let eventHandler = null;
  let boundConnection = null;
  let viewingConversationId = null;
  let chatOpen = false;
  /** Conversations the user has opened/read in this session — protects against stale listConversations races. */
  const locallyReadIds = new Set();
  /** Last known conversation objects for optimistic patches. */
  const conversationCache = new Map();

  const emit = (event) => {
    eventHandler?.(event);
  };

  const rememberConversation = (conversation) => {
    conversationCache.set(String(conversation.id), conversation);
    return conversation;
  };

  const withLocalReadState = (conversation) => {
    const id = String(conversation.id);
    if (!locallyReadIds.has(id) && !(chatOpen && viewingConversationId === id)) {
      return rememberConversation(conversation);
    }
    const cleared = {
      ...conversation,
      unreadCount: 0,
      readState: 'read'
    };
    return rememberConversation(cleared);
  };

  const pushUnreadCleared = (conversationId) => {
    const id = String(conversationId);
    locallyReadIds.add(id);

    // MUI applies this immediately to the conversation list badge.
    emit({
      type: 'read',
      conversationId: id
    });

    const cached = conversationCache.get(id);
    if (cached) {
      emit({
        type: 'conversation-updated',
        conversation: rememberConversation({
          ...cached,
          unreadCount: 0,
          readState: 'read'
        })
      });
    }

    onUnreadMaybeChanged?.();
  };

  const markReadUpTo = async (conversationId, messageId) => {
    if (!messageId) return;
    const id = Number(messageId);
    if (!Number.isFinite(id) || id <= 0) return;

    pushUnreadCleared(conversationId);

    try {
      await markChatRead(Number(conversationId), id);
      await handleHubConversationUpdated(conversationId);
      onUnreadMaybeChanged?.();
    } catch (err) {
      console.warn('Chat markRead failed:', err?.message ?? err);
      onUnreadMaybeChanged?.();
    }
  };

  const handleHubMessage = (dto) => {
    if (!dto?.id) return;
    if (dto.senderUserId === currentUserId) {
      onUnreadMaybeChanged?.();
      return;
    }

    const conversationId = String(dto.conversationId);
    const viewingThisThread = chatOpen
      && viewingConversationId != null
      && viewingConversationId === conversationId
      && document.visibilityState === 'visible';

    if (!viewingThisThread) {
      // New unread message — allow badge to show again for this thread.
      locallyReadIds.delete(conversationId);
    }

    emit({
      type: 'message-added',
      message: mapServerMessage(dto, currentUserId)
    });
    onUnreadMaybeChanged?.();

    if (viewingThisThread) {
      void markReadUpTo(conversationId, dto.id);
    } else {
      // Refresh conversation row (unreadCount) from server.
      void handleHubConversationUpdated(conversationId);
    }
  };

  const handleHubConversationUpdated = async (conversationId) => {
    try {
      const list = await getChatConversations();
      const found = list.find((c) => String(c.id) === String(conversationId));
      if (found) {
        emit({
          type: 'conversation-updated',
          conversation: withLocalReadState(mapServerConversation(found, currentUserId))
        });
        onUnreadMaybeChanged?.();
      } else {
        onUnreadMaybeChanged?.();
      }
    } catch {
      onUnreadMaybeChanged?.();
    }
  };

  const unbindHub = () => {
    if (!boundConnection) return;
    boundConnection.off('ChatMessage', handleHubMessage);
    boundConnection.off('ChatConversationUpdated', handleHubConversationUpdated);
    boundConnection = null;
  };

  const bindHub = (connection) => {
    if (boundConnection === connection) return;
    unbindHub();
    if (!connection) return;
    boundConnection = connection;
    connection.on('ChatMessage', handleHubMessage);
    connection.on('ChatConversationUpdated', handleHubConversationUpdated);
  };

  return {
    bindHub,
    unbindHub,

    setViewingState({ open, conversationId }) {
      chatOpen = Boolean(open);
      const nextId = conversationId != null ? String(conversationId) : null;
      viewingConversationId = nextId;
      if (chatOpen && nextId) {
        queueMicrotask(() => {
          if (viewingConversationId !== nextId) return;
          pushUnreadCleared(nextId);
        });
      }
    },

    clearUnread(conversationId) {
      if (!conversationId) return;
      pushUnreadCleared(conversationId);
      // Again after MUI has applied any in-flight setConversations.
      setTimeout(() => {
        if (String(viewingConversationId) === String(conversationId)) {
          pushUnreadCleared(conversationId);
        }
      }, 0);
    },

    async listConversations() {
      const list = await getChatConversations();
      const conversations = list.map((c) => withLocalReadState(mapServerConversation(c, currentUserId)));

      // MUI does: listConversations().then(r => store.setConversations(r.conversations)).
      // If we emitted `read` before that, applyReadUpdate was a no-op (conversation missing).
      // Re-assert cleared badges on the next macrotask, after setConversations.
      setTimeout(() => {
        if (chatOpen && viewingConversationId) {
          pushUnreadCleared(viewingConversationId);
        }
        for (const id of locallyReadIds) {
          emit({ type: 'read', conversationId: id });
          const cached = conversationCache.get(id);
          if (cached) {
            emit({
              type: 'conversation-updated',
              conversation: rememberConversation({
                ...cached,
                unreadCount: 0,
                readState: 'read'
              })
            });
          }
        }
      }, 0);

      return {
        conversations,
        hasMore: false
      };
    },

    async listMessages({ conversationId, cursor, direction }) {
      const beforeId = direction === 'backward' && cursor ? Number(cursor) : undefined;
      const rows = await getChatMessages(Number(conversationId), {
        beforeId: Number.isFinite(beforeId) ? beforeId : undefined,
        take: 50
      });
      const messages = rows.map((m) => mapServerMessage(m, currentUserId));
      const nextCursor = rows.length ? String(rows[0].id) : cursor;

      const isInitialPage = direction === 'backward' && !cursor;
      if (isInitialPage) {
        pushUnreadCleared(conversationId);
        if (rows.length > 0) {
          const latestId = rows.reduce((max, m) => (m.id > max ? m.id : max), rows[0].id);
          void markReadUpTo(conversationId, latestId);
        }
      }

      return {
        messages,
        cursor: nextCursor,
        hasMore: rows.length >= 50
      };
    },

    async sendMessage({ conversationId, message, attachments, signal }) {
      const text = (message.parts || [])
        .filter((p) => p.type === 'text')
        .map((p) => p.text)
        .join('');
      const files = (attachments || []).map((a) => a.file).filter(Boolean);
      const dto = await sendChatMessage(Number(conversationId), text, files);
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      handleHubConversationUpdated(dto.conversationId).catch(() => {});
      return emptyStream();
    },

    async markRead({ conversationId, messageId }) {
      await markReadUpTo(conversationId, messageId);
    },

    async subscribe({ onEvent }) {
      eventHandler = onEvent;
      // If a thread is already open when subscribe attaches, clear its badge now.
      if (chatOpen && viewingConversationId) {
        pushUnreadCleared(viewingConversationId);
      }
      return () => {
        if (eventHandler === onEvent) eventHandler = null;
      };
    },

    async openDirect(peerUserId) {
      const dto = await openDirectChat(peerUserId);
      const conversation = withLocalReadState(mapServerConversation(dto, currentUserId));
      emit({ type: 'conversation-added', conversation });
      onUnreadMaybeChanged?.();
      return conversation;
    },

    async listContacts() {
      return getChatContacts();
    }
  };
}
