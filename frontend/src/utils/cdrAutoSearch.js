import { DEV_CDR_PREVIEW_ENABLED } from './devCdrPreviewConfig';
import { buildTaskCdrPreview } from './devCdrPreviewService';
import { fetchTaskCdrPreview } from './cdrPreviewApi';
import { scheduleCdrPreviewRetry, reportCdrPreviewRetryFailed } from './cdrPreviewRetryApi';
import { getLocalAgentUnavailableMessage } from './fileOpenerAgent';
import {
  getCdrPathValidationError,
  isCdrPreviewRetryableFailure,
  shouldAttemptCdrPreviewOnSave,
  formatCdrPreviewPostSaveWarning
} from './cdrPreviewErrors';
import { formatDevTaskFilePath } from './devCdrPreviewConfig';

let previewBuildHooks = { onStart: null, onEnd: null };
const previewBuildingTaskIds = new Set();

function normalizePreviewTaskId(taskId) {
  const id = Number(taskId);
  return Number.isFinite(id) ? id : null;
}

export function setCdrPreviewBuildHooks(hooks) {
  previewBuildHooks = hooks ?? { onStart: null, onEnd: null };
  if (!previewBuildHooks.onStart) return;
  for (const taskId of previewBuildingTaskIds) {
    previewBuildHooks.onStart(taskId);
  }
}

export function getActiveCdrPreviewBuildTaskIds() {
  return [...previewBuildingTaskIds];
}

function notifyPreviewBuildStart(taskId) {
  const id = normalizePreviewTaskId(taskId);
  if (id == null) return;
  previewBuildingTaskIds.add(id);
  previewBuildHooks.onStart?.(id);
}

function notifyPreviewBuildEnd(taskId) {
  const id = normalizePreviewTaskId(taskId);
  if (id == null) return;
  previewBuildingTaskIds.delete(id);
  previewBuildHooks.onEnd?.(id);
}

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

function formatFirstAttemptFailureMessage(folderPath, fileName, errMessage = '') {
  if (errMessage) return formatCdrPreviewPostSaveWarning(errMessage);

  const path = formatDevTaskFilePath(folderPath, fileName);
  const detail = path
    ? `Файл или папка не найдены. Проверьте путь к папке и имя файла в задаче.\n\nФайл: ${path}`
    : 'Файл или папка не найдены. Проверьте путь к папке и имя файла в задаче.';
  return formatCdrPreviewPostSaveWarning(detail);
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
  if (!DEV_CDR_PREVIEW_ENABLED || !taskId) return;
  if (!shouldAttemptCdrPreviewOnSave(folderPath, fileName)) return;
  if (getCdrPathValidationError(folderPath, fileName)) return;

  notifyPreviewBuildStart(taskId);
  void (async () => {
    try {
      const agentUnavailable = await getLocalAgentUnavailableMessage();
      if (agentUnavailable) return;

      const ok = await tryBuildPreview(taskId, folderPath, fileName);
      if (ok) return;

      showWarning?.(formatFirstAttemptFailureMessage(folderPath, fileName));
      await scheduleCdrPreviewRetry(taskId);
    } catch (err) {
      const message = err?.message || '';
      if (!isCdrPreviewRetryableFailure(message)) {
        if (message) showWarning?.(formatCdrPreviewPostSaveWarning(message));
        return;
      }

      showWarning?.(formatFirstAttemptFailureMessage(folderPath, fileName, message));
      try {
        await scheduleCdrPreviewRetry(taskId);
      } catch {
        /* ignore */
      }
    } finally {
      notifyPreviewBuildEnd(taskId);
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

  notifyPreviewBuildStart(taskId);
  try {
    const agentUnavailable = await getLocalAgentUnavailableMessage();
    if (agentUnavailable) return false;

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
  } finally {
    notifyPreviewBuildEnd(taskId);
  }
}
