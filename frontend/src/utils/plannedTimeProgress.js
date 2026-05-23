import { STATUS_COMPLETED } from '../constants/taskStatuses';

/** PascalCase / camelCase из API. */
export function getTaskPlannedFields(task) {
  if (!task) return {};
  const status = task.status ?? task.Status;
  return {
    ...task,
    status,
    statusText: task.statusText ?? task.StatusText ?? '',
    estimateHours: task.estimateHours ?? task.EstimateHours,
    workIntervals: task.workIntervals ?? task.WorkIntervals ?? []
  };
}

function parseDate(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function hasWorkStarted(task) {
  const t = getTaskPlannedFields(task);
  if (t.workIntervals?.length > 0) return true;

  const text = t.statusText || '';
  if (text === STATUS_COMPLETED || text === 'Готово') return true;
  if (text === 'Начал' || text === 'Пауза') return true;

  const status = t.status;
  if (status === 1 || status === 'InProgress') return true;
  if (status === 2 || status === 'Paused') return true;
  if (status === 3 || status === 'Completed') return true;

  return false;
}

export function getElapsedWorkHours(task, now = new Date()) {
  const intervals = getTaskPlannedFields(task).workIntervals || [];
  let totalMs = 0;
  for (const interval of intervals) {
    const start = parseDate(interval.startTime);
    if (!start) continue;
    const end = interval.endTime ? parseDate(interval.endTime) : now;
    if (!end || end <= start) continue;
    totalMs += end - start;
  }
  return totalMs / (1000 * 60 * 60);
}

/** Плановый %: отработано / выделено (0–100). */
export function getPlannedTimeProgress(task, now = new Date()) {
  const t = getTaskPlannedFields(task);
  const estimate = Number(t.estimateHours);
  if (!estimate || estimate <= 0) return 0;
  if (t.statusText === STATUS_COMPLETED || t.statusText === 'Готово') return 100;
  if (!hasWorkStarted(t)) return 0;

  const elapsed = getElapsedWorkHours(t, now);
  return Math.min(100, Math.round((elapsed / estimate) * 100));
}

export function shouldShowPlannedTimeBar(task) {
  const t = getTaskPlannedFields(task);
  const estimate = Number(t.estimateHours);
  if (!estimate || estimate <= 0) return false;
  return hasWorkStarted(t);
}
