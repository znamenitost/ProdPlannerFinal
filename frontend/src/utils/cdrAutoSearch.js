import { DEV_CDR_PREVIEW_ENABLED } from './devCdrPreviewConfig';
import { buildTaskCdrPreview } from './devCdrPreviewService';
import { fetchTaskCdrPreview } from './cdrPreviewApi';
import { scheduleCdrPreviewRetry, reportCdrPreviewRetryFailed } from './cdrPreviewRetryApi';
import { getLocalAgentUnavailableMessage } from './fileOpenerAgent';
import {
  getCdrPathValidationError,
  isCdrPreviewRetryableFailure,
  shouldAttemptCdrPreviewOnSave
} from './cdrPreviewErrors';
import { formatDevTaskFilePath } from './devCdrPreviewConfig';

function normalizeAutoSearchMinutes(value) {
  const n = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.min(n, 1440);
}

function formatAutoSearchFailedMessage(folderPath, fileName) {
  const path = formatDevTaskFilePath(folderPath, fileName);
  if (path) {
    return `Автопоиск не нашёл превью.\n\nФайл: ${path}`;
  }
  return 'Автопоиск не нашёл превью для задачи.';
}

async function tryBuildPreview(taskId, folderPath, fileName) {
  const stored = await fetchTaskCdrPreview(taskId);
  if (stored) return true;

  const preview = await buildTaskCdrPreview(taskId, folderPath, fileName);
  return Boolean(preview);
}

/** Первая попытка сразу после сохранения (в фоне, без блокировки UI). */
export function startCdrAutoSearchAfterSave({
  taskId,
  folderPath,
  fileName,
  autoSearchMinutes,
  showWarning
}) {
  const minutes = normalizeAutoSearchMinutes(autoSearchMinutes);
  if (!DEV_CDR_PREVIEW_ENABLED || !taskId || minutes <= 0) return;

  void (async () => {
    if (!shouldAttemptCdrPreviewOnSave(folderPath, fileName)) return;
    if (getCdrPathValidationError(folderPath, fileName)) return;

    const agentUnavailable = await getLocalAgentUnavailableMessage();
    if (agentUnavailable) return;

    try {
      const ok = await tryBuildPreview(taskId, folderPath, fileName);
      if (ok) return;
      await scheduleCdrPreviewRetry(taskId);
    } catch (err) {
      if (!isCdrPreviewRetryableFailure(err?.message)) return;
      try {
        await scheduleCdrPreviewRetry(taskId);
      } catch {
        /* ignore */
      }
    }
  })();
}

/** Вторая (последняя) попытка по расписанию. */
export async function runCdrAutoSearchSecondAttempt(item, showWarning) {
  const taskId = Number(item?.taskId);
  if (!DEV_CDR_PREVIEW_ENABLED || !Number.isFinite(taskId)) return false;

  const minutes = normalizeAutoSearchMinutes(item?.autoSearchMinutes);
  if (minutes <= 0) return false;

  const folderPath = item?.folderPath || '';
  const fileName = item?.fileName || '';
  if (!shouldAttemptCdrPreviewOnSave(folderPath, fileName)) return false;
  if (getCdrPathValidationError(folderPath, fileName)) return false;

  const agentUnavailable = await getLocalAgentUnavailableMessage();
  if (agentUnavailable) return false;

  try {
    const ok = await tryBuildPreview(taskId, folderPath, fileName);
    if (ok) return true;

    showWarning?.(formatAutoSearchFailedMessage(folderPath, fileName));
    await reportCdrPreviewRetryFailed(taskId);
    return false;
  } catch (err) {
    if (isCdrPreviewRetryableFailure(err?.message)) {
      showWarning?.(formatAutoSearchFailedMessage(folderPath, fileName));
    }
    await reportCdrPreviewRetryFailed(taskId);
    return false;
  }
}
