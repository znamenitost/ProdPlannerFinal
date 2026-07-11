import {
  editChatMessage,
  getChatContacts,
  getChatConversations,
  getChatMessages,
  markChatRead,
  openDirectChat,
  sendChatMessage
} from '../../services/api';
import { avatarDisplayUrl } from '../../utils/avatarUrl';
import { textFromChatMessage } from './ChatEditSessionContext';
import {
  getPendingReplyMessage,
  messageMetadataWithReply,
  replyToFromDto,
  replyToFromSession
} from './chatReplyPreview';

export const TEAM_CHAT_AVATAR_URL = '/sprites/favicon2.svg';

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

  let status;
  if (isOwn) {
    status = dto.status === 'read' ? 'read' : 'sent';
  }

  const replyTo = replyToFromDto(dto);

  return {
    id: String(dto.id),
    conversationId: String(dto.conversationId),
    role: isOwn ? 'user' : 'assistant',
    status,
    createdAt: dto.createdAt,
    editedAt: dto.editedAt || undefined,
    metadata: replyTo ? { replyTo } : undefined,
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
      ? TEAM_CHAT_AVATAR_URL
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

function conversationVisualKey(conversation) {
  if (!conversation) return '';
  return [
    conversation.title,
    conversation.subtitle,
    conversation.unreadCount,
    conversation.readState,
    conversation.lastMessageAt,
    conversation.metadata?.lastPreview
  ].join('\0');
}

/**
 * Adapter bridging ProductionPlanner chat API + SignalR to MUI X Chat.
 */
export function createProductionChatAdapter({
  currentUserId,
  onUnreadMaybeChanged,
  getEditingMessage,
  clearEditingMessage,
  getReplyingMessage,
  clearReplyingMessage
}) {
  let eventHandler = null;
  let boundConnection = null;
  let viewingConversationId = null;
  let chatOpen = false;
  /** Conversations the user has opened/read in this session — protects against stale listConversations races. */
  const locallyReadIds = new Set();
  /** Last known conversation objects for optimistic patches. */
  const conversationCache = new Map();
  /** Cached messages for read-receipt updates (id → message). */
  const messageCache = new Map();
  /** Own message ids per conversation for sent→read flips. */
  const ownMessageIdsByConversation = new Map();
  /** Avoid duplicate mark-read API calls per conversation. */
  const lastMarkedReadByConversation = new Map();
  let conversationRefreshTimer = null;
  const pendingConversationRefreshIds = new Set();

  const emit = (event) => {
    eventHandler?.(event);
  };

  const emitConversationUpdated = (conversation) => {
    const id = String(conversation.id);
    const cached = conversationCache.get(id);
    const next = rememberConversation(conversation);
    if (cached && conversationVisualKey(cached) === conversationVisualKey(next)) {
      return next;
    }
    emit({ type: 'conversation-updated', conversation: next });
    return next;
  };

  const rememberMessage = (message) => {
    messageCache.set(String(message.id), message);
    if (message.role === 'user' && message.conversationId) {
      const key = String(message.conversationId);
      let set = ownMessageIdsByConversation.get(key);
      if (!set) {
        set = new Set();
        ownMessageIdsByConversation.set(key, set);
      }
      set.add(String(message.id));
    }
    return message;
  };

  const withPreservedReplyMetadata = (message) => {
    const cachedReplyTo = messageCache.get(String(message.id))?.metadata?.replyTo;
    if (message.metadata?.replyTo || !cachedReplyTo) return message;
    return {
      ...message,
      metadata: messageMetadataWithReply(message, cachedReplyTo)
    };
  };

  const applyMessageUpdate = (dto) => {
    if (!dto?.id) return;
    const mapped = rememberMessage(withPreservedReplyMetadata(mapServerMessage(dto, currentUserId)));
    emit({ type: 'message-updated', message: mapped });

    const convId = String(dto.conversationId);
    const cached = conversationCache.get(convId);
    if (!cached) return;

    const preview = previewFromMessage(dto);
    const next = rememberConversation({
      ...cached,
      lastMessageAt: dto.createdAt || cached.lastMessageAt,
      subtitle: cached.metadata?.type === 'Team'
        ? 'Вся команда'
        : (cached.participants?.some((p) => p.isOnline)
          ? 'В сети'
          : (preview || cached.metadata?.lastPreview || 'Личные сообщения')),
      metadata: {
        ...cached.metadata,
        lastPreview: preview || cached.metadata?.lastPreview
      }
    });
    emitConversationUpdated(next);
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
    const cached = conversationCache.get(id);
    const alreadyCleared = locallyReadIds.has(id)
      && (!cached || (cached.unreadCount === 0 && cached.readState === 'read'));

    locallyReadIds.add(id);
    if (alreadyCleared) return;

    emit({ type: 'read', conversationId: id });

    if (cached && (cached.unreadCount > 0 || cached.readState !== 'read')) {
      emitConversationUpdated({
        ...cached,
        unreadCount: 0,
        readState: 'read'
      });
    }

    onUnreadMaybeChanged?.();
  };

  const flushConversationRefresh = async () => {
    const ids = [...pendingConversationRefreshIds];
    pendingConversationRefreshIds.clear();
    if (!ids.length) return;

    try {
      const list = await getChatConversations();
      for (const convId of ids) {
        const found = list.find((c) => String(c.id) === convId);
        if (found) {
          emitConversationUpdated(withLocalReadState(mapServerConversation(found, currentUserId)));
        }
      }
      onUnreadMaybeChanged?.();
    } catch {
      onUnreadMaybeChanged?.();
    }
  };

  const scheduleConversationRefresh = (conversationId) => {
    if (conversationId != null) {
      pendingConversationRefreshIds.add(String(conversationId));
    }
    if (conversationRefreshTimer) {
      clearTimeout(conversationRefreshTimer);
    }
    conversationRefreshTimer = setTimeout(() => {
      conversationRefreshTimer = null;
      void flushConversationRefresh();
    }, 350);
  };

  const markReadUpTo = async (conversationId, messageId) => {
    if (!messageId) return;
    const id = Number(messageId);
    if (!Number.isFinite(id) || id <= 0) return;

    const convKey = String(conversationId);
    const prevMarked = lastMarkedReadByConversation.get(convKey) ?? 0;
    if (id <= prevMarked) {
      // Уже подтверждено сервером ранее — можно спокойно сбросить локальный badge.
      pushUnreadCleared(conversationId);
      return;
    }

    try {
      await markChatRead(Number(conversationId), id);
      lastMarkedReadByConversation.set(convKey, id);
      pushUnreadCleared(conversationId);
      onUnreadMaybeChanged?.();
    } catch (err) {
      console.warn('Chat markRead failed:', err?.message ?? err);
      // Не трогаем locallyReadIds / badge — refresh восстановит реальный unread с сервера.
      onUnreadMaybeChanged?.();
    }
  };

  const handleHubMessage = (dto) => {
    if (!dto?.id) return;

    const conversationId = String(dto.conversationId);
    const id = String(dto.id);

    // Own message echo (other tabs) — add once if not already present from sendMessage.
    if (dto.senderUserId === currentUserId) {
      const existedBefore = messageCache.has(id);
      const mapped = rememberMessage(withPreservedReplyMetadata(mapServerMessage(dto, currentUserId)));
      if (existedBefore) {
        emit({
          type: 'message-updated',
          message: mapped
        });
      } else {
        emit({
          type: 'message-added',
          message: mapped
        });
      }
      onUnreadMaybeChanged?.();
      return;
    }

    const viewingThisThread = chatOpen
      && viewingConversationId != null
      && viewingConversationId === conversationId
      && document.visibilityState === 'visible';

    if (!viewingThisThread) {
      locallyReadIds.delete(conversationId);
    }

    emit({
      type: 'message-added',
      message: rememberMessage(mapServerMessage(dto, currentUserId))
    });
    onUnreadMaybeChanged?.();

    if (viewingThisThread) {
      void markReadUpTo(conversationId, dto.id);
    } else {
      scheduleConversationRefresh(conversationId);
    }
  };

  const handleHubMessageUpdated = (dto) => {
    applyMessageUpdate(dto);
  };

  const handleHubMessagesRead = (conversationId, lastMessageId, readerUserId) => {
    if (!conversationId || readerUserId === currentUserId) return;
    const convId = String(conversationId);
    const upTo = Number(lastMessageId);
    if (!Number.isFinite(upTo) || upTo <= 0) return;

    // Read receipts only for direct chats (team stays "sent").
    const conv = conversationCache.get(convId);
    if (conv?.metadata?.type === 'Team') return;

    const ownIds = ownMessageIdsByConversation.get(convId);
    if (!ownIds?.size) return;

    for (const messageId of ownIds) {
      if (Number(messageId) > upTo) continue;
      const cached = messageCache.get(String(messageId));
      if (!cached || cached.status === 'read') continue;
      const updated = { ...cached, status: 'read' };
      rememberMessage(updated);
      emit({ type: 'message-updated', message: updated });
    }
  };

  const handleHubPresence = (userId, isOnline) => {
    if (!userId) return;
    const online = Boolean(isOnline);
    emit({ type: 'presence', userId: String(userId), isOnline: online });

    for (const conv of conversationCache.values()) {
      if (conv.metadata?.peerUserId !== String(userId)) continue;
      emitConversationUpdated({
        ...conv,
        subtitle: online
          ? 'В сети'
          : (conv.metadata?.lastPreview || 'Личные сообщения'),
        participants: (conv.participants || []).map((p) => (
          p.id === String(userId) ? { ...p, isOnline: online } : p
        ))
      });
    }
  };

  const handleHubConversationUpdated = (conversationId) => {
    scheduleConversationRefresh(conversationId);
  };

  const unbindHub = () => {
    if (!boundConnection) return;
    boundConnection.off('ChatMessage', handleHubMessage);
    boundConnection.off('ChatMessageUpdated', handleHubMessageUpdated);
    boundConnection.off('ChatConversationUpdated', handleHubConversationUpdated);
    boundConnection.off('ChatMessagesRead', handleHubMessagesRead);
    boundConnection.off('ChatPresence', handleHubPresence);
    boundConnection = null;
  };

  const bindHub = (connection) => {
    if (boundConnection === connection) return;
    unbindHub();
    if (!connection) return;
    boundConnection = connection;
    connection.on('ChatMessage', handleHubMessage);
    connection.on('ChatMessageUpdated', handleHubMessageUpdated);
    connection.on('ChatConversationUpdated', handleHubConversationUpdated);
    connection.on('ChatMessagesRead', handleHubMessagesRead);
    connection.on('ChatPresence', handleHubPresence);
  };

  return {
    bindHub,
    unbindHub,

    setViewingState({ open, conversationId }) {
      chatOpen = Boolean(open);
      const nextId = conversationId != null ? String(conversationId) : null;
      viewingConversationId = nextId;
      // Badge сбрасываем только после успешного markChatRead (listMessages → markReadUpTo).
    },

    clearUnread(conversationId) {
      if (!conversationId) return;
      pushUnreadCleared(conversationId);
    },

    async listConversations() {
      const list = await getChatConversations();
      const conversations = list
        .map((c) => withLocalReadState(mapServerConversation(c, currentUserId)))
        .sort((a, b) => {
          if (a.metadata?.type === 'Team' && b.metadata?.type !== 'Team') return -1;
          if (b.metadata?.type === 'Team' && a.metadata?.type !== 'Team') return 1;
          return 0;
        });

      // Re-assert read badges after MUI applies setConversations (no extra conversation-updated).
      setTimeout(() => {
        if (chatOpen && viewingConversationId) {
          emit({ type: 'read', conversationId: String(viewingConversationId) });
        }
        for (const id of locallyReadIds) {
          emit({ type: 'read', conversationId: id });
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
      const messages = rows.map((m) => rememberMessage(mapServerMessage(m, currentUserId)));
      const nextCursor = rows.length ? String(rows[0].id) : cursor;

      const isInitialPage = direction === 'backward' && !cursor;
      if (isInitialPage && rows.length > 0) {
        const latestId = rows.reduce((max, m) => (m.id > max ? m.id : max), rows[0].id);
        void markReadUpTo(conversationId, latestId);
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

      const editing = getEditingMessage?.();
      const editMessageId = Number(editing?.id);
      if (
        editing
        && Number.isFinite(editMessageId)
        && editMessageId > 0
      ) {
        try {
          const dto = await editChatMessage(Number(conversationId), editMessageId, text);
          if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');

          // MUI always inserts an optimistic new message before sendMessage —
          // remove it and patch the real edited message instead.
          if (message?.id) {
            emit({
              type: 'message-removed',
              messageId: String(message.id),
              conversationId: String(conversationId)
            });
          }
          applyMessageUpdate(dto);
          clearEditingMessage?.();
          scheduleConversationRefresh(dto.conversationId);
          return emptyStream();
        } catch (err) {
          if (message?.id) {
            emit({
              type: 'message-removed',
              messageId: String(message.id),
              conversationId: String(conversationId)
            });
          }
          throw err;
        }
      }

      const replying = getReplyingMessage?.() || getPendingReplyMessage();
      const pendingReplyTo = replyToFromSession(replying);

      if (pendingReplyTo && message?.id) {
        emit({
          type: 'message-updated',
          message: {
            ...message,
            metadata: messageMetadataWithReply(message, pendingReplyTo)
          }
        });
      }

      const dto = await sendChatMessage(
        Number(conversationId),
        text,
        files,
        replying?.id
      );
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
      clearReplyingMessage?.();

      const mapped = mapServerMessage(dto, currentUserId);
      const replyTo = replyToFromDto(dto) ?? pendingReplyTo;
      const nextMessage = {
        ...mapped,
        metadata: replyTo
          ? messageMetadataWithReply(mapped, replyTo)
          : mapped.metadata
      };
      const existedBefore = messageCache.has(String(nextMessage.id));
      const serverMessage = rememberMessage(nextMessage);

      if (message?.id && String(message.id) !== serverMessage.id) {
        emit({
          type: 'message-removed',
          messageId: String(message.id),
          conversationId: String(conversationId)
        });
      }

      if (existedBefore) {
        emit({ type: 'message-updated', message: serverMessage });
      } else {
        emit({ type: 'message-added', message: serverMessage });
      }

      scheduleConversationRefresh(dto.conversationId);
      return emptyStream();
    },

    /** Start Telegram-style edit for an own message (UI fills composer). */
    beginEdit(message) {
      if (!message || message.role !== 'user') return null;
      return {
        id: String(message.id),
        conversationId: String(message.conversationId || viewingConversationId || ''),
        text: textFromChatMessage(message)
      };
    },

    async markRead({ conversationId, messageId }) {
      await markReadUpTo(conversationId, messageId);
    },

    async subscribe({ onEvent }) {
      eventHandler = onEvent;
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
