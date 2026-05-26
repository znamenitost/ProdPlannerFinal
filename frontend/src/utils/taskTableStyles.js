/** Shared table column + field styles for task rows. */

/** expand + shared-task + open-file (split parent rows need all three) */
export const COL_ICON = { width: 104, minWidth: 104, maxWidth: 120, px: 0.5, whiteSpace: 'nowrap', verticalAlign: 'middle' };
export const ICON_SLOT_EXPAND = { width: 32, minWidth: 32, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' };
export const ICON_SLOT_GROUPS = { width: 22, minWidth: 22, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' };
export const ICON_SLOT_FILE = { width: 32, minWidth: 32, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' };
export const COL_TASK = { minWidth: 140, whiteSpace: 'nowrap', verticalAlign: 'middle' };
export const COL_FILE = { minWidth: 100, whiteSpace: 'nowrap', verticalAlign: 'middle' };
export const COL_COMMENT = { minWidth: 64, maxWidth: '12ch', whiteSpace: 'normal', verticalAlign: 'middle' };
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

export const TASK_TABLE_TEXT_FIELD_PROPS = {
  size: 'small',
  variant: 'outlined',
  fullWidth: true
};

export const taskTableTextFieldSx = {
  minWidth: 72,
  '& .MuiOutlinedInput-root': {
    borderRadius: 1,
    fontSize: '0.875rem',
    backgroundColor: 'background.paper'
  },
  '& .MuiOutlinedInput-input': {
    py: 0.875,
    px: 1.25
  }
};

/** Match DesktopDatePicker field to outlined TextField in table rows. */
export const taskTableDatePickerSx = {
  width: '100%',
  minWidth: 152,
  '& .MuiPickersInputBase-root': {
    borderRadius: 1,
    fontSize: '0.875rem',
    minHeight: 40,
    minWidth: 152,
    width: '100%',
    backgroundColor: 'background.paper',
    cursor: 'pointer',
    pr: 0.5
  },
  '& .MuiPickersSectionList-root': {
    py: 0.875,
    px: 0.75,
    fontSize: '0.875rem',
    flex: 1,
    minWidth: 0
  },
  '& .MuiIconButton-root': {
    p: 0.75,
    flexShrink: 0
  }
};

export const cellDisplayTextSx = {
  fontSize: '0.875rem',
  whiteSpace: 'nowrap'
};

export const CELL_TEXT_MAX_LENGTH = 23;

export function truncateText(text, max = CELL_TEXT_MAX_LENGTH) {
  if (!text) return '—';
  return text.length > max ? text.slice(0, max) + '…' : text;
}

export function needsTooltip(text, max = CELL_TEXT_MAX_LENGTH) {
  return Boolean(text) && text.length > max;
}
