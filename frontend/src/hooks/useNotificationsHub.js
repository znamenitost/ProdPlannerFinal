import { useCallback, useEffect, useRef, useState } from 'react';
import * as signalR from '@microsoft/signalr';
import { buildViewSubscriptionState, syncHubViewGroups } from '../utils/hubViewSubscription';
import {
  isDeployMaintenanceMessage,
  notifyDeployMaintenanceIfNeeded,
  shortenHubLogMessage
} from '../utils/deployMaintenance';

function buildHubLogger(onMaintenanceDetected) {
  return (logLevel, message) => {
    const text = String(message ?? '');
    if (notifyDeployMaintenanceIfNeeded(text) || isDeployMaintenanceMessage(text)) {
      onMaintenanceDetected?.();
      return;
    }
    if (logLevel >= signalR.LogLevel.Warning) {
      console.warn(shortenHubLogMessage(text));
    }
  };
}

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

function shouldRefreshActiveTasks(event) {
  return ['TaskStatusChanged', 'TaskProgressChanged', 'TaskUpdated', 'TaskDeleted'].includes(event.type);
}

function shouldRefreshCalendar(event) {
  return [
    'TaskStatusChanged',
    'TaskUpdated',
    'TaskDeleted',
    'TaskProgressChanged'
  ].includes(event.type);
}

/**
 * @param {object} handlers
 * @param {(event: { type: string, taskId?: number, affectedEmployees?: string[] }) => Promise<boolean>|boolean} [handlers.onTaskEvent]
 * @param {() => void} [handlers.onTableFallbackRefresh] — полная перезагрузка таблицы, если строка не на экране
 * @param {(event?: { type: string, taskId?: number, affectedEmployees?: string[] }) => void} [handlers.onCalendarRefresh] — календарь / completed
 * @param {() => void} [handlers.onFullRefresh] — reconnect и т.п.
 * @param {() => void} [handlers.onCdrPreviewRetryDue] — повторный поиск превью .cdr
 * @param {object} [options.viewSubscription] — { activeTab, employee, userFullName, isAdmin }
 * @param {() => void} [options.onMaintenanceDetected] — сервер в режиме деплоя (503 / app_offline)
 */
export default function useNotificationsHub(user, handlers = {}, options = {}) {
  const { enabled = true, viewSubscription, onMaintenanceDetected } = options;
  const [notifications, setNotifications] = useState([]);
  const refreshTimeoutRef = useRef(null);
  const taskEventChainRef = useRef(Promise.resolve());
  const handlersRef = useRef(handlers);
  const displayedServerIdsRef = useRef(new Set());
  const hiddenQueueRef = useRef([]);
  const connectionRef = useRef(null);
  const prevViewRef = useRef(null);
  const viewSubscriptionRef = useRef(viewSubscription);
  const onMaintenanceDetectedRef = useRef(onMaintenanceDetected);
  viewSubscriptionRef.current = viewSubscription;
  onMaintenanceDetectedRef.current = onMaintenanceDetected;

  const handleMaintenanceDetected = useCallback(async (connection) => {
    onMaintenanceDetectedRef.current?.();
    if (connection?.state !== signalR.HubConnectionState.Disconnected
      && connection?.state !== signalR.HubConnectionState.Disconnecting) {
      try {
        await connection.stop();
      } catch {
        // ignore
      }
    }
  }, []);

  const applyViewSubscription = useCallback(async () => {
    const conn = connectionRef.current;
    const vs = viewSubscriptionRef.current;
    if (!conn || conn.state !== signalR.HubConnectionState.Connected || !vs) return;

    const next = buildViewSubscriptionState(vs);
    prevViewRef.current = await syncHubViewGroups(conn, prevViewRef.current, next);
  }, []);

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  useEffect(() => {
    applyViewSubscription();
  }, [
    applyViewSubscription,
    viewSubscription?.activeTab,
    viewSubscription?.employee,
    viewSubscription?.userFullName,
    viewSubscription?.isAdmin
  ]);

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
        if (shouldRefreshActiveTasks(event)) {
          h.onActiveTasksRefresh?.(event);
        }
        if (shouldRefreshCalendar(event)) {
          h.onCalendarRefresh?.(event);
        }
      } catch (err) {
        console.error('Hub task event handler error:', err);
      } finally {
        if (!tableHandled) {
          handlersRef.current.onTableFallbackRefresh?.(event);
        }
      }
    };

    const enqueueRun = () => {
      taskEventChainRef.current = taskEventChainRef.current
        .catch(() => {})
        .then(run)
        .catch((err) => console.error('Hub task event chain error:', err));
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
    if (!user?.id || !user?.isAuthenticated) return;
    try {
      const response = await fetch('/api/notifications/pending', {
        credentials: 'include',
        signal,
      });
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        notifyDeployMaintenanceIfNeeded(text);
        return;
      }
      const pending = await response.json();
      pending.forEach((dto) => offerNotification(mapPendingDto(dto)));
    } catch (err) {
      if (signal?.aborted || err?.name === 'AbortError') return;
      // NetworkError / "Load failed" — backend offline or proxy unreachable (dev)
      console.warn('Pending notifications unavailable:', err?.message ?? err);
    }
  }, [user?.id, offerNotification]);

  useEffect(() => {
    if (!enabled || !user?.id || !user?.isAuthenticated) return undefined;

    let isMounted = true;
    const abort = new AbortController();
    displayedServerIdsRef.current = new Set();
    hiddenQueueRef.current = [];

    const connection = new signalR.HubConnectionBuilder()
      .withUrl('/notificationHub', { withCredentials: true })
      .withAutomaticReconnect()
      .configureLogging(buildHubLogger(() => {
        handleMaintenanceDetected(connection);
      }))
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

    const handleCdrPreviewRetryDue = () => {
      if (!isMounted) return;
      handlersRef.current.onCdrPreviewRetryDue?.();
    };

    connection.on('NewTask', handleNewTask);
    connection.on('TaskDeleted', handleTaskDeleted);
    connection.on('TaskUpdated', handleTaskUpdated);
    connection.on('TaskStatusChanged', handleTaskStatusChanged);
    connection.on('TaskProgressChanged', handleTaskProgressChanged);
    connection.on('CdrPreviewRetryDue', handleCdrPreviewRetryDue);
    connection.on('ForceDisconnect', handleForceDisconnect);

    const startConnection = async () => {
      try {
        await connection.start();
        if (!isMounted) {
          if (connection.state !== 'Disconnected' && connection.state !== 'Disconnecting') {
            await connection.stop();
          }
          return;
        }
        await connection.invoke('JoinUserGroup', user.id).catch(() => {});
        connectionRef.current = connection;
        prevViewRef.current = null;
        await applyViewSubscription();
        await fetchPendingNotifications(abort.signal);
      } catch (err) {
        if (!isMounted) return;
        const message = err?.message ?? String(err);
        if (message.includes('stopped during negotiation')) return;
        if (isDeployMaintenanceMessage(message)) {
          await handleMaintenanceDetected(connection);
          return;
        }
        console.warn('SignalR start error:', shortenHubLogMessage(message));
        await fetchPendingNotifications(abort.signal);
      }
    };

    // Отложенный старт: в Strict Mode cleanup успевает до negotiate первого mount.
    const startTimer = setTimeout(() => {
      if (!isMounted) return;
      startConnection();
    }, 0);

    connection.onreconnected(async () => {
      if (!isMounted) return;
      await connection.invoke('JoinUserGroup', user.id).catch(() => {});
      connectionRef.current = connection;
      prevViewRef.current = null;
      await applyViewSubscription();
      await fetchPendingNotifications(abort.signal);
      flushHiddenQueue();
      handlersRef.current.onFullRefresh?.();
    });

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        flushHiddenQueue();
        fetchPendingNotifications(abort.signal);
        applyViewSubscription();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onVisibilityChange);

    return () => {
      isMounted = false;
      clearTimeout(startTimer);
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
      connection.off('CdrPreviewRetryDue', handleCdrPreviewRetryDue);
      connection.off('ForceDisconnect', handleForceDisconnect);
      connectionRef.current = null;
      prevViewRef.current = null;
      if (connection.state !== 'Disconnected' && connection.state !== 'Disconnecting') {
        connection.stop().catch((err) => console.error('SignalR stop error:', err));
      }
    };
  }, [
    enabled,
    user?.id,
    user?.isAuthenticated,
    offerNotification,
    fetchPendingNotifications,
    flushHiddenQueue,
    scheduleCalendarRefresh,
    scheduleTaskEvent,
    applyViewSubscription,
    handleMaintenanceDetected
  ]);

  const closeNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return { notifications, closeNotification };
}
