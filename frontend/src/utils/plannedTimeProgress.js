import { STATUS_COMPLETED } from '../constants/taskStatuses';

function parseDate(value) {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function hasWorkStarted(task) {
  if (task.workIntervals?.length > 0) return true;
  const text = task.statusText || '';
  if (text === STATUS_COMPLETED || text === 'Готово') return true;
  return text === 'Начал' || text === 'Пауза';
}

export function getElapsedWorkHours(task, now = new Date()) {
  const intervals = task.workIntervals || [];
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
  const estimate = Number(task.estimateHours);
  if (!estimate || estimate <= 0) return 0;
  if (task.statusText === STATUS_COMPLETED || task.statusText === 'Готово') return 100;
  if (!hasWorkStarted(task)) return 0;

  const elapsed = getElapsedWorkHours(task, now);
  return Math.min(100, Math.round((elapsed / estimate) * 100));
}

export function shouldShowPlannedTimeBar(task) {
  if (task.showPlannedTimeProgress === false) return false;
  if (task.showPlannedTimeProgress === true) return true;
  const estimate = Number(task.estimateHours);
  if (!estimate || estimate <= 0) return false;
  return hasWorkStarted(task);
}
