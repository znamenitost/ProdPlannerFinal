import { getDevAgentAbsolutePath, DEV_CDR_PREVIEW_ENABLED } from './devCdrPreviewConfig';
import { readDevCdrViaAgent } from './fileOpenerAgent';
import { extractCdrPreview } from './cdrPreview';
import {
  getPathCdrPreview,
  getTaskCdrPreview,
  setTaskCdrPreview
} from './cdrPreviewCache';

async function previewFromBytes(bytes, taskId, path) {
  const result = await extractCdrPreview(bytes);
  if (!result.ok) {
    throw new Error(result.error);
  }
  const preview = { url: result.url, method: result.method, path };
  if (taskId) {
    return setTaskCdrPreview(taskId, preview);
  }
  return preview;
}

async function tryAgentPreview(taskId, folderPath, fileName) {
  const path = getDevAgentAbsolutePath(folderPath, fileName);
  if (!path) return null;
  try {
    const bytes = await readDevCdrViaAgent(path);
    return previewFromBytes(bytes, taskId, path);
  } catch {
    return null;
  }
}

/** При сохранении задачи: агент читает .cdr, превью сохраняется в localStorage. */
export async function buildTaskCdrPreview(taskId, folderPath, fileName) {
  if (!DEV_CDR_PREVIEW_ENABLED || !taskId) return null;
  const preview = await tryAgentPreview(taskId, folderPath, fileName);
  if (!preview) {
    throw new Error('Не удалось прочитать .cdr для превью');
  }
  return preview;
}

/**
 * ПКМ: сохранённое превью → (тихо) пересобрать через агент.
 * @returns {{ preview: object|null, path: string|null }}
 */
export async function loadTaskCdrPreview(task) {
  if (!DEV_CDR_PREVIEW_ENABLED || !task?.id) {
    return { preview: null, path: null };
  }

  const path = getDevAgentAbsolutePath(task.folderPath, task.fileName);
  const cached = getTaskCdrPreview(task.id) || (path ? getPathCdrPreview(path) : null);
  if (cached) {
    await setTaskCdrPreview(task.id, cached);
    return { preview: cached, path: cached.path || path };
  }

  const fromAgent = await tryAgentPreview(task.id, task.folderPath, task.fileName);
  if (fromAgent) {
    return { preview: fromAgent, path: fromAgent.path || path };
  }

  return { preview: null, path };
}
