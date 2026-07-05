/** Родитель общей задачи — не дочерняя подзадача. */
function isSplitParentTask(task) {
  return Boolean(task?.isSplitTask) && (task?.parentRowNumber == null || task?.parentRowNumber === 0);
}

function isMarkedTask(task) {
  return task?.isPriorityMarked === true;
}

function isMarkedForEmployee(task, employeeName) {
  return isMarkedTask(task) && task.employeeName === employeeName;
}

/**
 * Пометка приоритета.
 * У split-родителя — агрегат по детям (как статус).
 * Для сотрудника (viewerEmployeeName) — только свои подзадачи, не чужие.
 */
export function taskShowsPriorityMark(task, childrenTasks = null, options = {}) {
  const { viewerEmployeeName = null } = options;
  if (!task) return false;

  const scopeToViewer = Boolean(viewerEmployeeName);

  if (isSplitParentTask(task)) {
    if (childrenTasks?.length) {
      if (!scopeToViewer) {
        return isMarkedTask(task) || childrenTasks.some(isMarkedTask);
      }
      return childrenTasks.some((child) => isMarkedForEmployee(child, viewerEmployeeName));
    }

    if (!scopeToViewer) {
      return isMarkedTask(task);
    }

    // Дети не загружены — на сервере isPriorityMarked уже ограничен текущим сотрудником.
    return isMarkedTask(task);
  }

  if (!scopeToViewer) {
    return isMarkedTask(task);
  }

  return isMarkedForEmployee(task, viewerEmployeeName);
}

/** Имя сотрудника для фильтра иконки: null у админа (видит все пометки). */
export function getPriorityMarkViewerEmployeeName(currentUser) {
  if (!currentUser || currentUser.role === 'Admin') return null;
  return currentUser.fullName || null;
}
