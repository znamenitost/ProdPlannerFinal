/** Shared table column + field styles for task rows. */
import { tableTextFieldThemeStyles } from '../theme/componentVariants';

/** expand + shared-task + open-file (split parent rows need all three) */
export const COL_ICON = { width: 104, minWidth: 104, maxWidth: 120, px: 0.5, whiteSpace: 'nowrap', verticalAlign: 'middle' };
export const ICON_SLOT_EXPAND = { width: 32, minWidth: 32, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' };
export const ICON_SLOT_GROUPS = { width: 22, minWidth: 22, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' };
export const ICON_SLOT_FILE = { width: 32, minWidth: 32, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' };
export const TEXT_LIMIT_COLUMN_WIDTH = 'var(--task-table-text-limit-width, 23ch)';
export const COL_TASK = { minWidth: 140, width: TEXT_LIMIT_COLUMN_WIDTH, maxWidth: TEXT_LIMIT_COLUMN_WIDTH, whiteSpace: 'nowrap', verticalAlign: 'middle' };
export const COL_FILE = { minWidth: 100, width: TEXT_LIMIT_COLUMN_WIDTH, maxWidth: TEXT_LIMIT_COLUMN_WIDTH, whiteSpace: 'nowrap', verticalAlign: 'middle' };
export const COL_COMMENT = { minWidth: 64, width: TEXT_LIMIT_COLUMN_WIDTH, maxWidth: TEXT_LIMIT_COLUMN_WIDTH, whiteSpace: 'normal', verticalAlign: 'middle' };
export const COL_DEADLINE = { width: '1%', minWidth: 72, maxWidth: 88, whiteSpace: 'nowrap', verticalAlign: 'middle' };

/** Дедлайн в строке создания/редактирования: дата DD.MM.YYYY + кнопка календаря */
export const COL_DEADLINE_INPUT = {
  width: 168,
  minWidth: 168,
  maxWidth: 200,
  whiteSpace: 'nowrap',
  verticalAlign: 'middle',
  px: 0.5
};
export const COL_COMPACT = { width: '1%', whiteSpace: 'nowrap', verticalAlign: 'middle' };
export const COL_EMPLOYEE = { width: '1%', whiteSpace: 'nowrap', verticalAlign: 'middle' };
export const COL_STATUS = { width: '1%', whiteSpace: 'nowrap', verticalAlign: 'middle' };
export const COL_ACTIONS = {
  width: 40,
  minWidth: 40,
  maxWidth: 40,
  whiteSpace: 'nowrap',
  verticalAlign: 'middle',
  px: 0.25,
  py: 0.5,
  boxSizing: 'border-box',
  overflow: 'hidden',
  textAlign: 'center',
  position: 'sticky',
  right: 0,
  bgcolor: 'background.paper',
  zIndex: 1
};

/** MUI 9 TextField supports only outlined | filled | standard; custom variant crashes on mount. */
export const TASK_TABLE_TEXT_FIELD_PROPS = {
  size: 'small',
  variant: 'outlined',
  fullWidth: true,
  sx: tableTextFieldThemeStyles
};

export const cellDisplayTextSx = {
  fontSize: '0.875rem',
  whiteSpace: 'nowrap',
  maxWidth: TEXT_LIMIT_COLUMN_WIDTH,
  overflow: 'hidden',
  textOverflow: 'ellipsis'
};

export const CELL_TEXT_MAX_LENGTH = 23;

export function truncateText(text, max = CELL_TEXT_MAX_LENGTH) {
  if (!text) return '—';
  return text.length > max ? text.slice(0, max) + '…' : text;
}

export function needsTooltip(text, max = CELL_TEXT_MAX_LENGTH) {
  return Boolean(text) && text.length > max;
}
