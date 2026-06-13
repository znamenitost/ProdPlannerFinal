const STORAGE_VERSION = 'v1';
const TASK_KEY_PREFIX = `pp.cdrPreview.${STORAGE_VERSION}.task.`;
const PATH_KEY_PREFIX = `pp.cdrPreview.${STORAGE_VERSION}.path.`;

const byTaskId = new Map();
const byPath = new Map();

function pathKey(path) {
  return String(path || '').toLowerCase();
}

function revokeBlobUrl(url) {
  if (url?.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}

function revokePreview(preview) {
  revokeBlobUrl(preview?.url);
}

async function ensureDataUrl(url) {
  if (!url) return url;
  if (url.startsWith('data:')) return url;

  const response = await fetch(url);
  const blob = await response.blob();
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

  revokeBlobUrl(url);
  return dataUrl;
}

function readTaskFromStorage(taskId) {
  try {
    const raw = localStorage.getItem(`${TASK_KEY_PREFIX}${taskId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.url) return null;
    return parsed;
  } catch {
    return null;
  }
}

function readPathFromStorage(path) {
  const key = pathKey(path);
  if (!key) return null;
  try {
    const raw = localStorage.getItem(`${PATH_KEY_PREFIX}${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.url) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeToStorage(taskId, preview) {
  const entry = {
    url: preview.url,
    method: preview.method || '',
    path: preview.path || '',
    taskId,
    savedAt: Date.now()
  };

  try {
    localStorage.setItem(`${TASK_KEY_PREFIX}${taskId}`, JSON.stringify(entry));
    if (preview.path) {
      localStorage.setItem(`${PATH_KEY_PREFIX}${pathKey(preview.path)}`, JSON.stringify(entry));
    }
  } catch (err) {
    console.warn('Не удалось сохранить превью .cdr в localStorage', err);
  }
}

function rememberInMemory(taskId, preview) {
  revokePreview(byTaskId.get(taskId));
  byTaskId.set(taskId, preview);
  if (preview?.path) {
    const key = pathKey(preview.path);
    revokePreview(byPath.get(key));
    byPath.set(key, preview);
  }
}

/** Сохраняет превью в память и localStorage (data URL — переживает перезагрузку). */
export async function setTaskCdrPreview(taskId, preview) {
  if (!taskId || !preview?.url) return preview;

  const dataUrl = await ensureDataUrl(preview.url);
  const stored = { ...preview, url: dataUrl };
  rememberInMemory(taskId, stored);
  writeToStorage(taskId, stored);
  return stored;
}

export function getTaskCdrPreview(taskId) {
  const cached = byTaskId.get(taskId);
  if (cached) return cached;

  const stored = readTaskFromStorage(taskId);
  if (stored) {
    rememberInMemory(taskId, stored);
    return stored;
  }

  return null;
}

export function getPathCdrPreview(path) {
  const key = pathKey(path);
  if (!key) return null;

  const cached = byPath.get(key);
  if (cached) return cached;

  const stored = readPathFromStorage(path);
  if (!stored) return null;

  if (stored.taskId) {
    rememberInMemory(stored.taskId, stored);
  } else {
    byPath.set(key, stored);
  }
  return stored;
}
