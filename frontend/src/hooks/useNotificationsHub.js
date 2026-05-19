import { useCallback, useEffect, useRef, useState } from 'react';
import * as signalR from '@microsoft/signalr';

function formatNotificationDeadline(deadline) {
  if (deadline == null || deadline === '') return 'не указан';
  const d = new Date(deadline);
  if (Number.isNaN(d.getTime())) return 'не указан';
  return d.toLocaleString('ru-RU');
}

function parseNewTaskHubArgs(notificationId, taskId, taskTitle, deadline) {
  if (Array.isArray(notificationId)) {
    const [a, b, c, d] = notificationId;
    return { notificationId: a, taskId: b, taskTitle: c, deadline: d };
  }
  return { notificationId, taskId, taskTitle, deadline };
}

function mapPendingDto(dto) {
  return {
    id: `n-${dto.id}`,
    serverId: dto.id,
    title: dto.title?.trim() || 'Новая задача',
    deadline: formatNotificationDeadline(dto.deadline),
  };
}

export default function useNotificationsHub(user, onRefresh) {
  const [notifications, setNotifications] = useState([]);
  const refreshTimeoutRef = useRef(null);
  const onRefreshRef = useRef(onRefresh);
  const displayedServerIdsRef = useRef(new Set());
  const hiddenQueueRef = useRef([]);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    refreshTimeoutRef.current = setTimeout(() => {
      onRefreshRef.current?.();
    }, 300);
  }, []);

  const ackNotification = useCallback(async (serverId) => {
    if (serverId == null) return;
    try {
      await fetch(`/api/notifications/${serverId}/ack`, {
        method: 'POST',
        credentials: 'include',
      });
    } catch (err) {
      console.error('Notification ack error:', err);
    }
  }, []);

  const commitDisplay = useCallback((notification) => {
    setNotifications((prev) => {
      if (prev.some((n) => n.serverId === notification.serverId)) return prev;
      return [...prev.slice(-19), notification];
    });
    displayedServerIdsRef.current.add(notification.serverId);
    ackNotification(notification.serverId);
  }, [ackNotification]);

  const offerNotification = useCallback((notification) => {
    if (notification.serverId == null) return;
    if (displayedServerIdsRef.current.has(notification.serverId)) return;

    if (document.visibilityState === 'hidden') {
      if (!hiddenQueueRef.current.some((n) => n.serverId === notification.serverId)) {
        hiddenQueueRef.current.push(notification);
      }
      return;
    }

    commitDisplay(notification);
  }, [commitDisplay]);

  const flushHiddenQueue = useCallback(() => {
    if (document.visibilityState === 'hidden') return;
    const queued = [...hiddenQueueRef.current];
    hiddenQueueRef.current = [];
    queued.forEach(offerNotification);
  }, [offerNotification]);

  const fetchPendingNotifications = useCallback(async () => {
    if (!user?.id) return;
    try {
      const response = await fetch('/api/notifications/pending', { credentials: 'include' });
      if (!response.ok) return;
      const pending = await response.json();
      pending.forEach((dto) => offerNotification(mapPendingDto(dto)));
    } catch (err) {
      console.error('Fetch pending notifications error:', err);
    }
  }, [user?.id, offerNotification]);

  useEffect(() => {
    if (!user?.id) return undefined;

    let isMounted = true;
    displayedServerIdsRef.current = new Set();
    hiddenQueueRef.current = [];

    const connection = new signalR.HubConnectionBuilder()
      .withUrl('/notificationHub', { withCredentials: true })
      .withAutomaticReconnect()
      .build();

    const handleNewTask = (notificationId, taskId, taskTitle, deadline) => {
      if (!isMounted) return;
      const args = parseNewTaskHubArgs(notificationId, taskId, taskTitle, deadline);
      const title =
        typeof args.taskTitle === 'string' ? args.taskTitle.trim() : String(args.taskTitle ?? '').trim();
      offerNotification({
        id: `n-${args.notificationId}`,
        serverId: args.notificationId,
        title: title || 'Новая задача',
        deadline: formatNotificationDeadline(args.deadline),
      });
      scheduleRefresh();
    };

    const handleRefreshEvent = () => {
      if (!isMounted) return;
      scheduleRefresh();
    };

    connection.on('NewTask', handleNewTask);
    connection.on('TaskDeleted', handleRefreshEvent);
    connection.on('TaskUpdated', handleRefreshEvent);
    connection.on('TaskStatusChanged', handleRefreshEvent);
    connection.on('TaskProgressChanged', handleRefreshEvent);

    const startConnection = async () => {
      try {
        await connection.start();
        if (!isMounted) return;
        await connection.invoke('JoinUserGroup', user.id).catch(() => {});
        await fetchPendingNotifications();
      } catch (err) {
        console.error('SignalR start error:', err);
        await fetchPendingNotifications();
      }
    };

    startConnection();

    connection.onreconnected(async () => {
      if (!isMounted) return;
      await connection.invoke('JoinUserGroup', user.id).catch(() => {});
      await fetchPendingNotifications();
      flushHiddenQueue();
    });

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        flushHiddenQueue();
        fetchPendingNotifications();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onVisibilityChange);

    return () => {
      isMounted = false;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onVisibilityChange);
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
      connection.off('NewTask', handleNewTask);
      connection.off('TaskDeleted', handleRefreshEvent);
      connection.off('TaskUpdated', handleRefreshEvent);
      connection.off('TaskStatusChanged', handleRefreshEvent);
      connection.off('TaskProgressChanged', handleRefreshEvent);
      connection.stop().catch((err) => console.error('SignalR stop error:', err));
    };
  }, [
    user?.id,
    offerNotification,
    fetchPendingNotifications,
    flushHiddenQueue,
    scheduleRefresh,
  ]);

  const closeNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return { notifications, closeNotification };
}
