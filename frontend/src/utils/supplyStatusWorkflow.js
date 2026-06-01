import { runWorkflowWithInfoGuard } from './infoStatusWorkflow.js';
import {
  STATUS_ASSIGNED,
  STATUS_WAITING,
  isSequenceBlocked
} from '../constants/taskStatuses.js';

/**
 * Перед «Начал» проверяет блокировку очереди этапов и инфостатусы.
 */
export async function runWorkflowWithSequenceGuard({
  task,
  statusText,
  confirm,
  resolveStatus,
  runAction,
  actionLabel
}) {
  const text = statusText || task?.statusText || '';

  if (isSequenceBlocked(task, text)) {
    if (!confirm || !resolveStatus) return false;
    const ok = await confirm({
      title: actionLabel ? `Ожидание: ${actionLabel}` : 'Ожидание',
      message:
        'Предыдущий этап ещё не завершён. Подтвердите, что начинаете задачу в обход других этапов.',
      confirmLabel: 'Начать в обход',
      confirmColor: 'warning'
    });
    if (!ok) return false;
    await resolveStatus(task, STATUS_ASSIGNED, { sequenceOverride: true });
    await runAction();
    return true;
  }

  return runWorkflowWithInfoGuard({
    task,
    statusText: text,
    confirm,
    resolveStatus,
    runAction,
    actionLabel
  });
}
