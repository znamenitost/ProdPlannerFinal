import {
  isFinishedStatusText,
  WORK_PHASE_DONE,
  WORK_PHASE_TEST
} from '../constants/taskStatuses.js';

function isTaskCompleted(task) {
  if (!task) return true;
  if (isFinishedStatusText(task.statusText) || task.status === 3) return true;
  return Number(task.workPhase) === WORK_PHASE_DONE;
}

/** Родитель общей задачи — не «через тест» (как TestPhaseWorkflow.IsTestPhaseTask). */
function isSplitParentTask(task) {
  return Boolean(task?.isSplitTask) && (task?.parentRowNumber == null || task?.parentRowNumber === 0);
}

/** Одиночная или дочерняя подзадача с этапом «тест → согласование → основная часть». */
function isTestPhaseTask(task) {
  if (!task || isSplitParentTask(task)) return false;

  if (task.requiresTestBeforeProduction === true) return true;

  const testHours = Number(task.testEstimateHours) || 0;
  const productionHours = Number(task.productionEstimateHours) || 0;
  return testHours > 0 && productionHours > 0;
}

/** Первый этап до согласования: WorkPhase None или Test. */
function isActiveTestPhase(task) {
  const phase = Number(task?.workPhase) || 0;
  return phase === 0 || phase === WORK_PHASE_TEST;
}

/** Показываем маркер только на первом этапе до согласования. */
export function taskShowsThroughApproval(task, childrenTasks = null) {
  if (!task || isTaskCompleted(task)) return false;

  if (isSplitParentTask(task)) {
    if (childrenTasks?.length) {
      return childrenTasks.some((child) => taskShowsThroughApproval(child));
    }
    return task.showsThroughApproval === true;
  }

  if (!isTestPhaseTask(task)) return false;
  return isActiveTestPhase(task);
}

/** Режим выполнения сплита: у дочерней строки берём родителя, если на child не задан. */
export function getSplitSupplyMode(task, parentTask) {
  const mode = task?.supplyMode ?? parentTask?.supplyMode;
  return Number(mode) || 0;
}
