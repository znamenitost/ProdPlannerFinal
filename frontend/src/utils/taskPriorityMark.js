/** Родитель общей задачи — не дочерняя подзадача. */
function isSplitParentTask(task) {
  return Boolean(task?.isSplitTask) && (task?.parentRowNumber == null || task?.parentRowNumber === 0);
}

/** Пометка приоритета: у split-родителя — если помечен он или любой ребёнок (как агрегат статуса). */
export function taskShowsPriorityMark(task, childrenTasks = null) {
  if (!task) return false;

  if (isSplitParentTask(task)) {
    if (childrenTasks?.length) {
      return task.isPriorityMarked === true
        || childrenTasks.some((child) => child.isPriorityMarked === true);
    }
    return task.isPriorityMarked === true;
  }

  return task.isPriorityMarked === true;
}
