import { useCallback, useEffect, useRef, useState } from 'react';
import { getChatConversations } from '../services/api';
import {
  browserNotificationForChat,
  isPageActive,
  showBrowserNotification
} from '../utils/browserNotification';

function pluralizeRu(value, one, few, many) {
  const mod10 = value % 10;
  const mod100 = value % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

function previewFromDto(dto) {
  const text = String(dto?.text || '').trim().replace(/\s+/g, ' ');
  if (text) return text.length > 90 ? `${text.slice(0, 89)}…` : text;
  const files = dto?.attachments || [];
  if (files.length === 1) return `Файл: ${files[0].fileName}`;
  if (files.length > 1) return `${files.length} файла`;
  return 'Новое сообщение';
}

function toastFromDto(dto) {
  return {
    id: `chat-${dto.id}`,
    serverId: dto.id,
    type: 'ChatMessage',
    title: dto.senderFullName || 'Сообщение',
    body: previewFromDto(dto),
    conversationId: String(dto.conversationId),
    createdAt: dto.createdAt
  };
}

function unreadSummaryToast(userId, unreadConversations) {
  const total = unreadConversations.reduce((sum, conversation) => sum + (conversation.unreadCount || 0), 0);
  const latest = unreadConversations
    .map((conversation) => conversation.lastMessage)
    .filter(Boolean)
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))[0];
  const conversationsCount = unreadConversations.length;
  const messageWord = pluralizeRu(total, 'сообщение', 'сообщения', 'сообщений');
  const chatWord = pluralizeRu(conversationsCount, 'чате', 'чатах', 'чатах');
  const signature = `${userId}-${total}-${latest?.id || 'none'}`;

  return {
    id: `chat-pending-${signature}`,
    serverId: `pending-${signature}`,
    type: 'ChatMessage',
    title: 'Неотвеченные сообщения',
    body: conversationsCount > 1
      ? `У вас ${total} ${messageWord} в ${conversationsCount} ${chatWord}.`
      : `У вас ${total} ${messageWord}.`,
    conversationId: conversationsCount === 1 ? String(unreadConversations[0].id) : undefined,
    isUnreadSummary: true,
    createdAt: latest?.createdAt
  };
}

/**
 * Toast notifications for incoming chat messages (when chat is closed or another thread is active).
 * Uses native browser notifications when the window is not active; otherwise in-app snackbars.
 */
export default function useChatMessageToasts(user, hubConnection, {
  enabled = true,
  chatOpen = false,
  activeConversationId = null
} = {}) {
  const [toasts, setToasts] = useState([]);
  const hiddenQueueRef = useRef([]);
  const shownNativeIdsRef = useRef(new Set());
  const pendingSummaryShownRef = useRef(new Set());
  const chatOpenRef = useRef(chatOpen);
  const activeConversationIdRef = useRef(activeConversationId);
  chatOpenRef.current = chatOpen;
  activeConversationIdRef.current = activeConversationId;

  const closeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearToasts = useCallback(() => setToasts([]), []);

  const commitToast = useCallback((toast) => {
    setToasts((prev) => {
      if (prev.some((t) => t.serverId === toast.serverId)) return prev;
      return [...prev.slice(-4), toast];
    });
  }, []);

  const offerPreparedToast = useCallback((toast) => {
    if (!toast?.serverId) return;
    if (shownNativeIdsRef.current.has(toast.serverId)) return;

    if (!isPageActive()) {
      const payload = browserNotificationForChat(toast);
      showBrowserNotification(payload).then((shown) => {
        if (shown) {
          shownNativeIdsRef.current.add(toast.serverId);
          return;
        }
        if (!hiddenQueueRef.current.some((t) => t.serverId === toast.serverId)) {
          hiddenQueueRef.current.push(toast);
        }
      });
      return;
    }

    commitToast(toast);
  }, [commitToast]);

  const offerToast = useCallback((dto) => {
    if (!dto?.id) return;
    offerPreparedToast(toastFromDto(dto));
  }, [offerPreparedToast]);

  const flushHiddenQueue = useCallback(() => {
    if (!isPageActive()) return;
    const queued = [...hiddenQueueRef.current];
    hiddenQueueRef.current = [];
    queued.forEach((toast) => {
      if (shownNativeIdsRef.current.has(toast.serverId)) return;
      const viewingThisThread = chatOpenRef.current
        && String(activeConversationIdRef.current || '') === String(toast.conversationId);
      if (viewingThisThread) return;
      commitToast(toast);
    });
  }, [commitToast]);

  useEffect(() => {
    if (!enabled || !user?.id || !user?.isAuthenticated) return undefined;

    const abort = new AbortController();
    const userId = user.id;

    getChatConversations({ signal: abort.signal })
      .then((conversations) => {
        const unreadConversations = conversations.filter((conversation) => (conversation.unreadCount || 0) > 0);
        if (unreadConversations.length === 0) return;

        const toast = unreadSummaryToast(userId, unreadConversations);
        if (pendingSummaryShownRef.current.has(toast.serverId)) return;

        pendingSummaryShownRef.current.add(toast.serverId);
        offerPreparedToast(toast);
      })
      .catch((err) => {
        if (abort.signal.aborted || err?.name === 'AbortError') return;
        console.warn('Pending chat notifications unavailable:', err?.message ?? err);
      });

    return () => abort.abort();
  }, [enabled, user?.id, user?.isAuthenticated, offerPreparedToast]);

  useEffect(() => {
    if (!enabled || !hubConnection || !user?.id) return undefined;

    const onMessage = (dto) => {
      if (!dto?.id || dto.senderUserId === user.id) return;

      const conversationId = String(dto.conversationId);
      const viewingThisThread = chatOpenRef.current
        && String(activeConversationIdRef.current || '') === conversationId;
      // Suppress only when the user is actively looking at this thread.
      if (viewingThisThread && isPageActive()) return;

      offerToast(dto);
    };

    hubConnection.on('ChatMessage', onMessage);

    const onVisibilityChange = () => {
      if (isPageActive()) flushHiddenQueue();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onVisibilityChange);

    return () => {
      hubConnection.off('ChatMessage', onMessage);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onVisibilityChange);
    };
  }, [enabled, hubConnection, user?.id, offerToast, flushHiddenQueue]);

  // Drop stale chat prompts once the user opens the relevant chat surface.
  useEffect(() => {
    if (!chatOpen) return;
    if (!activeConversationId) {
      setToasts((prev) => prev.filter((t) => !t.isUnreadSummary));
      hiddenQueueRef.current = hiddenQueueRef.current.filter((t) => !t.isUnreadSummary);
      return;
    }
    const id = String(activeConversationId);
    setToasts((prev) => prev.filter((t) => !t.isUnreadSummary && String(t.conversationId) !== id));
    hiddenQueueRef.current = hiddenQueueRef.current.filter(
      (t) => !t.isUnreadSummary && String(t.conversationId) !== id
    );
  }, [chatOpen, activeConversationId]);

  return { chatToasts: toasts, closeChatToast: closeToast, clearChatToasts: clearToasts };
}
