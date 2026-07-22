export const COLLAPSED_COLUMN_SX = {
  display: 'none',
  width: 0,
  minWidth: 0,
  maxWidth: 0,
  p: 0,
  border: 0,
  overflow: 'hidden'
};

/** @param {Record<string, boolean>} visibility */
export function isTaskTableColumnVisible(columnId, visibility, showHoursTypeColumns) {
  if (columnId === 'icons' || columnId === 'actions') return true;
  if (!visibility?.[columnId]) return false;
  if (columnId === 'hours' || columnId === 'type') return Boolean(showHoursTypeColumns);
  return true;
}

/** @param {Record<string, boolean>} visibility */
export function columnCellSx(columnId, visibility, showHoursTypeColumns, baseSx = {}) {
  return isTaskTableColumnVisible(columnId, visibility, showHoursTypeColumns)
    ? baseSx
    : { ...baseSx, ...COLLAPSED_COLUMN_SX };
}

export function hoursColumnSx(visibility, showHoursTypeColumns) {
  return columnCellSx('hours', visibility, showHoursTypeColumns, {
    width: '1%',
    whiteSpace: 'nowrap',
    verticalAlign: 'middle'
  });
}

export function typeColumnSx(visibility, showHoursTypeColumns) {
  return columnCellSx('type', visibility, showHoursTypeColumns, {
    width: '1%',
    whiteSpace: 'nowrap',
    verticalAlign: 'middle'
  });
}

/** @param {Record<string, boolean>} visibility */
export function taskTableColumnCount(visibility, showHoursTypeColumns) {
  const ids = [
    'icons',
    'task',
    'file',
    'comment',
    'deadline',
    'hours',
    'type',
    'employee',
    'status',
    'actions'
  ];
  return ids.filter((id) => isTaskTableColumnVisible(id, visibility, showHoursTypeColumns)).length;
}
