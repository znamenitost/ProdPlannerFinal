import { notifyDeployMaintenanceIfNeeded } from '../utils/deployMaintenance';

//const API_BASE = 'http://localhost:5234/api';  // Раскомментировать если нужно явно указать порт
const API_BASE = '/api';

async function failResponse(res, fallbackMessage) {
  const text = await res.text();
  if (notifyDeployMaintenanceIfNeeded(text)) {
    throw new Error('Приложение обновляется');
  }
  let message = fallbackMessage;
  try {
    const body = JSON.parse(text);
    if (body?.error) message = body.error;
    else if (body?.message) message = body.message;
  } catch {
    if (text && text.length < 500) message = text;
  }
  const err = new Error(message);
  if (res.status === 409) err.code = 'concurrency_conflict';
  throw err;
}

async function throwIfNotOk(res, fallbackMessage) {
  if (res.ok) return;
  await failResponse(res, fallbackMessage);
}

async function ensureOk(res, fallbackMessage) {
  if (res.ok) return;
  await failResponse(res, fallbackMessage);
}

// Число активных незаблокированных задач по сотрудникам (авто-выбор в модалке назначений)
export async function getAssignmentLoad(employees, options = {}) {
  const list = Array.isArray(employees) ? employees.join(',') : employees;
  const res = await fetch(
    `${API_BASE}/tasks/assignment-load?employees=${encodeURIComponent(list)}`,
    {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      signal: options.signal
    }
  );
  await throwIfNotOk(res, 'Ошибка загрузки загрузки сотрудников');
  return res.json();
}

// Получить активные задачи сотрудника
export async function getActiveTasks(employee, options = {}) {
  const res = await fetch(`${API_BASE}/tasks/active?employee=${encodeURIComponent(employee)}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    signal: options.signal
  });
  await ensureOk(res, 'Ошибка загрузки активных задач');
  return res.json();
}

// Получить календарь на неделю (передаём дату понедельника в формате YYYY-MM-DD)
export async function getWeekCalendar(employee, startDate, options = {}) {
  let url = `${API_BASE}/calendar/week?employee=${encodeURIComponent(employee)}`;
  if (startDate) {
    const year = startDate.getFullYear();
    const month = String(startDate.getMonth() + 1).padStart(2, '0');
    const day = String(startDate.getDate()).padStart(2, '0');
    url += `&startDate=${year}-${month}-${day}`;
  }
  const res = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    signal: options.signal
  });
  await ensureOk(res, 'Ошибка загрузки календаря');
  return res.json();
}

// Получить список выполненных задач (пагинация) и агрегированную статистику
export async function getCompletedTasks(employee, page = 1, pageSize = 25, statsPeriod = 'week', options = {}) {
  const params = new URLSearchParams({
    employee,
    page: String(page),
    pageSize: String(pageSize),
    statsPeriod
  });
  const res = await fetch(`${API_BASE}/tasks/completed?${params}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    signal: options.signal
  });
  await ensureOk(res, 'Ошибка загрузки выполненных задач');
  return res.json();
}

// Отчёт за день по интервалам работы (date: YYYY-MM-DD, по умолчанию — сегодня)
export async function getDailyReport(employee, options = {}) {
  const params = new URLSearchParams({ employee });
  if (options.date) params.set('date', options.date);
  const res = await fetch(`${API_BASE}/tasks/daily-report?${params}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    signal: options.signal
  });
  await ensureOk(res, 'Ошибка загрузки отчёта за день');
  return res.json();
}

// Действия над задачами
async function throwApiError(res, fallback) {
  await failResponse(res, fallback);
}

export async function startTask(id) {
  const res = await fetch(`${API_BASE}/tasks/${id}/start`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!res.ok) await throwApiError(res, 'Ошибка запуска задачи');
}

export async function pauseTask(id) {
  const res = await fetch(`${API_BASE}/tasks/${id}/pause`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!res.ok) await throwApiError(res, 'Ошибка паузы задачи');
}

export async function resumeTask(id) {
  const res = await fetch(`${API_BASE}/tasks/${id}/resume`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!res.ok) await throwApiError(res, 'Ошибка возобновления задачи');
}

export async function setProgress(id, progress) {
  const res = await fetch(`${API_BASE}/tasks/${id}/progress`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(progress)
  });
  if (!res.ok) throw new Error('Ошибка обновления прогресса');
}

export async function completeTask(id) {
  const res = await fetch(`${API_BASE}/tasks/${id}/complete`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!res.ok) await throwApiError(res, 'Ошибка завершения задачи');
}

export function buildTaskUpdatePayload(task, employeeName, statusText, extra) {
  return {
    folderPath: task.folderPath ?? '',
    fileName: task.fileName ?? '',
    comment: task.comment ?? '',
    deadline: task.deadline,
    estimateHours: task.estimateHours ?? 0,
    type: task.type ?? '',
    employeeName: task.employeeName ?? employeeName ?? '',
    parentRowNumber: task.parentRowNumber ?? null,
    statusText: statusText ?? task.statusText,
    priorityMarked: extra?.priorityMarked ?? task.isPriorityMarked ?? null,
    sequenceOverride: extra?.sequenceOverride ?? false,
    expectedUpdatedAt: task.updatedAt ?? null,
    commentEditedViaDialog: extra?.commentEditedViaDialog ?? null
  };
}

/** Обновление строки задачи (в т.ч. инфостатусы «Согласование», «Нет изделий»). */
export async function updateTaskRow(id, rowData) {
  const res = await fetch(`${API_BASE}/tasks/table/row/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      folderPath: rowData.folderPath ?? '',
      fileName: rowData.fileName ?? '',
      comment: rowData.comment ?? '',
      deadline: rowData.deadline,
      estimateHours: rowData.estimateHours,
      type: rowData.type ?? '',
      employeeName: rowData.employeeName,
      parentRowNumber: rowData.parentRowNumber,
      statusText: rowData.statusText,
      priorityMarked: rowData.priorityMarked ?? null,
      sequenceOverride: rowData.sequenceOverride ?? false,
      expectedUpdatedAt: rowData.expectedUpdatedAt ?? null,
      commentEditedViaDialog: rowData.commentEditedViaDialog ?? null
    })
  });
  if (!res.ok) await throwApiError(res, 'Не удалось обновить задачу');
  const contentType = res.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return res.json();
  }
  return null;
}

export async function returnTask(id) {
  const res = await fetch(`${API_BASE}/tasks/${id}/return`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!res.ok) throw new Error('Ошибка возврата задачи');
}

// Синхронизация и перенос
export async function syncTasks() {
  const res = await fetch(`${API_BASE}/tasks/sync`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!res.ok) throw new Error('Ошибка синхронизации');
}

export async function shiftTasks(employee) {
  const res = await fetch(`${API_BASE}/tasks/shift?employee=${encodeURIComponent(employee)}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!res.ok) throw new Error('Ошибка переноса задач');
}

// Разделение задачи
export async function splitTask(parentTaskId, parts) {
  const res = await fetch(`${API_BASE}/tasks/split`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      parentTaskId: parentTaskId,
      parts: parts.map(p => ({
        employeeName: p.employeeName,
        taskType: p.taskType || p.type,
        allocatedHours: p.hours
      }))
    })
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.message || 'Ошибка разделения задачи');
  }
  return res.json();
}

export async function getDeadlineRisks(employee, options = {}) {
  const res = await fetch(
    `${API_BASE}/tasks/deadline-risks?employee=${encodeURIComponent(employee)}`,
    {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      signal: options.signal
    }
  );
  await ensureOk(res, 'Ошибка загрузки предупреждений по дедлайнам');
  const data = await res.json();
  return Array.isArray(data) ? data.filter((r) => r.riskLevel !== 'ok') : [];
}

export async function getQueueOverloads(employee, options = {}) {
  const res = await fetch(
    `${API_BASE}/tasks/queue-overloads?employee=${encodeURIComponent(employee)}`,
    {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      signal: options.signal
    }
  );
  await ensureOk(res, 'Ошибка загрузки перегруза очереди');
  return res.json();
}

export async function getCurrentLunch(employee, options = {}) {
  const res = await fetch(`${API_BASE}/lunch/current?employee=${encodeURIComponent(employee)}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    signal: options.signal
  });
  await throwIfNotOk(res, 'Ошибка загрузки обеда');
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export async function startLunch(employee) {
  const res = await fetch(`${API_BASE}/lunch/start?employee=${encodeURIComponent(employee)}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' }
  });
  await throwIfNotOk(res, 'Не удалось начать обед');
  return res.json();
}

export async function endLunch(employee) {
  const res = await fetch(`${API_BASE}/lunch/end?employee=${encodeURIComponent(employee)}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' }
  });
  await throwIfNotOk(res, 'Не удалось завершить обед');
}

export async function prepareDeploy() {
  const res = await fetch(`${API_BASE}/deploy/prepare`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' }
  });
  await throwIfNotOk(res, 'Не удалось включить режим обновления');
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export async function getChatContacts(options = {}) {
  const res = await fetch(`${API_BASE}/chat/contacts`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    signal: options.signal
  });
  await throwIfNotOk(res, 'Ошибка загрузки контактов');
  return res.json();
}

export async function getChatConversations(options = {}) {
  const res = await fetch(`${API_BASE}/chat/conversations`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    signal: options.signal
  });
  await throwIfNotOk(res, 'Ошибка загрузки диалогов');
  return res.json();
}

export async function openDirectChat(userId) {
  const res = await fetch(`${API_BASE}/chat/conversations/direct`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId })
  });
  await throwIfNotOk(res, 'Не удалось открыть личный чат');
  return res.json();
}

export async function getChatMessages(conversationId, { beforeId, take = 50, signal } = {}) {
  const params = new URLSearchParams({ take: String(take) });
  if (beforeId) params.set('beforeId', String(beforeId));
  const res = await fetch(`${API_BASE}/chat/conversations/${conversationId}/messages?${params}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    signal
  });
  await throwIfNotOk(res, 'Ошибка загрузки сообщений');
  return res.json();
}

export async function sendChatMessage(conversationId, text, files = []) {
  const hasFiles = Array.isArray(files) && files.length > 0;
  if (hasFiles) {
    const form = new FormData();
    if (text) form.append('text', text);
    for (const file of files) form.append('files', file);
    const res = await fetch(`${API_BASE}/chat/conversations/${conversationId}/messages`, {
      method: 'POST',
      credentials: 'include',
      body: form
    });
    await throwIfNotOk(res, 'Не удалось отправить сообщение');
    return res.json();
  }

  const res = await fetch(`${API_BASE}/chat/conversations/${conversationId}/messages`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: text ?? '' })
  });
  await throwIfNotOk(res, 'Не удалось отправить сообщение');
  return res.json();
}

export async function markChatRead(conversationId, lastMessageId) {
  const res = await fetch(`${API_BASE}/chat/conversations/${conversationId}/read`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ lastMessageId })
  });
  await throwIfNotOk(res, 'Не удалось отметить прочтение');
}

export async function getPushConfig() {
  const res = await fetch(`${API_BASE}/push/config`, { credentials: 'include' });
  await throwIfNotOk(res, 'Не удалось получить настройки push');
  return res.json();
}

export async function subscribePush({ endpoint, p256dh, auth }) {
  const res = await fetch(`${API_BASE}/push/subscribe`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint, p256dh, auth })
  });
  await throwIfNotOk(res, 'Не удалось подписаться на push');
}

export async function unsubscribePush({ endpoint }) {
  const res = await fetch(`${API_BASE}/push/unsubscribe`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint })
  });
  await throwIfNotOk(res, 'Не удалось отписаться от push');
}

// Эндпоинты dev-панели (роль Admin). Мок-время и интервалы — на проде тоже.
async function debugFetch(url, init = {}) {
  const res = await fetch(`${API_BASE}/debug${url}`, {
    credentials: 'include',
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) }
  });
  await throwIfNotOk(res, 'Ошибка debug-операции');
  // get-intervals возвращает массив, get-time/set-time/etc — объект; reset-time/close-interval — пусто.
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

export const debugApi = {
  getLogs: ({ warning = true, error = true, tail = 500 } = {}) => {
    const params = new URLSearchParams({
      warning: String(warning),
      error: String(error),
      tail: String(tail)
    });
    return debugFetch(`/logs?${params}`);
  },
  getConnections: () => debugFetch('/connections'),
  getDatabaseIntegrity: () => debugFetch('/db-integrity'),
  setMockTime: (mockDateTime) =>
    debugFetch('/set-time', { method: 'POST', body: JSON.stringify({ mockDateTime }) }),
  resetMockTime: () => debugFetch('/reset-time', { method: 'POST' }),
  closeInterval: (taskId) => debugFetch(`/close-interval/${taskId}`, { method: 'POST' }),
  createInterval: (taskId) => debugFetch(`/create-interval/${taskId}`, { method: 'POST' }),
  recalculateStatistics: () => debugFetch('/recalculate-statistics', { method: 'POST' }),
  resetDatabase: (password) =>
    debugFetch('/reset-db', {
      method: 'POST',
      headers: { 'X-Reset-Db-Password': password?.trim?.() ?? '' },
      body: JSON.stringify({ password: password?.trim?.() ?? '' })
    }),
  verifyResetDatabasePassword: (password) =>
    debugFetch('/verify-reset-db-password', {
      method: 'POST',
      headers: { 'X-Reset-Db-Password': password?.trim?.() ?? '' },
      body: JSON.stringify({ password: password?.trim?.() ?? '' })
    })
};