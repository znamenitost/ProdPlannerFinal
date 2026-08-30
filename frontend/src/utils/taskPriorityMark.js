import { isSameEmployeeName } from './employeeNameMatch.js';
import { getTaskPriorityRank } from './taskPriorityRank.js';

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

function pickOwnChildPriorityRank(childrenTasks, viewerEmployeeName) {
  if (!viewerEmployeeName || !Array.isArray(childrenTasks) || childrenTasks.length === 0) {
    return null;
  }

  const ranks = childrenTasks
    .filter((child) => isSameEmployeeName(child.employeeName, viewerEmployeeName))
    .map((child) => getTaskPriorityRank(child))
    .filter((rank) => rank != null);

  return ranks.length ? Math.min(...ranks) : null;
}

/**
 * Номер очереди, который можно показать этому зрителю.
 * Чужие 1-2-3 скрываем: очередь своя у каждого сотрудника и цифры повторяются.
 * У общей задачи цифра зрителя поднимается с его подзадачи, если есть хотя бы одна его с номером.
 */
export function getVisiblePriorityRank(task, childrenTasks = null, options = {}) {
  const { viewerEmployeeName = null } = options;
  if (!task) return null;

  if (isSplitParentTask(task)) {
    if (!viewerEmployeeName) return null;

    const fromChildren = pickOwnChildPriorityRank(childrenTasks, viewerEmployeeName);
    if (fromChildren != null) return fromChildren;
    if (Array.isArray(childrenTasks) && childrenTasks.length > 0) return null;
    return getTaskPriorityRank(task);
  }

  if (viewerEmployeeName && !isSameEmployeeName(task.employeeName, viewerEmployeeName)) {
    return null;
  }

  return getTaskPriorityRank(task);
}

/** Сотрудник — всегда себя. Админ — выбранного в шапке исполнителя. */
export function getPriorityMarkViewerEmployeeName(currentUser, selectedEmployeeName = null) {
  if (currentUser?.role === 'Admin') {
    return selectedEmployeeName || null;
  }
  return currentUser?.fullName || selectedEmployeeName || null;
}
