function workIntervalsKey(task) {
  const intervals = task?.workIntervals;
  if (!intervals?.length) return '';
  return intervals
    .map((i) => `${i.startTime}|${i.endTime ?? ''}`)
    .join(';');
}

function sameChildren(a, b) {
  if (a === b) return true;
  if (!a || !b) return a === b;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].id !== b[i].id) return false;
    if (a[i].updatedAt !== b[i].updatedAt) return false;
    if (a[i].statusText !== b[i].statusText) return false;
    if (workIntervalsKey(a[i]) !== workIntervalsKey(b[i])) return false;
    if (a[i].plannedTimeProgress !== b[i].plannedTimeProgress) return false;
  }
  return true;
}

export function areParentRowPropsEqual(prev, next) {
  if (prev.task.id !== next.task.id) return false;
  if (prev.task.updatedAt !== next.task.updatedAt) return false;
  if (prev.task.statusText !== next.task.statusText) return false;
  if ((prev.task.workIntervals?.length ?? 0) !== (next.task.workIntervals?.length ?? 0)) return false;
  if (workIntervalsKey(prev.task) !== workIntervalsKey(next.task)) return false;
  if (prev.task.plannedTimeProgress !== next.task.plannedTimeProgress) return false;
  if (prev.isExpanded !== next.isExpanded) return false;
  if (prev.pendingLifecycleTaskId !== next.pendingLifecycleTaskId) return false;
  if (prev.highlightMyTasks !== next.highlightMyTasks) return false;
  if (prev.selectedEmployeeForHighlight !== next.selectedEmployeeForHighlight) return false;
  if (prev.showHoursTypeColumns !== next.showHoursTypeColumns) return false;
  if (prev.columnVisibility !== next.columnVisibility) return false;
  if (prev.textLimit !== next.textLimit) return false;
  if (prev.canEdit !== next.canEdit || prev.canDelete !== next.canDelete || prev.canChangeStatus !== next.canChangeStatus) return false;
  if (!sameChildren(prev.childrenTasks, next.childrenTasks)) return false;
  return (
    prev.onToggleExpand === next.onToggleExpand &&
    prev.onOpenFile === next.onOpenFile &&
    prev.onStart === next.onStart &&
    prev.onPause === next.onPause &&
    prev.onResume === next.onResume &&
    prev.onComplete === next.onComplete &&
    prev.onEdit === next.onEdit &&
    prev.onDelete === next.onDelete &&
    prev.onOpenComment === next.onOpenComment &&
    prev.currentUser === next.currentUser
  );
}

export function areChildRowPropsEqual(prev, next) {
  if (prev.task.id !== next.task.id) return false;
  if (prev.task.updatedAt !== next.task.updatedAt) return false;
  if (prev.task.statusText !== next.task.statusText) return false;
  if ((prev.task.workIntervals?.length ?? 0) !== (next.task.workIntervals?.length ?? 0)) return false;
  if (workIntervalsKey(prev.task) !== workIntervalsKey(next.task)) return false;
  if (prev.pendingLifecycleTaskId !== next.pendingLifecycleTaskId) return false;
  if (prev.highlightMyTasks !== next.highlightMyTasks) return false;
  if (prev.selectedEmployeeForHighlight !== next.selectedEmployeeForHighlight) return false;
  if (prev.showHoursTypeColumns !== next.showHoursTypeColumns) return false;
  if (prev.columnVisibility !== next.columnVisibility) return false;
  if (prev.textLimit !== next.textLimit) return false;
  if (prev.canChangeStatus !== next.canChangeStatus) return false;
  return (
    prev.onOpenFile === next.onOpenFile &&
    prev.onStart === next.onStart &&
    prev.onPause === next.onPause &&
    prev.onResume === next.onResume &&
    prev.onComplete === next.onComplete &&
    prev.onOpenComment === next.onOpenComment &&
    prev.currentUser === next.currentUser
  );
}
