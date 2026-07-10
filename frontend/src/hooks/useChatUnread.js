import { useCallback, useEffect, useState } from 'react';
import * as signalR from '@microsoft/signalr';
import { getChatConversations } from '../services/api';

/**
 * Unread badge for header while chat drawer may be closed.
 */
export default function useChatUnread(user, hubConnection, { enabled = true } = {}) {
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async (signal) => {
    if (!user?.id || !user?.isAuthenticated) {
      setUnreadCount(0);
      return;
    }
    try {
      const list = await getChatConversations({ signal });
      const total = list.reduce((sum, c) => sum + (c.unreadCount || 0), 0);
      setUnreadCount(total);
    } catch (err) {
      if (err?.name === 'AbortError') return;
      console.warn('Chat unread refresh failed:', err?.message ?? err);
    }
  }, [user?.id, user?.isAuthenticated]);

  useEffect(() => {
    if (!enabled || !user?.id || !user?.isAuthenticated) {
      setUnreadCount(0);
      return undefined;
    }
    const abort = new AbortController();
    refresh(abort.signal);
    return () => abort.abort();
  }, [enabled, user?.id, user?.isAuthenticated, refresh]);

  useEffect(() => {
    if (!enabled || !hubConnection) return undefined;

    const bump = () => {
      refresh();
    };

    hubConnection.on('ChatMessage', bump);
    hubConnection.on('ChatConversationUpdated', bump);

    if (hubConnection.state === signalR.HubConnectionState.Connected) {
      refresh();
    }

    return () => {
      hubConnection.off('ChatMessage', bump);
      hubConnection.off('ChatConversationUpdated', bump);
    };
  }, [enabled, hubConnection, refresh]);

  return { unreadCount, refreshUnread: refresh, setUnreadCount };
}
