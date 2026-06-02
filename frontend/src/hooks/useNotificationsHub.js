import { useCallback, useEffect, useRef, useState } from 'react';
import * as signalR from '@microsoft/signalr';

function formatNotificationDeadline(deadline) {
  if (deadline == null || deadline === '') return 'не указан';
  const d = new Date(deadline);
  if (Number.isNaN(d.getTime())) return 'не указан';
  return d.toLocaleString('ru-RU');
}

function parseNewTaskHubArgs(notificationId, taskId, taskTitle, deadline, type) {
  if (Array.isArray(notificationId)) {
    const [a, b, c, d, e] = notificationId;
    return { notificationId: a, taskId: b, taskTitle: c, deadline: d, type: e };
  }
  return { notificationId, taskId, taskTitle, deadline, type };
}

function mapPendingDto(dto) {
  return {
    id: `n-${dto.id}`,
    serverId: dto.id,
    type: dto.type || 'NewTask',
    title: dto.title?.trim() || 'Новая задача',
    deadline: formatNotificationDeadline(dto.deadline),
  };
}

function normalizeAffectedEmployees(value) {
  if (Array.isArray(value)) {
    return value.map((name) => String(name || '').trim()).filter(Boolean);
  }
  const name = String(value || '').trim();
  return name ? [name] : [];
}

/**
 * @param {object} handlers
 * @param {(event: { type: string, taskId?: number, affectedEmployees?: string[] }) => Promise<boolean>|boolean} [handlers.onTaskEvent]
 * @param {() => void} [handlers.onTableFallbackRefresh] — полная перезагрузка таблицы, если строка не на экране
 * @param {(event?: { type: string, taskId?: number, affectedEmployees?: string[] }) => void} [handlers.onCalendarRefresh] — календарь / completed
 * @param {() => void} [handlers.onFullRefresh] — reconnect и т.п.
 */
export default function useNotificationsHub(user, handlers = {}) {
  const [notifications, setNotifications] = useState([]);
  const refreshTimeoutRef = useRef(null);
  const taskEventChainRef = useRef(Promise.resolve());
  const handlersRef = useRef(handlers);
  const displayedServerIdsRef = useRef(new Set());
  const hiddenQueueRef = useRef([]);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  const scheduleCalendarRefresh = useCallback(() => {
    if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    refreshTimeoutRef.current = setTimeout(() => {
      handlersRef.current.onCalendarRefresh?.();
    }, 300);
  }, []);

  const scheduleTaskEvent = useCallback((event) => {
    const run = async () => {
      const h = handlersRef.current;
      let tableHandled = false;
      try {
        tableHandled = Boolean(await h.onTaskEvent?.(event));
      } catch (err) {
        console.error('Hub task event handler error:', err);
      }
      h.onActiveTasksRefresh?.(event);
      h.onCalendarRefresh?.(event);
      if (!tableHandled) {
        h.onTableFallbackRefresh?.(event);
      }
    };

    const enqueueRun = () => {
      taskEventChainRef.current = taskEventChainRef.current
        .catch(() => {})
        .then(run);
    };

    const immediate = event.type === 'TaskStatusChanged' || event.type === 'TaskProgressChanged';
    if (immediate) {
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
      enqueueRun();
      return;
    }

    if (refreshTimeoutRef.current) clearTimeout(refreshTimeoutRef.current);
    refreshTimeoutRef.current = setTimeout(enqueueRun, 300);
  }, []);

  const hubTaskId = (taskId) => {
    const id = Number(taskId);
    return Number.isFinite(id) ? id : null;
  };

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

  const fetchPendingNotifications = useCallback(async (signal) => {
    if (!user?.id) return;
    try {
      const response = await fetch('/api/notifications/pending', {
        credentials: 'include',
        signal,
      });
      if (!response.ok) return;
      const pending = await response.json();
      pending.forEach((dto) => offerNotification(mapPendingDto(dto)));
    } catch (err) {
      if (signal?.aborted || err?.name === 'AbortError') return;
      // NetworkError / "Load failed" — backend offline or proxy unreachable (dev)
      console.warn('Pending notifications unavailable:', err?.message ?? err);
    }
  }, [user?.id, offerNotification]);

  useEffect(() => {
    if (!user?.id) return undefined;

    let isMounted = true;
    const abort = new AbortController();
    displayedServerIdsRef.current = new Set();
    hiddenQueueRef.current = [];

    const connection = new signalR.HubConnectionBuilder()
      .withUrl('/notificationHub', { withCredentials: true })
      .withAutomaticReconnect()
      .build();

    const handleNewTask = (notificationId, taskId, taskTitle, deadline, type) => {
      if (!isMounted) return;
      const args = parseNewTaskHubArgs(notificationId, taskId, taskTitle, deadline, type);
      const title =
        typeof args.taskTitle === 'string' ? args.taskTitle.trim() : String(args.taskTitle ?? '').trim();
      offerNotification({
        id: `n-${args.notificationId}`,
        serverId: args.notificationId,
        type: args.type || 'NewTask',
        title: title || 'Новая задача',
        deadline: formatNotificationDeadline(args.deadline),
      });
      scheduleCalendarRefresh();
    };

    const handleTaskDeleted = (taskId, affectedEmployees) => {
      if (!isMounted) return;
      const id = hubTaskId(taskId);
      if (id != null) {
        scheduleTaskEvent({
          type: 'TaskDeleted',
          taskId: id,
          affectedEmployees: normalizeAffectedEmployees(affectedEmployees),
        });
      }
    };

    const handleTaskUpdated = (taskId, _taskTitle, _deadline, affectedEmployees) => {
      if (!isMounted) return;
      const id = hubTaskId(taskId);
      if (id != null) {
        scheduleTaskEvent({
          type: 'TaskUpdated',
          taskId: id,
          affectedEmployees: normalizeAffectedEmployees(affectedEmployees),
        });
      }
    };

    const handleTaskStatusChanged = (taskId, status, affectedEmployees) => {
      if (!isMounted) return;
      const id = hubTaskId(taskId);
      if (id != null) {
        scheduleTaskEvent({
          type: 'TaskStatusChanged',
          taskId: id,
          status,
          affectedEmployees: normalizeAffectedEmployees(affectedEmployees),
        });
      }
    };

    const handleTaskProgressChanged = (taskId, _progress, affectedEmployees) => {
      if (!isMounted) return;
      const id = hubTaskId(taskId);
      if (id != null) {
        scheduleTaskEvent({
          type: 'TaskProgressChanged',
          taskId: id,
          affectedEmployees: normalizeAffectedEmployees(affectedEmployees),
        });
      }
    };

    const handleForceDisconnect = () => {
      connection.stop().catch((err) => console.error('SignalR forced stop error:', err));
    };

    connection.on('NewTask', handleNewTask);
    connection.on('TaskDeleted', handleTaskDeleted);
    connection.on('TaskUpdated', handleTaskUpdated);
    connection.on('TaskStatusChanged', handleTaskStatusChanged);
    connection.on('TaskProgressChanged', handleTaskProgressChanged);
    connection.on('ForceDisconnect', handleForceDisconnect);

    const startConnection = async () => {
      try {
        await connection.start();
        if (!isMounted) return;
        await connection.invoke('JoinUserGroup', user.id).catch(() => {});
        await fetchPendingNotifications(abort.signal);
      } catch (err) {
        console.warn('SignalR start error:', err?.message ?? err);
        await fetchPendingNotifications(abort.signal);
      }
    };

    startConnection();

    connection.onreconnected(async () => {
      if (!isMounted) return;
      await connection.invoke('JoinUserGroup', user.id).catch(() => {});
      await fetchPendingNotifications(abort.signal);
      flushHiddenQueue();
      handlersRef.current.onFullRefresh?.();
    });

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        flushHiddenQueue();
        fetchPendingNotifications(abort.signal);
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onVisibilityChange);

    return () => {
      isMounted = false;
      abort.abort();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('focus', onVisibilityChange);
      if (refreshTimeoutRef.current) {
        clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
      connection.off('NewTask', handleNewTask);
      connection.off('TaskDeleted', handleTaskDeleted);
      connection.off('TaskUpdated', handleTaskUpdated);
      connection.off('TaskStatusChanged', handleTaskStatusChanged);
      connection.off('TaskProgressChanged', handleTaskProgressChanged);
      connection.off('ForceDisconnect', handleForceDisconnect);
      connection.stop().catch((err) => console.error('SignalR stop error:', err));
    };
  }, [
    user?.id,
    offerNotification,
    fetchPendingNotifications,
    flushHiddenQueue,
    scheduleCalendarRefresh,
    scheduleTaskEvent,
  ]);

  const closeNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return { notifications, closeNotification };
}
