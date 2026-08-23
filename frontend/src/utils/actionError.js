export const MUTATION_TIMEOUT_MS = 25_000;

export const USER_ACTION_MESSAGES = {
  offline: 'Нет соединения с интернетом. Проверьте сеть и попробуйте снова.',
  serverUnreachable: 'Сервер не отвечает. Проверьте интернет или подождите, если сервер недоступен.',
  timeout: 'Превышено время ожидания ответа сервера.',
  serverUnavailable: 'Сервер временно недоступен. Попробуйте позже.',
  serverError: 'Ошибка на сервере. Попробуйте позже.',
  createRetryHint: 'Проверьте таблицу, прежде чем сохранять снова — задача могла уже создаться.',
  deleteRetryHint: 'Проверьте таблицу: задача могла уже удалиться.',
  savingInProgress: 'Задача уже сохраняется. Дождитесь результата.',
  deletingInProgress: 'Задача уже удаляется. Дождитесь результата.',
  savingTask: 'Сохраняем задачу…',
  savingChanges: 'Сохраняем изменения…',
  deletingTask: 'Удаляем задачу…',
  taskCreated: 'Задача создана',
  taskUpdated: 'Изменения сохранены',
  taskDeleted: 'Задача удалена',
  previewProgress: 'Строим превью…',
  previewProgressAfterSave: 'Задача создана. Строим превью…',
  previewProgressAfterUpdate: 'Изменения сохранены. Строим превью…',
  previewReady: 'Превью создано',
  previewRetryScheduled: 'Файл пока не найден. Повторный поиск превью запланирован.',
  previewLoading: 'Загружаем превью…'
};

const TECHNICAL_MESSAGE_RE = /failed to fetch|networkerror|network error|load failed|fetch failed|the operation was aborted|signal is aborted|aborterror|not allowed to request resource|access control|err_internet_disconnected|err_connection|err_failed|net::/i;

export function isBrowserOffline() {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

export function isTimeoutError(err) {
  if (!err) return false;
  if (err.code === 'timeout' || err.name === 'AbortError') return true;
  return /aborted|timeout|превышено время ожидания/i.test(String(err.message || ''));
}

export function isNetworkError(err) {
  if (!err) return false;
  if (err.code === 'network' || err.code === 'timeout') return true;
  if (isTimeoutError(err)) return true;
  if (err.name === 'TypeError') return true;
  return TECHNICAL_MESSAGE_RE.test(String(err.message || ''));
}

function looksLikeHtmlOrDump(text) {
  const value = String(text || '').trim();
  if (!value) return true;
  if (value.length > 400) return true;
  return /^\s*</.test(value);
}

function appendHint(message, hint) {
  const text = String(message || '').trim();
  const extra = String(hint || '').trim();
  if (!extra) return text;
  if (text.includes(extra)) return text;
  return `${text} ${extra}`;
}

/**
 * Человекочитаемая ошибка действия: офлайн, таймаут, сервер недоступен.
 * Уже локализованный текст сервера оставляем как есть.
 */
export function formatUserActionError(err, fallback = 'Не удалось выполнить действие', options = {}) {
  const hint = options.hint;
  const offline = isBrowserOffline();

  if (offline) {
    return appendHint(USER_ACTION_MESSAGES.offline, hint);
  }

  if (isTimeoutError(err)) {
    return appendHint(USER_ACTION_MESSAGES.timeout, hint);
  }

  const status = Number(err?.status);
  if (status === 502 || status === 503 || status === 504) {
    return appendHint(USER_ACTION_MESSAGES.serverUnavailable, hint);
  }
  if (status === 500 && (!err?.message || TECHNICAL_MESSAGE_RE.test(err.message) || looksLikeHtmlOrDump(err.message))) {
    return appendHint(USER_ACTION_MESSAGES.serverError, hint);
  }

  const raw = String(err?.message || '').trim();
  const includeHint = Boolean(hint) && (
    isBrowserOffline() || isTimeoutError(err) || isNetworkError(err)
  );

  if (raw && !TECHNICAL_MESSAGE_RE.test(raw) && !looksLikeHtmlOrDump(raw)) {
    return appendHint(raw, includeHint ? hint : undefined);
  }

  if (isNetworkError(err)) {
    return appendHint(USER_ACTION_MESSAGES.serverUnreachable, hint);
  }

  return fallback;
}

export function formatHttpError(status, bodyText, fallback) {
  const text = String(bodyText || '').trim();
  if (text && !looksLikeHtmlOrDump(text) && !TECHNICAL_MESSAGE_RE.test(text)) {
    return text;
  }
  return formatUserActionError({ status, message: text }, fallback || `Ошибка ${status}`);
}

export function createTimeoutSignal(timeoutMs = MUTATION_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return {
    signal: controller.signal,
    clear() {
      clearTimeout(timer);
    }
  };
}
