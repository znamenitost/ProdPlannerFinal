const cache = new Map();

export function setTaskCdrPreview(taskId, preview) {
  const prev = cache.get(taskId);
  if (prev?.url?.startsWith('blob:')) {
    URL.revokeObjectURL(prev.url);
  }
  cache.set(taskId, preview);
}

export function getTaskCdrPreview(taskId) {
  return cache.get(taskId) ?? null;
}
