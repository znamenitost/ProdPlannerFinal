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
    if (a[i].requiresTestBeforeProduction !== b[i].requiresTestBeforeProduction) return false;
    if (a[i].supplyMode !== b[i].supplyMode) return false;
    if (a[i].sequenceOrder !== b[i].sequenceOrder) return false;
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
  if (prev.lifecycleBusy !== next.lifecycleBusy) return false;
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
    prev.onOpenIntervals === next.onOpenIntervals &&
    prev.currentUser === next.currentUser
  );
}

export function areChildRowPropsEqual(prev, next) {
  if (prev.task.id !== next.task.id) return false;
  if (prev.task.updatedAt !== next.task.updatedAt) return false;
  if (prev.task.statusText !== next.task.statusText) return false;
  if ((prev.task.workIntervals?.length ?? 0) !== (next.task.workIntervals?.length ?? 0)) return false;
  if (workIntervalsKey(prev.task) !== workIntervalsKey(next.task)) return false;
  if (prev.task.requiresTestBeforeProduction !== next.task.requiresTestBeforeProduction) return false;
  if (prev.task.testEstimateHours !== next.task.testEstimateHours) return false;
  if (prev.task.productionEstimateHours !== next.task.productionEstimateHours) return false;
  if (prev.task.workPhase !== next.task.workPhase) return false;
  if (prev.task.supplyMode !== next.task.supplyMode) return false;
  if (prev.task.sequenceOrder !== next.task.sequenceOrder) return false;
  if (prev.pendingLifecycleTaskId !== next.pendingLifecycleTaskId) return false;
  if (prev.lifecycleBusy !== next.lifecycleBusy) return false;
  if (prev.highlightMyTasks !== next.highlightMyTasks) return false;
  if (prev.selectedEmployeeForHighlight !== next.selectedEmployeeForHighlight) return false;
  if (prev.showHoursTypeColumns !== next.showHoursTypeColumns) return false;
  if (prev.columnVisibility !== next.columnVisibility) return false;
  if (prev.textLimit !== next.textLimit) return false;
  if (prev.canChangeStatus !== next.canChangeStatus) return false;
  if (prev.sharedGroupParentTask?.id !== next.sharedGroupParentTask?.id) return false;
  if (prev.sharedGroupParentTask?.supplyMode !== next.sharedGroupParentTask?.supplyMode) return false;
  if (prev.sharedGroupParentTask?.statusText !== next.sharedGroupParentTask?.statusText) return false;
  if (prev.isLastInSharedGroup !== next.isLastInSharedGroup) return false;
  return (
    prev.onOpenFile === next.onOpenFile &&
    prev.onStart === next.onStart &&
    prev.onPause === next.onPause &&
    prev.onResume === next.onResume &&
    prev.onComplete === next.onComplete &&
    prev.onOpenComment === next.onOpenComment &&
    prev.onOpenIntervals === next.onOpenIntervals &&
    prev.currentUser === next.currentUser
  );
}
