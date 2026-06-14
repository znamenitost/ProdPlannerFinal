import { getDevAgentAbsolutePath, DEV_CDR_PREVIEW_ENABLED } from './devCdrPreviewConfig';
import { readDevCdrViaAgent } from './fileOpenerAgent';
import { extractCdrPreview } from './cdrPreview';
import { fetchTaskCdrPreview, persistTaskCdrPreview } from './cdrPreviewApi';
import {
  formatCdrPreviewPersistError,
  formatCdrPreviewReadError,
  getCdrPathValidationError
} from './cdrPreviewErrors';

async function previewFromBytes(bytes, taskId, path) {
  const result = await extractCdrPreview(bytes);
  if (!result.ok) {
    const pathSuffix = path ? `\nФайл: ${path}` : '';
    throw new Error(`${result.error}${pathSuffix}`);
  }

  const preview = { url: result.url, method: result.method, path };
  if (!taskId) return preview;

  try {
    return await persistTaskCdrPreview(taskId, preview);
  } catch (err) {
    throw new Error(formatCdrPreviewPersistError(err?.message));
  }
}

async function readAndPreviewCdr(taskId, folderPath, fileName) {
  const pathError = getCdrPathValidationError(folderPath, fileName);
  if (pathError) {
    throw new Error(pathError);
  }

  const path = getDevAgentAbsolutePath(folderPath, fileName);
  try {
    const bytes = await readDevCdrViaAgent(path);
    return previewFromBytes(bytes, taskId, path);
  } catch (err) {
    throw new Error(formatCdrPreviewReadError(err?.message, path));
  }
}

/** При сохранении задачи: агент читает .cdr, превью сохраняется в БД. */
export async function buildTaskCdrPreview(taskId, folderPath, fileName) {
  if (!DEV_CDR_PREVIEW_ENABLED || !taskId) return null;
  return readAndPreviewCdr(taskId, folderPath, fileName);
}

/**
 * ПКМ: превью из БД → при необходимости пересобрать через агент.
 * @returns {{ preview: object|null, path: string|null, error: string|null }}
 */
export async function loadTaskCdrPreview(task) {
  if (!DEV_CDR_PREVIEW_ENABLED || !task?.id) {
    return { preview: null, path: null, error: null };
  }

  const pathError = getCdrPathValidationError(task.folderPath, task.fileName);
  if (pathError) {
    return { preview: null, path: null, error: pathError };
  }

  const path = getDevAgentAbsolutePath(task.folderPath, task.fileName);

  try {
    const stored = await fetchTaskCdrPreview(task.id);
    if (stored && (!stored.sourceKey || stored.sourceKey === path)) {
      return { preview: stored, path: stored.path || path, error: null };
    }
  } catch {
    // fallback to agent below
  }

  try {
    const fromAgent = await readAndPreviewCdr(task.id, task.folderPath, task.fileName);
    return { preview: fromAgent, path: fromAgent.path || path, error: null };
  } catch (err) {
    return { preview: null, path, error: err?.message || 'Не удалось построить превью .cdr' };
  }
}
