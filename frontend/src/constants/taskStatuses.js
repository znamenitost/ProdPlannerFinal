/** Тексты статусов — совпадают с TaskStatusMapper на бэкенде. */
export const STATUS_ASSIGNED = 'Назначена';
export const STATUS_IN_PROGRESS = 'Начал';
/** Подпись кнопки возобновления (не статус в БД). */
export const ACTION_RESUME = 'Продолжить';
export const STATUS_PAUSED = 'Пауза';
export const STATUS_COMPLETED = 'Готово';
/** Выдан клиенту (JobStatus остаётся Completed, PickedUpAt на бэкенде). */
export const STATUS_PICKED_UP = 'Выдан';
export const STATUS_PENDING_APPROVAL = 'Согласование';
export const STATUS_NO_ITEMS = 'Нет изделий';
export const STATUS_APPROVED = 'Согласовано';
export const STATUS_IN_STOCK = 'В наличии';
export const STATUS_WAITING = 'Ожидание';

/** Фазы одиночной задачи «через тест» (TaskWorkPhase на бэкенде). */
export const WORK_PHASE_TEST = 1;
export const WORK_PHASE_AWAITING_APPROVAL = 2;
export const WORK_PHASE_PRODUCTION = 3;
export const WORK_PHASE_DONE = 4;

/** Режимы выполнения многоэтапной задачи (совпадают с SupplyMode на бэкенде). */
export const SUPPLY_MODE_NONE = 0;
export const SUPPLY_MODE_INTERNAL = 1;
export const SUPPLY_MODE_COOPERATIVE = 2;

export const TASK_EXECUTION_PARALLEL = 'parallel';
export const TASK_EXECUTION_SEQUENTIAL = 'sequential';

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

/** Чип статуса в активных задачах: инфостатусы, их решения и блокировка этапа. */
export function shouldShowActiveTaskStatusChip(task, statusText) {
  const text = normalizeStatusText(statusText);
  if (isInfoStatus(text)) return true;
  if (text === STATUS_APPROVED || text === STATUS_IN_STOCK) return true;
  return isSequenceBlocked(task, text) || task?.status === 8;
}

export function isPendingApprovalCalendar(statusText) {
  return statusText === STATUS_PENDING_APPROVAL || statusText === 'На согласовании';
}

export function needsAdminResolution(statusText) {
  return isInfoStatus(statusText);
}

export function getInfoStatusResolveTarget(statusText) {
  const text = normalizeStatusText(statusText);
  if (text === STATUS_PENDING_APPROVAL) {
    return STATUS_APPROVED;
  }
  if (text === STATUS_NO_ITEMS) {
    return STATUS_IN_STOCK;
  }
  return null;
}

export function getInfoStatusConfirmOptions(statusText) {
  const text = normalizeStatusText(statusText);
  if (text === STATUS_PENDING_APPROVAL) {
    return {
      title: 'Согласование',
      message: 'Задача на согласовании. Подтвердите, что задача согласована, и действие можно выполнить.',
      confirmLabel: 'Подтвердить и выполнить',
      confirmColor: 'primary'
    };
  }
  if (text === STATUS_NO_ITEMS) {
    return {
      title: 'Нет изделий',
      message: 'Для задачи нет изделий. Подтвердите, что материалы в наличии, и действие можно выполнить.',
      confirmLabel: 'Подтвердить и выполнить',
      confirmColor: 'primary'
    };
  }
  return null;
}

/**
 * Пункты меню инфостатусов:
 * — в «Согласование» / «Нет изделий» показываем «Согласовано» / «В наличии»;
 * — иначе — установку «Согласование» и «Нет изделий».
 */
export function getInfoMenuItems(statusText) {
  const text = normalizeStatusText(statusText);
  if (text === STATUS_PENDING_APPROVAL) {
    return [{ label: STATUS_APPROVED, statusText: STATUS_APPROVED, kind: 'approved' }];
  }
  if (text === STATUS_NO_ITEMS) {
    return [{ label: STATUS_IN_STOCK, statusText: STATUS_IN_STOCK, kind: 'inStock' }];
  }
  return [
    { label: STATUS_PENDING_APPROVAL, statusText: STATUS_PENDING_APPROVAL, kind: 'pending' },
    { label: STATUS_NO_ITEMS, statusText: STATUS_NO_ITEMS, kind: 'noItems' }
  ];
}

/** Статусы, с которых можно нажать «Начал» без подтверждения. */
export function canStartWithoutConfirm(task) {
  const text = task?.statusText;
  if (text) {
    if (isInfoStatus(text)) return false;
    if (text === STATUS_WAITING || task?.sequenceStartBlocked) return false;
    return [STATUS_ASSIGNED, STATUS_APPROVED, STATUS_IN_STOCK].includes(text);
  }
  if (task?.status === 8 || task?.sequenceStartBlocked) return false;
  if (task?.workPhase === WORK_PHASE_AWAITING_APPROVAL) return false;
  const s = task?.status;
  return s === 0 || s === 6 || s === 7;
}

export function isSequenceBlocked(task, statusText) {
  const text = statusText || task?.statusText || '';
  return text === STATUS_WAITING || Boolean(task?.sequenceStartBlocked);
}

const LEGACY_PENDING_APPROVAL = 'На согласовании';

/** Единый текст статуса (legacy «На согласовании» → «Согласование»). */
export function normalizeStatusText(statusText) {
  if (!statusText) return '';
  if (statusText === LEGACY_PENDING_APPROVAL) return STATUS_PENDING_APPROVAL;
  return statusText;
}

/** Готово или уже выдан клиенту — терминальные для UI таблицы. */
export function isFinishedStatusText(statusText) {
  const text = normalizeStatusText(statusText);
  return text === STATUS_COMPLETED || text === STATUS_PICKED_UP;
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
