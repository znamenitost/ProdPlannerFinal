import { getDevAgentAbsolutePath, DEV_CDR_PREVIEW_ENABLED } from './devCdrPreviewConfig';
import { getLocalAgentUnavailableMessage, readDevCdrViaAgent } from './fileOpenerAgent';
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
  if (pathError) return null;

  const agentUnavailable = await getLocalAgentUnavailableMessage();
  if (agentUnavailable) {
    throw new Error(agentUnavailable);
  }

  const path = getDevAgentAbsolutePath(folderPath, fileName);
  try {
    const bytes = await readDevCdrViaAgent(path);
    return previewFromBytes(bytes, taskId, path);
  } catch (err) {
    throw new Error(formatCdrPreviewReadError(err?.message, path));
  }
}

/** Проверка: агент прочитал .cdr с диска (без построения превью). */
export async function isTaskCdrFileReadable(folderPath, fileName) {
  if (!DEV_CDR_PREVIEW_ENABLED) return false;

  const pathError = getCdrPathValidationError(folderPath, fileName);
  if (pathError) return false;

  const agentUnavailable = await getLocalAgentUnavailableMessage();
  if (agentUnavailable) return false;

  const path = getDevAgentAbsolutePath(folderPath, fileName);
  try {
    const bytes = await readDevCdrViaAgent(path);
    return bytes?.length > 0;
  } catch {
    return false;
  }
}

/** @returns {{ fileFound: boolean, hasCdrPreview: boolean, warning: string|null }} */
export async function verifyTaskCdrFileAfterSave(taskId, folderPath, fileName) {
  const pathIssue = getCdrPathValidationError(folderPath, fileName);
  if (pathIssue) {
    return { fileFound: false, hasCdrPreview: false, warning: pathIssue };
  }

  try {
    const preview = await buildTaskCdrPreview(taskId, folderPath, fileName);
    if (preview) {
      return { fileFound: true, hasCdrPreview: true, warning: null };
    }
  } catch (previewErr) {
    const readable = await isTaskCdrFileReadable(folderPath, fileName);
    return {
      fileFound: readable,
      hasCdrPreview: false,
      warning: previewErr?.message || 'Не удалось построить превью .cdr'
    };
  }

  const readable = await isTaskCdrFileReadable(folderPath, fileName);
  return { fileFound: readable, hasCdrPreview: false, warning: null };
}

/** При сохранении задачи: агент читает .cdr, превью сохраняется в БД. */
export async function buildTaskCdrPreview(taskId, folderPath, fileName) {
  if (!DEV_CDR_PREVIEW_ENABLED || !taskId) return null;
  return readAndPreviewCdr(taskId, folderPath, fileName);
}

/**
 * ПКМ: только превью из БД. Без агента и без сетевых запросов, если превью нет.
 * @returns {{ preview: object|null, path: string|null, error: string|null }}
 */
export async function loadTaskCdrPreview(task) {
  if (!DEV_CDR_PREVIEW_ENABLED || !task?.id) {
    return { preview: null, path: null, error: null };
  }

  const path = getDevAgentAbsolutePath(task.folderPath, task.fileName) || '';

  if (task.hasCdrPreview === false) {
    return { preview: null, path, error: null };
  }

  const pathError = getCdrPathValidationError(task.folderPath, task.fileName);
  if (pathError) {
    return { preview: null, path: path || null, error: pathError };
  }

  try {
    const stored = await fetchTaskCdrPreview(task.id);
    if (stored) {
      return { preview: stored, path: stored.path || path, error: null };
    }
  } catch {
    // нет превью или временная ошибка — без шума в консоли
  }

  return { preview: null, path, error: null };
}
