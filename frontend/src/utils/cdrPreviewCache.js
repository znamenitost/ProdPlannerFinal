const STORAGE_VERSION = 'v1';
const TASK_KEY_PREFIX = `pp.cdrPreview.${STORAGE_VERSION}.task.`;
const PATH_KEY_PREFIX = `pp.cdrPreview.${STORAGE_VERSION}.path.`;

/** Cap in-memory + localStorage entries so long sessions do not grow without bound. */
export const MAX_CDR_PREVIEW_ENTRIES = 40;

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

function storageAvailable() {
  try {
    return typeof localStorage !== 'undefined' && localStorage != null;
  } catch {
    return false;
  }
}

function readTaskFromStorage(taskId) {
  if (!storageAvailable()) return null;
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
  if (!key || !storageAvailable()) return null;
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

function listStorageTaskEntries() {
  const entries = [];
  if (!storageAvailable()) return entries;
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key?.startsWith(TASK_KEY_PREFIX)) continue;
      try {
        const parsed = JSON.parse(localStorage.getItem(key) || '');
        entries.push({
          key,
          taskId: parsed?.taskId,
          path: parsed?.path || '',
          savedAt: Number(parsed?.savedAt) || 0
        });
      } catch {
        entries.push({ key, taskId: null, path: '', savedAt: 0 });
      }
    }
  } catch {
    return entries;
  }
  return entries;
}

function removeStorageEntry(taskId, path) {
  if (!storageAvailable()) return;
  try {
    if (taskId != null) {
      localStorage.removeItem(`${TASK_KEY_PREFIX}${taskId}`);
    }
    if (path) {
      localStorage.removeItem(`${PATH_KEY_PREFIX}${pathKey(path)}`);
    }
  } catch {
    // ignore quota / private-mode errors
  }
}

function removeOldestStorageEntries(count) {
  if (count <= 0) return;
  const entries = listStorageTaskEntries();
  entries.sort((a, b) => a.savedAt - b.savedAt);
  for (let i = 0; i < count && i < entries.length; i += 1) {
    const entry = entries[i];
    removeStorageEntry(entry.taskId, entry.path);
    if (entry.taskId == null) {
      try {
        localStorage.removeItem(entry.key);
      } catch {
        // ignore
      }
    }
  }
}

function evictStorageIfNeeded() {
  const entries = listStorageTaskEntries();
  const overflow = entries.length - MAX_CDR_PREVIEW_ENTRIES;
  if (overflow > 0) {
    removeOldestStorageEntries(overflow);
  }
}

function writeToStorage(taskId, preview) {
  if (!storageAvailable()) return;

  const entry = {
    url: preview.url,
    method: preview.method || '',
    path: preview.path || '',
    taskId,
    savedAt: Date.now()
  };

  const persist = () => {
    localStorage.setItem(`${TASK_KEY_PREFIX}${taskId}`, JSON.stringify(entry));
    if (preview.path) {
      localStorage.setItem(`${PATH_KEY_PREFIX}${pathKey(preview.path)}`, JSON.stringify(entry));
    }
  };

  try {
    persist();
    evictStorageIfNeeded();
  } catch (err) {
    removeOldestStorageEntries(Math.max(5, Math.ceil(MAX_CDR_PREVIEW_ENTRIES / 4)));
    try {
      persist();
      evictStorageIfNeeded();
    } catch (retryErr) {
      console.warn('Не удалось сохранить превью .cdr в localStorage', retryErr);
    }
  }
}

function touchMemoryEntry(taskId, preview) {
  if (byTaskId.has(taskId)) {
    byTaskId.delete(taskId);
  }
  byTaskId.set(taskId, preview);

  if (preview?.path) {
    const key = pathKey(preview.path);
    if (byPath.has(key)) {
      byPath.delete(key);
    }
    byPath.set(key, preview);
  }
}

function evictMemoryIfNeeded() {
  while (byTaskId.size > MAX_CDR_PREVIEW_ENTRIES) {
    const oldestTaskId = byTaskId.keys().next().value;
    const oldest = byTaskId.get(oldestTaskId);
    byTaskId.delete(oldestTaskId);
    revokePreview(oldest);
    if (oldest?.path) {
      const key = pathKey(oldest.path);
      if (byPath.get(key) === oldest) {
        byPath.delete(key);
      }
    }
    // Drop storage too so get*() does not immediately rehydrate an evicted entry.
    removeStorageEntry(oldestTaskId, oldest?.path);
  }
}

function rememberInMemory(taskId, preview) {
  const previous = byTaskId.get(taskId);
  if (previous && previous !== preview) {
    revokePreview(previous);
  }
  if (preview?.path) {
    const key = pathKey(preview.path);
    const previousPath = byPath.get(key);
    if (previousPath && previousPath !== preview && previousPath !== previous) {
      revokePreview(previousPath);
    }
  }

  touchMemoryEntry(taskId, preview);
  evictMemoryIfNeeded();
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
  if (cached) {
    touchMemoryEntry(taskId, cached);
    return cached;
  }

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
  if (cached) {
    if (cached.taskId) {
      touchMemoryEntry(cached.taskId, cached);
    } else {
      byPath.delete(key);
      byPath.set(key, cached);
    }
    return cached;
  }

  const stored = readPathFromStorage(path);
  if (!stored) return null;

  if (stored.taskId) {
    rememberInMemory(stored.taskId, stored);
  } else {
    byPath.set(key, stored);
  }
  return stored;
}

/** Test helper: clear in-memory maps (does not wipe unrelated localStorage). */
export function clearCdrPreviewMemoryForTests() {
  for (const preview of byTaskId.values()) {
    revokePreview(preview);
  }
  byTaskId.clear();
  byPath.clear();
}

/** Test helper: current in-memory task entry count. */
export function getCdrPreviewMemorySizeForTests() {
  return byTaskId.size;
}
