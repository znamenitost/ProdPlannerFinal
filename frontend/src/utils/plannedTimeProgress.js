import { STATUS_COMPLETED } from '../constants/taskStatuses';
import { getWorkHoursBetween } from './workHours';

export function getTaskPlannedFields(task) {
  if (!task) return {};
  const status = task.status ?? task.Status;
  return {
    ...task,
    status,
    statusText: task.statusText ?? task.StatusText ?? '',
    estimateHours: task.estimateHours ?? task.EstimateHours,
    workIntervals: task.workIntervals ?? task.WorkIntervals ?? [],
    plannedTimeProgress: task.plannedTimeProgress ?? task.PlannedTimeProgress
  };
}

function parseDate(value) {
  if (value == null) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function getIntervalStart(interval) {
  return interval?.startTime ?? interval?.StartTime ?? null;
}

function getIntervalEnd(interval) {
  const v = interval?.endTime ?? interval?.EndTime;
  return v == null || v === '' ? null : v;
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
  let total = 0;

  for (const interval of intervals) {
    const start = parseDate(getIntervalStart(interval));
    if (!start) continue;
    const endRaw = getIntervalEnd(interval);
    const end = endRaw ? parseDate(endRaw) : now;
    if (!end) continue;
    total += getWorkHoursBetween(start, end);
  }

  return total;
}

export function getPlannedTimeProgress(task, now = new Date()) {
  const t = getTaskPlannedFields(task);
  const estimate = Number(t.estimateHours);
  if (!estimate || estimate <= 0) return 0;
  if (t.statusText === STATUS_COMPLETED || t.statusText === 'Готово') return 100;
  if (!hasWorkStarted(t)) return 0;

  const elapsed = getElapsedWorkHours(t, now);
  if (elapsed > 0) {
    return Math.min(100, Math.round((elapsed / estimate) * 100));
  }

  const server = Number(t.plannedTimeProgress);
  if (Number.isFinite(server) && server > 0) return Math.min(100, server);

  return 0;
}

export function shouldShowPlannedTimeBar(task) {
  const t = getTaskPlannedFields(task);
  const estimate = Number(t.estimateHours);
  if (!estimate || estimate <= 0) return false;
  return hasWorkStarted(t);
}
