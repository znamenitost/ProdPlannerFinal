import {
  ACTION_RESUME,
  STATUS_IN_PROGRESS,
  STATUS_PAUSED,
  canStartWithoutConfirm,
  isFinishedStatusText,
  isInfoStatus,
  isSequenceBlocked
} from '../constants/taskStatuses.js';

function blockedReason(task, status) {
  if (isSequenceBlocked(task, status)) return 'Предыдущий этап ещё не завершён';
  if (isInfoStatus(status)) return status;
  if (task?.blocked) return 'Сейчас нельзя начать эту задачу';
  return '';
}

/** Кнопки старт/пауза/готово на карточке плана дня. */
export function getDayPlanCardWorkflow(task) {
  const status = String(task?.statusText || '').trim();
  const done = isFinishedStatusText(status);
  const started = status === STATUS_IN_PROGRESS;
  const paused = status === STATUS_PAUSED;
  const blocked = Boolean(task?.blocked) || isInfoStatus(status) || isSequenceBlocked(task, status);
  const canStart = canStartWithoutConfirm(task) && !task?.blocked;
  const canPause = started && !blocked;
  const canResume = paused && !blocked;
  const canComplete = (started || paused) && !blocked && !done;
  const primaryAction = paused ? 'resume' : started ? 'pause' : 'start';
  const primaryLabel = paused ? ACTION_RESUME : started ? STATUS_PAUSED : STATUS_IN_PROGRESS;

  return {
    visible: !done,
    blocked,
    blockedReason: blockedReason(task, status),
    primaryAction,
    primaryLabel,
    primaryEnabled: paused ? canResume : started ? canPause : canStart,
    canComplete
  };
}
