//const API_BASE = 'http://localhost:5234/api';  // Раскомментировать если нужно явно указать порт
const API_BASE = '/api';

// Получить активные задачи сотрудника
export async function getActiveTasks(employee) {
  const res = await fetch(`${API_BASE}/tasks/active?employee=${encodeURIComponent(employee)}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!res.ok) throw new Error('Ошибка загрузки активных задач');
  return res.json();
}

// Получить календарь на неделю (передаём дату понедельника в формате YYYY-MM-DD)
export async function getWeekCalendar(employee, startDate) {
  let url = `${API_BASE}/calendar/week?employee=${encodeURIComponent(employee)}`;
  if (startDate) {
    const year = startDate.getFullYear();
    const month = String(startDate.getMonth() + 1).padStart(2, '0');
    const day = String(startDate.getDate()).padStart(2, '0');
    url += `&startDate=${year}-${month}-${day}`;
  }
  const res = await fetch(url, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!res.ok) throw new Error('Ошибка загрузки календаря');
  return res.json();
}

// Получить список выполненных задач и статистику
export async function getCompletedTasks(employee) {
  const res = await fetch(`${API_BASE}/tasks/completed?employee=${encodeURIComponent(employee)}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!res.ok) throw new Error('Ошибка загрузки выполненных задач');
  return res.json();
}

// Действия над задачами
export async function startTask(id) {
  const res = await fetch(`${API_BASE}/tasks/${id}/start`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!res.ok) throw new Error('Ошибка запуска задачи');
}

export async function pauseTask(id) {
  const res = await fetch(`${API_BASE}/tasks/${id}/pause`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!res.ok) throw new Error('Ошибка паузы задачи');
}

export async function resumeTask(id) {
  const res = await fetch(`${API_BASE}/tasks/${id}/resume`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' }
  });
  if (!res.ok) throw new Error('Ошибка возобновления задачи');
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
  if (!res.ok) throw new Error('Ошибка завершения задачи');
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