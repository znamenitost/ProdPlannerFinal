import { STATUS_COMPLETED, STATUS_IN_PROGRESS } from '../constants/taskStatuses.js';

/** Задача в статусе «Начал» — единственный кандидат на фоновое обновление % прогресса. */
export function isTaskStatusInProgress(task) {
  if (!task) return false;
  if (task.statusText === STATUS_IN_PROGRESS) return true;
  return task.status === 1;
}

export function isTaskCompleted(task) {
  if (!task) return false;
  if (task.statusText === STATUS_COMPLETED) return true;
  return task.status === 3;
}

export function hasPlannedProgressFooter(row, showPlannedProgressEnabled) {
  return Boolean(
    showPlannedProgressEnabled
    && row?.showPlannedTimeProgress === true
    && !isTaskCompleted(row)
  );
}

/**
 * Id задач на текущей странице, для которых имеет смысл опрашивать plannedTimeProgress.
 * Только «Начал», только видимые строки (в т.ч. раскрытые дочерние split-задачи).
 */
export function collectInProgressProgressTaskIds({
  rows,
  childrenCache,
  expandedRows,
  autoExpandIds = new Set()
}) {
  const result = [];
  const seen = new Set();

  const addParent = (row) => {
    if (seen.has(row.id)) return;
    seen.add(row.id);
    result.push({ id: row.id, isChild: false });
  };

  const addChild = (child, parentId) => {
    if (seen.has(child.id)) return;
    seen.add(child.id);
    result.push({ id: child.id, isChild: true, parentId });
  };

  for (const row of rows) {
    const children = childrenCache.get(row.id) || [];
    const hasChildren = row.isSplitTask || children.length > 0;
    const isExpanded = expandedRows.has(row.id) || autoExpandIds.has(row.id);

    if (hasChildren) {
      if (isTaskStatusInProgress(row)) addParent(row);
      if (!isExpanded) continue;
      for (const child of children) {
        if (isTaskStatusInProgress(child)) addChild(child, row.id);
      }
      continue;
    }

    if (isTaskStatusInProgress(row)) addParent(row);
  }

  return result;
}

export const PLANNED_PROGRESS_POLL_FIELDS = [
  'plannedTimeProgress',
  'showPlannedTimeProgress',
  'updatedAt'
];

export function pickPlannedProgressPatch(dto) {
  return {
    plannedTimeProgress: dto.plannedTimeProgress,
    showPlannedTimeProgress: dto.showPlannedTimeProgress,
    updatedAt: dto.updatedAt
  };
}
