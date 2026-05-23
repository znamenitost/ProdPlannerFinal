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

export function getInfoStatusResolveTarget(statusText) {
  if (statusText === STATUS_PENDING_APPROVAL || statusText === 'На согласовании') {
    return STATUS_APPROVED;
  }
  if (statusText === STATUS_NO_ITEMS) {
    return STATUS_IN_STOCK;
  }
  return null;
}

export function getInfoStatusConfirmOptions(statusText) {
  if (statusText === STATUS_PENDING_APPROVAL || statusText === 'На согласовании') {
    return {
      title: 'Согласование',
      message: 'Задача на согласовании. Задача действительно согласована?',
      confirmLabel: 'Да, согласована',
      confirmColor: 'primary'
    };
  }
  if (statusText === STATUS_NO_ITEMS) {
    return {
      title: 'Нет изделий',
      message: 'Задача без изделий. Материал действительно в наличии?',
      confirmLabel: 'Да, в наличии',
      confirmColor: 'primary'
    };
  }
  return null;
}

/** Статусы, с которых можно нажать «Начал» без подтверждения. */
export function canStartWithoutConfirm(task) {
  const text = task?.statusText;
  if (text) {
    if (isInfoStatus(text)) return false;
    return [STATUS_ASSIGNED, STATUS_APPROVED, STATUS_IN_STOCK].includes(text);
  }
  const s = task?.status;
  return s === 0 || s === 6 || s === 7;
}

const LEGACY_PENDING_APPROVAL = 'На согласовании';

/** Единый текст статуса (legacy «На согласовании» → «Согласование»). */
export function normalizeStatusText(statusText) {
  if (!statusText) return '';
  if (statusText === LEGACY_PENDING_APPROVAL) return STATUS_PENDING_APPROVAL;
  return statusText;
}

export function getTaskStatusText(task) {
  if (!task) return '';
  if (task.statusText) return normalizeStatusText(task.statusText);
  if (task.status === 4) return STATUS_PENDING_APPROVAL;
  if (task.status === 5) return STATUS_NO_ITEMS;
  return '';
}

/** Можно ли выставить инфостатус (не совпадает с текущим). */
export function canSetInfoStatus(task, targetInfoStatus) {
  const current = getTaskStatusText(task);
  const target = normalizeStatusText(targetInfoStatus);
  return current !== target;
}
