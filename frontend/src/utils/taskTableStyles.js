/** Shared table column + field styles for task rows. */

export const COL_ICON = { width: 48, minWidth: 48, maxWidth: 56, px: 0.5, whiteSpace: 'nowrap', verticalAlign: 'middle' };
export const COL_TASK = { minWidth: 140, whiteSpace: 'nowrap', verticalAlign: 'middle' };
export const COL_FILE = { minWidth: 100, whiteSpace: 'nowrap', verticalAlign: 'middle' };
export const COL_COMMENT = { minWidth: 100, maxWidth: '24ch', whiteSpace: 'normal', verticalAlign: 'middle' };
export const COL_DEADLINE = { width: '1%', whiteSpace: 'nowrap', verticalAlign: 'middle' };

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
export const COL_ACTIONS = { width: '1%', minWidth: 168, whiteSpace: 'nowrap', verticalAlign: 'middle' };

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
