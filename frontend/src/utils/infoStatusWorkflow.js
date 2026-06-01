import {
  getInfoStatusConfirmOptions,
  getInfoStatusResolveTarget,
  isInfoStatus
} from '../constants/taskStatuses.js';

/**
 * Если задача в инфостатусе — спрашиваем подтверждение, снимаем блок (Согласовано / В наличии), затем действие.
 */
export async function runWorkflowWithInfoGuard({
  task,
  statusText,
  confirm,
  resolveStatus,
  runAction,
  actionLabel
}) {
  const text = statusText || task?.statusText || '';
  if (!isInfoStatus(text)) {
    await runAction();
    return true;
  }

  const options = getInfoStatusConfirmOptions(text);
  if (!options || !confirm) return false;

  const ok = await confirm({
    ...options,
    title: actionLabel ? `${options.title}: ${actionLabel}` : options.title
  });
  if (!ok) return false;

  const target = getInfoStatusResolveTarget(text);
  if (!target || !resolveStatus) return false;

  await resolveStatus(task, target);
  await runAction();
  return true;
}
