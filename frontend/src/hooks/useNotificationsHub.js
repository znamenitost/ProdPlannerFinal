import { useCallback, useEffect, useRef, useState } from 'react';
import * as signalR from '@microsoft/signalr';
import { buildViewSubscriptionState, syncHubViewGroups } from '../utils/hubViewSubscription';
import {
  isDeployMaintenanceMessage,
  notifyDeployMaintenanceIfNeeded,
  shortenHubLogMessage
} from '../utils/deployMaintenance';
import {
  browserNotificationForTask,
  isPageActive,
  showBrowserNotification
} from '../utils/browserNotification';

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

function stripCommentCountPrefix(title) {
  return String(title || '').replace(/^\+\d+\s*·\s*/, '').trim();
}

function formatCommentNotificationTitle(count, baseTitle) {
  const base = stripCommentCountPrefix(baseTitle);
  return base ? `+${count} · ${base}` : `+${count}`;
}

function mapPendingDto(dto) {
  const type = dto.type || 'NewTask';
  const rawTitle = dto.title?.trim() || (type === 'TaskCommentAdded' ? '' : 'Новая задача');
  return {
    id: `n-${dto.id}`,
    serverId: dto.id,
    type,
    taskId: dto.taskId ?? null,
    title: type === 'TaskCommentAdded'
      ? formatCommentNotificationTitle(1, rawTitle)
      : rawTitle || 'Новая задача',
    commentCount: type === 'TaskCommentAdded' ? 1 : undefined,
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

// Дефолтный withAutomaticReconnect() сдаётся через ~42 секунды — деплой
// (app_offline на минуты) гарантированно убивал подписку до перезагрузки страницы.
const RECONNECT_DELAYS_MS = [0, 2000, 5000, 10000, 30000];
const RECONNECT_SEQUENCE_WINDOW_MS = 10 * 60 * 1000;
const START_RETRY_DELAYS_MS = [2000, 5000, 15000, 30000, 60000];
const JOIN_RETRY_DELAYS_MS = [3000, 10000, 30000];
const VIEW_WATCHDOG_INTERVAL_MS = 45000;

function reconnectDelayInMs(retryContext) {
  if (retryContext.elapsedMilliseconds > RECONNECT_SEQUENCE_WINDOW_MS) return null;
  const idx = Math.min(retryContext.previousRetryCount, RECONNECT_DELAYS_MS.length - 1);
  return RECONNECT_DELAYS_MS[idx];
}

/**
 * @param {object} handlers
 * @param {(event: { type: string, taskId?: number, affectedEmployees?: string[] }) => Promise<boolean>|boolean} [handlers.onTaskEvent]
 * @param {() => void} [handlers.onTableFallbackRefresh] — полная перезагрузка таблицы, если строка не на экране
 * @param {(event?: { type: string, taskId?: number, affectedEmployees?: string[] }) => void} [handlers.onCalendarRefresh] — календарь / completed
 * @param {() => void} [handlers.onFullRefresh] — reconnect и т.п.
 * @param {() => void} [handlers.onCdrPreviewRetryDue] — повторный поиск превью .cdr
 * @param {(payload: { employeeName: string, interval: object|null }) => void} [handlers.onLunchStateChanged]
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
  const joinRetryRef = useRef({ timer: null, attempt: 0 });
  const viewSubscriptionRef = useRef(viewSubscription);
  const onMaintenanceDetectedRef = useRef(onMaintenanceDetected);
  viewSubscriptionRef.current = viewSubscription;
  onMaintenanceDetectedRef.current = onMaintenanceDetected;

  const [hubConnection, setHubConnection] = useState(null);

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
    const retry = joinRetryRef.current;
    if (retry.timer) {
      clearTimeout(retry.timer);
      retry.timer = null;
    }

    const conn = connectionRef.current;
    const vs = viewSubscriptionRef.current;
    if (!conn || conn.state !== signalR.HubConnectionState.Connected || !vs) return;

    const next = buildViewSubscriptionState(vs);
    const synced = await syncHubViewGroups(conn, prevViewRef.current, next);
    prevViewRef.current = synced;

    if (!synced.joinFailed) {
      retry.attempt = 0;
      return;
    }

    // Вступление в группу не подтверждено — повторяем с backoff, иначе
    // вкладка молча остаётся без живых обновлений до перезагрузки.
    if (retry.attempt < JOIN_RETRY_DELAYS_MS.length) {
      const delay = JOIN_RETRY_DELAYS_MS[retry.attempt];
      retry.attempt += 1;
      retry.timer = setTimeout(() => {
        retry.timer = null;
        applyViewSubscription();
      }, delay);
    }
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

      if (
        notification.type === 'TaskCommentAdded'
        && notification.taskId != null
      ) {
        const existingIndex = prev.findIndex(
          (n) => n.type === 'TaskCommentAdded' && n.taskId === notification.taskId
        );
        if (existingIndex >= 0) {
          const existing = prev[existingIndex];
          const nextCount = (existing.commentCount || 1) + (notification.commentCount || 1);
          const baseTitle = stripCommentCountPrefix(existing.title || notification.title);
          const updated = {
            ...existing,
            serverId: notification.serverId,
            commentCount: nextCount,
            title: formatCommentNotificationTitle(nextCount, baseTitle),
            deadline: notification.deadline || existing.deadline
          };
          const next = [...prev];
          next[existingIndex] = updated;
          return next;
        }
      }

      return [...prev.slice(-19), notification];
    });
    displayedServerIdsRef.current.add(notification.serverId);
    ackNotification(notification.serverId);
  }, [ackNotification]);

  const offerNotification = useCallback((notification) => {
    if (notification.serverId == null) return;
    if (displayedServerIdsRef.current.has(notification.serverId)) return;

    if (!isPageActive()) {
      const payload = browserNotificationForTask(notification);
      showBrowserNotification(payload).then((shown) => {
        if (shown) {
          // Ack so pending fetch does not re-show as snackbar later.
          displayedServerIdsRef.current.add(notification.serverId);
          ackNotification(notification.serverId);
          return;
        }
        if (!hiddenQueueRef.current.some((n) => n.serverId === notification.serverId)) {
          hiddenQueueRef.current.push(notification);
        }
      });
      return;
    }

    commitDisplay(notification);
  }, [ackNotification, commitDisplay]);

  const flushHiddenQueue = useCallback(() => {
    if (!isPageActive()) return;
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
    let intentionalStop = false;
    let startRetryTimer = null;
    let watchdogTimer = null;
    const abort = new AbortController();
    displayedServerIdsRef.current = new Set();
    hiddenQueueRef.current = [];

    const connection = new signalR.HubConnectionBuilder()
      .withUrl('/notificationHub', { withCredentials: true })
      .withAutomaticReconnect({ nextRetryDelayInMilliseconds: reconnectDelayInMs })
      .configureLogging(buildHubLogger(() => {
        intentionalStop = true;
        handleMaintenanceDetected(connection);
      }))
      .build();

    const handleNewTask = (notificationId, taskId, taskTitle, deadline, type) => {
      if (!isMounted) return;
      const args = parseNewTaskHubArgs(notificationId, taskId, taskTitle, deadline, type);
      const rawTitle =
        typeof args.taskTitle === 'string' ? args.taskTitle.trim() : String(args.taskTitle ?? '').trim();
      const notifType = args.type || 'NewTask';
      const hubTask = hubTaskId(args.taskId);
      offerNotification({
        id: `n-${args.notificationId}`,
        serverId: args.notificationId,
        type: notifType,
        taskId: hubTask,
        title: notifType === 'TaskCommentAdded'
          ? formatCommentNotificationTitle(1, rawTitle)
          : (rawTitle || 'Новая задача'),
        commentCount: notifType === 'TaskCommentAdded' ? 1 : undefined,
        deadline: formatNotificationDeadline(args.deadline),
      });
      scheduleCalendarRefresh();
      // Comment push must also refresh the table badge (+N), not only the snackbar.
      if (notifType === 'TaskCommentAdded' && hubTask != null) {
        scheduleTaskEvent({
          type: 'TaskUpdated',
          taskId: hubTask,
          affectedEmployees: [],
          commentBadgeDelta: 1,
        });
      }
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
      // Сервер вытеснил это подключение (новое подключение того же пользователя).
      // Не переподключаемся — иначе две вкладки будут вытеснять друг друга.
      intentionalStop = true;
      connection.stop().catch((err) => console.error('SignalR forced stop error:', err));
    };

    const handleCdrPreviewRetryDue = () => {
      if (!isMounted) return;
      handlersRef.current.onCdrPreviewRetryDue?.();
    };

    const handleLunchStateChanged = (employeeName, interval) => {
      if (!isMounted) return;
      handlersRef.current.onLunchStateChanged?.({
        employeeName: String(employeeName || '').trim(),
        interval: interval ?? null
      });
    };

    const handleLabelPrintStatus = (payload) => {
      if (!isMounted) return;
      handlersRef.current.onLabelPrintStatus?.(payload);
    };

    connection.on('NewTask', handleNewTask);
    connection.on('TaskDeleted', handleTaskDeleted);
    connection.on('TaskUpdated', handleTaskUpdated);
    connection.on('TaskStatusChanged', handleTaskStatusChanged);
    connection.on('TaskProgressChanged', handleTaskProgressChanged);
    connection.on('CdrPreviewRetryDue', handleCdrPreviewRetryDue);
    connection.on('LunchStateChanged', handleLunchStateChanged);
    connection.on('LabelPrintStatus', handleLabelPrintStatus);
    connection.on('ForceDisconnect', handleForceDisconnect);

    const scheduleStartRetry = (attempt) => {
      if (!isMounted || intentionalStop) return;
      if (startRetryTimer) clearTimeout(startRetryTimer);
      const delay = START_RETRY_DELAYS_MS[Math.min(attempt, START_RETRY_DELAYS_MS.length - 1)];
      startRetryTimer = setTimeout(() => {
        startRetryTimer = null;
        if (!isMounted || intentionalStop) return;
        if (connection.state !== signalR.HubConnectionState.Disconnected) return;
        startConnection(attempt + 1);
      }, delay);
    };

    const startConnection = async (attempt = 0) => {
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
        setHubConnection(connection);
        prevViewRef.current = null;
        await applyViewSubscription();
        await fetchPendingNotifications(abort.signal);
        flushHiddenQueue();
      } catch (err) {
        if (!isMounted || intentionalStop) return;
        const message = err?.message ?? String(err);
        if (message.includes('stopped during negotiation')) return;
        if (isDeployMaintenanceMessage(message)) {
          intentionalStop = true;
          await handleMaintenanceDetected(connection);
          return;
        }
        console.warn('SignalR start error:', shortenHubLogMessage(message));
        await fetchPendingNotifications(abort.signal);
        // Одна неудачная попытка раньше оставляла приложение без SignalR на всю сессию.
        scheduleStartRetry(attempt);
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
      setHubConnection(connection);
      prevViewRef.current = null;
      await applyViewSubscription();
      await fetchPendingNotifications(abort.signal);
      flushHiddenQueue();
      handlersRef.current.onFullRefresh?.();
    });

    // Авто-reconnect сдался (долгий деплой/сетевая outage) — раньше здесь всё
    // молча умирало до перезагрузки страницы. Перезапускаем start с backoff.
    connection.onclose((error) => {
      if (!isMounted || intentionalStop) return;
      if (error) {
        console.warn('SignalR closed:', shortenHubLogMessage(error.message ?? String(error)));
      }
      connectionRef.current = null;
      scheduleStartRetry(0);
    });

    // Watchdog: периодически подтверждает членство в группах вкладки —
    // страховка от тихо потерянного JoinTableViewers/JoinCalendarViewers.
    watchdogTimer = setInterval(() => {
      if (!isMounted || intentionalStop) return;
      if (connectionRef.current?.state === signalR.HubConnectionState.Connected) {
        applyViewSubscription();
      }
    }, VIEW_WATCHDOG_INTERVAL_MS);

    const onVisibilityChange = () => {
      if (isPageActive()) {
        flushHiddenQueue();
        fetchPendingNotifications(abort.signal);
        applyViewSubscription();
      }
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('focus', onVisibilityChange);

    return () => {
      isMounted = false;
      intentionalStop = true;
      clearTimeout(startTimer);
      if (startRetryTimer) {
        clearTimeout(startRetryTimer);
        startRetryTimer = null;
      }
      if (watchdogTimer) {
        clearInterval(watchdogTimer);
        watchdogTimer = null;
      }
      const joinRetry = joinRetryRef.current;
      if (joinRetry.timer) {
        clearTimeout(joinRetry.timer);
        joinRetry.timer = null;
      }
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
      connection.off('LunchStateChanged', handleLunchStateChanged);
      connection.off('LabelPrintStatus', handleLabelPrintStatus);
      connection.off('ForceDisconnect', handleForceDisconnect);
      connectionRef.current = null;
      setHubConnection(null);
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

  return { notifications, closeNotification, hubConnection };
}
