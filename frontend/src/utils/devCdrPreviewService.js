import { resolveCdrPreviewPath, DEV_CDR_PREVIEW_ENABLED } from './devCdrPreviewConfig';
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
    setTaskCdrPreview(taskId, preview);
  }
  return preview;
}

/** То же, что «Превью через обзор» в DEV-панели. */
export async function previewFromCdrFile(file, taskId, path) {
  if (!file) return null;
  const bytes = new Uint8Array(await file.arrayBuffer());
  return previewFromBytes(bytes, taskId, path);
}

async function tryAgentPreview(taskId, folderPath, fileName) {
  const path = resolveCdrPreviewPath(folderPath, fileName);
  if (!path) return null;
  try {
    const bytes = await readDevCdrViaAgent(path);
    return previewFromBytes(bytes, taskId, path);
  } catch {
    return null;
  }
}

/**
 * Кэш → (тихо) агент → иначе выбор файла как в обзоре.
 * @returns {{ preview: object|null, needsPick: boolean, path: string|null }}
 */
export async function loadTaskCdrPreview(task) {
  if (!DEV_CDR_PREVIEW_ENABLED || !task?.id) {
    return { preview: null, needsPick: false, path: null };
  }

  const path = resolveCdrPreviewPath(task.folderPath, task.fileName);
  const cached = getTaskCdrPreview(task.id) || (path ? getPathCdrPreview(path) : null);
  if (cached) {
    setTaskCdrPreview(task.id, cached);
    return { preview: cached, needsPick: false, path: cached.path || path };
  }

  const fromAgent = await tryAgentPreview(task.id, task.folderPath, task.fileName);
  if (fromAgent) {
    return { preview: fromAgent, needsPick: false, path: fromAgent.path || path };
  }

  return { preview: null, needsPick: true, path };
}
