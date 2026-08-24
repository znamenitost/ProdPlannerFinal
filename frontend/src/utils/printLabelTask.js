import {
  STATUS_COMPLETED,
  STATUS_FINISHED_LABEL,
  STATUS_PICKED_UP
} from '../constants/taskStatuses.js';

function isSplitChildTask(task) {
  return Boolean(task?.isSplitTask && task.parentRowNumber);
}

function isCompletedOrderTask(task) {
  if (!task) return false;
  if (Number(task.status) === 3) return true;
  const text = String(task.statusText || '').trim();
  return text === STATUS_COMPLETED || text === STATUS_FINISHED_LABEL || text === STATUS_PICKED_UP;
}

/** Можно ли предложить печать наклейки для этой задачи. */
export function canPrintOrderLabel(task) {
  if (!task || task.isFuss) return false;
  // Этапы split не печатаем — этикетка на весь заказ (родитель).
  if (isSplitChildTask(task)) return false;
  return true;
}

/** После «Готово» у последнего ребёнка печатаем наклейку родителя. */
export function resolvePrintLabelTaskAfterReady(task, parentTask = null) {
  if (canPrintOrderLabel(task)) return task;
  if (!isSplitChildTask(task) || !isCompletedOrderTask(parentTask)) return null;
  return canPrintOrderLabel(parentTask) ? parentTask : null;
}
