export function hasNewRowAssigneeDetails(newRow) {
  if (!newRow) return false;

  const parts = newRow.assigneeParts;
  if (newRow.isSharedTask && Array.isArray(parts) && parts.length >= 2) {
    return parts.every(
      (p) =>
        Boolean(p?.employeeName?.trim()) &&
        Number(p?.allocatedHours) >= 0.5 &&
        Boolean(String(p?.taskType || '').trim())
    );
  }

  if (newRow.employeeName?.trim()) {
    const hours = Number(newRow.estimateHours);
    return hours >= 0.5 && Array.isArray(newRow.types) && newRow.types.length > 0;
  }

  return false;
}

export function shouldShowHoursTypeColumns(newRow) {
  return !newRow || hasNewRowAssigneeDetails(newRow);
}

const COLLAPSED_COLUMN_SX = {
  display: 'none',
  width: 0,
  minWidth: 0,
  maxWidth: 0,
  p: 0,
  border: 0,
  overflow: 'hidden'
};

export function hoursColumnSx(show) {
  return show ? { width: '1%', whiteSpace: 'nowrap', verticalAlign: 'middle' } : COLLAPSED_COLUMN_SX;
}

export function typeColumnSx(show) {
  return show ? { width: '1%', whiteSpace: 'nowrap', verticalAlign: 'middle' } : COLLAPSED_COLUMN_SX;
}

export function taskTableColumnCount(showHoursTypeColumns) {
  return showHoursTypeColumns ? 10 : 8;
}
