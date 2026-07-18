/**
 * True when the app window is visible and focused — in-app snackbars only.
 * Otherwise prefer a native browser notification.
 */
export function isPageActive() {
  if (typeof document === 'undefined') return true;
  return document.visibilityState === 'visible' && document.hasFocus();
}

/**
 * Shows an OS/browser notification via the service worker when permission is granted.
 * @returns {Promise<boolean>} true if a native notification was shown
 */
export async function showBrowserNotification({
  title,
  body = '',
  tag = 'notification',
  url = '/'
} = {}) {
  if (typeof window === 'undefined' || !('Notification' in window)) return false;
  if (Notification.permission !== 'granted') return false;

  const options = {
    body: body || '',
    icon: '/favicon.svg',
    badge: '/favicon.svg',
    vibrate: [200, 100, 200],
    tag,
    renotify: true,
    data: { url: url || '/' }
  };

  try {
    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification(title || 'Уведомление', options);
      return true;
    }

    const notification = new Notification(title || 'Уведомление', options);
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
    return true;
  } catch (err) {
    console.warn('Browser notification failed:', err?.message ?? err);
    return false;
  }
}

export function browserNotificationForTask(notification) {
  if (!notification) return null;
  const taskId = notification.taskId;
  const type = notification.type || 'NewTask';

  if (type === 'TaskCommentAdded') {
    return {
      title: notification.title || 'Комментарий',
      body: 'В комментарии к задаче появилась запись',
      tag: taskId != null ? `comment-${taskId}` : 'comment',
      url: '/'
    };
  }

  const chipByType = {
    NewTask: 'Новая задача',
    TaskApprovedReady: 'Согласовано',
    TaskInStockReady: 'В наличии',
    TaskReadyToStart: 'Можно начинать',
    SequentialStageReady: 'Этап доступен'
  };

  return {
    title: notification.title || chipByType[type] || 'Задача',
    body: notification.deadline ? `Дедлайн: ${notification.deadline}` : '',
    tag: taskId != null ? `task-${type}-${taskId}` : `task-${type}`,
    url: '/'
  };
}

export function browserNotificationForChat(toast) {
  if (!toast) return null;
  const conversationId = toast.conversationId;
  return {
    title: toast.title || 'Сообщение',
    body: toast.body || 'Новое сообщение',
    tag: conversationId ? `chat-${conversationId}` : 'chat-message',
    url: conversationId ? `/?chat=${conversationId}` : '/'
  };
}
