const byTaskId = new Map();
const byPath = new Map();

function revokePreview(preview) {
  if (preview?.url?.startsWith('blob:')) {
    URL.revokeObjectURL(preview.url);
  }
}

export function setTaskCdrPreview(taskId, preview) {
  revokePreview(byTaskId.get(taskId));
  byTaskId.set(taskId, preview);
  if (preview?.path) {
    setPathCdrPreview(preview.path, preview);
  }
}

export function getTaskCdrPreview(taskId) {
  return byTaskId.get(taskId) ?? null;
}

export function setPathCdrPreview(path, preview) {
  const key = String(path || '').toLowerCase();
  if (!key) return;
  revokePreview(byPath.get(key));
  byPath.set(key, preview);
}

export function getPathCdrPreview(path) {
  const key = String(path || '').toLowerCase();
  return key ? byPath.get(key) ?? null : null;
}
