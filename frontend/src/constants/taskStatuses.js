/** Тексты статусов — совпадают с TaskStatusMapper на бэкенде. */
export const STATUS_ASSIGNED = 'Назначена';
export const STATUS_IN_PROGRESS = 'Начал';
export const STATUS_PAUSED = 'Пауза';
export const STATUS_COMPLETED = 'Готово';
export const STATUS_PENDING_APPROVAL = 'Согласование';
export const STATUS_NO_ITEMS = 'Нет изделий';
export const STATUS_APPROVED = 'Согласовано';
export const STATUS_IN_STOCK = 'В наличии';

/** Для списка выполненных (enum Completed). */
export const STATUS_FINISHED_LABEL = 'Завершена';

export const INFO_STATUSES = [STATUS_PENDING_APPROVAL, STATUS_NO_ITEMS];

export const WORKFLOW_STATUSES = [
  STATUS_ASSIGNED,
  STATUS_IN_PROGRESS,
  STATUS_PAUSED,
  STATUS_COMPLETED
];

export function isInfoStatus(statusText) {
  if (!statusText) return false;
  if (INFO_STATUSES.includes(statusText)) return true;
  return statusText === 'На согласовании';
}

export function isPendingApprovalCalendar(statusText) {
  return statusText === STATUS_PENDING_APPROVAL || statusText === 'На согласовании';
}

export function needsAdminResolution(statusText) {
  return isInfoStatus(statusText);
}
