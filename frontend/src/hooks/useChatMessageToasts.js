import { useCallback, useEffect, useRef, useState } from 'react';

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

/**
 * Toast notifications for incoming chat messages (when chat is closed or another thread is active).
 * Queues toasts while the browser tab is hidden (same pattern as task push notifications).
 */
export default function useChatMessageToasts(user, hubConnection, {
  enabled = true,
  chatOpen = false,
  activeConversationId = null
} = {}) {
  const [toasts, setToasts] = useState([]);
  const hiddenQueueRef = useRef([]);
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

  const offerToast = useCallback((dto) => {
    if (!dto?.id) return;
    const toast = toastFromDto(dto);

    if (document.visibilityState === 'hidden') {
      if (!hiddenQueueRef.current.some((t) => t.serverId === toast.serverId)) {
        hiddenQueueRef.current.push(toast);
      }
      return;
    }

    commitToast(toast);
  }, [commitToast]);

  const flushHiddenQueue = useCallback(() => {
    if (document.visibilityState === 'hidden') return;
    const queued = [...hiddenQueueRef.current];
    hiddenQueueRef.current = [];
    queued.forEach((toast) => {
      const viewingThisThread = chatOpenRef.current
        && String(activeConversationIdRef.current || '') === String(toast.conversationId);
      if (viewingThisThread) return;
      commitToast(toast);
    });
  }, [commitToast]);

  useEffect(() => {
    if (!enabled || !hubConnection || !user?.id) return undefined;

    const onMessage = (dto) => {
      if (!dto?.id || dto.senderUserId === user.id) return;

      const conversationId = String(dto.conversationId);
      const viewingThisThread = chatOpenRef.current
        && String(activeConversationIdRef.current || '') === conversationId;
      if (viewingThisThread && document.visibilityState === 'visible') return;

      offerToast(dto);
    };

    hubConnection.on('ChatMessage', onMessage);

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') flushHiddenQueue();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onVisibilityChange);

    return () => {
      hubConnection.off('ChatMessage', onMessage);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onVisibilityChange);
    };
  }, [enabled, hubConnection, user?.id, offerToast, flushHiddenQueue]);

  // Drop toasts for the conversation once user opens it.
  useEffect(() => {
    if (!chatOpen || !activeConversationId) return;
    const id = String(activeConversationId);
    setToasts((prev) => prev.filter((t) => String(t.conversationId) !== id));
    hiddenQueueRef.current = hiddenQueueRef.current.filter(
      (t) => String(t.conversationId) !== id
    );
  }, [chatOpen, activeConversationId]);

  return { chatToasts: toasts, closeChatToast: closeToast, clearChatToasts: clearToasts };
}
