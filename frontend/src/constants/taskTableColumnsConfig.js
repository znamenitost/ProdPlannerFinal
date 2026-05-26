/** Toggleable task table columns (icons + actions are always shown). */
export const TASK_TABLE_COLUMN_STORAGE_PREFIX = 'taskTable.columnVisibility.v1';

export function getColumnStorageKey(currentUser) {
  if (!currentUser) return `${TASK_TABLE_COLUMN_STORAGE_PREFIX}.admin`;
  if (currentUser.role === 'Admin') return `${TASK_TABLE_COLUMN_STORAGE_PREFIX}.admin`;
  return `${TASK_TABLE_COLUMN_STORAGE_PREFIX}.${currentUser.fullName}`;
}

export const TASK_TABLE_DEFAULT_COLUMN_VISIBILITY = {
  task: true,
  file: true,
  comment: true,
  deadline: true,
  hours: true,
  type: true,
  employee: true,
  status: true
};

export const TASK_TABLE_DEFAULT_TEXT_LIMIT = 23;
export const TASK_TABLE_TEXT_LIMIT_MIN = 10;
export const TASK_TABLE_TEXT_LIMIT_MAX = 60;

export const TASK_TABLE_TOGGLEABLE_COLUMNS = [
  { id: 'task', label: 'Задача' },
  { id: 'file', label: 'Файл' },
  { id: 'comment', label: 'Комментарий' },
  { id: 'deadline', label: 'Дедлайн' },
  { id: 'hours', label: 'Часы' },
  { id: 'type', label: 'Тип' },
  { id: 'employee', label: 'Сотрудник' },
  { id: 'status', label: 'Статус' }
];
