import { STATUS_IN_PROGRESS, STATUS_PAUSED, SUPPLY_MODE_INTERNAL } from '../constants/taskStatuses.js';
import { normalizeCommentPreviewForDisplay } from './commentPreview.js';

export function getDayPlanCommentSnippet(comment, max = 72) {
  const text = normalizeCommentPreviewForDisplay(comment)
    .split('\n')
    .map((line) => line.trim())
    .find(Boolean);
  if (!text) return '';
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}…`;
}

export function getDayPlanFileLabel(task) {
  if (!task || task.isFuss) return '';
  if (task.fileName?.trim()) return task.fileName.trim();
  if (task.file) {
    const parts = String(task.file).replace(/\\/g, '/').split('/');
    return parts[parts.length - 1] || '';
  }
  return '';
}

export function isDayPlanTaskCurrent(task) {
  const status = String(task?.statusText || '').trim();
  return status === STATUS_IN_PROGRESS || status === STATUS_PAUSED;
}

export function shouldDimDayPlanCard({ taskId, focusedTaskId }) {
  if (focusedTaskId == null) return false;
  return taskId !== focusedTaskId;
}

export function getDayPlanDeadlineTone(deadline, now = new Date()) {
  if (!deadline) return null;
  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) return null;
  if (date.getTime() < now.getTime()) return 'overdue';
  if (date.toDateString() === now.toDateString()) return 'today';
  return 'later';
}

export function formatDayPlanDeadline(deadline) {
  if (!deadline) return '';
  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

/** Короткая подпись над карточкой: 31.08 16:00 */
export function formatDayPlanDeadlineLabel(deadline) {
  if (!deadline) return '';
  const date = new Date(deadline);
  if (Number.isNaN(date.getTime())) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${day}.${month} ${hours}:${minutes}`;
}

export function getDayPlanSplitLine(task) {
  if (!task) return '';
  const partners = Array.isArray(task.partnerNames) ? task.partnerNames.filter(Boolean) : [];
  const sequential = Number(task.supplyMode) === SUPPLY_MODE_INTERNAL && Number(task.sequenceOrder) > 0;
  if (!task.isSplitTask && partners.length === 0) return '';
  if (sequential) {
    return partners.length
      ? `Этап ${task.sequenceOrder} → ${partners.join(', ')}`
      : `Этап ${task.sequenceOrder}`;
  }
  if (partners.length) return `Вместе: ${partners.join(', ')}`;
  return task.isSplitTask ? 'Общая задача' : '';
}

export function getDayPlanSplitParentId(task) {
  const parent = Number(task?.parentRowNumber);
  if (Number.isInteger(parent) && parent > 0) return parent;
  if (task?.isSplitTask && Number(task?.id) > 0) return Number(task.id);
  return null;
}

export function getDayPlanAssigneeNames(task, viewerEmployee = '') {
  const names = [];
  const viewer = String(viewerEmployee || '').trim();
  if (viewer) names.push(viewer);
  const partners = Array.isArray(task?.partnerNames) ? task.partnerNames : [];
  for (const name of partners) {
    const trimmed = String(name || '').trim();
    if (trimmed && !names.includes(trimmed)) names.push(trimmed);
  }
  return names;
}

export function getDayPlanCommentOpenTask(task) {
  if (!task) return null;
  const commentTaskId = Number(task.commentTaskId);
  if (Number.isInteger(commentTaskId) && commentTaskId > 0 && commentTaskId !== task.id) {
    return { ...task, id: commentTaskId };
  }
  return task;
}
