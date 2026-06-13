import { resolveCdrPreviewPath, DEV_CDR_PREVIEW_ENABLED } from './devCdrPreviewConfig';
import { readDevCdrViaAgent } from './fileOpenerAgent';
import { extractCdrPreview } from './cdrPreview';
import { getTaskCdrPreview, setTaskCdrPreview } from './cdrPreviewCache';

export async function buildTaskCdrPreview(taskId) {
  if (!DEV_CDR_PREVIEW_ENABLED || !taskId) return null;

  const path = resolveCdrPreviewPath();
  if (!path) return null;

  const bytes = await readDevCdrViaAgent(path);
  const result = await extractCdrPreview(bytes);
  if (!result.ok) {
    throw new Error(result.error);
  }

  const preview = { url: result.url, method: result.method, path };
  setTaskCdrPreview(taskId, preview);
  return preview;
}

export async function ensureTaskCdrPreview(task) {
  if (!task?.id) return null;
  const cached = getTaskCdrPreview(task.id);
  if (cached) return cached;
  return buildTaskCdrPreview(task.id);
}
