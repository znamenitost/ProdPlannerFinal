export function getUserPreferencesKey(currentUser) {
  if (!currentUser) return 'app.preferences.v1.guest';
  if (currentUser.role === 'Admin') return 'app.preferences.v1.admin';
  return `app.preferences.v1.${currentUser.fullName}`;
}

function readPreferencesStore(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writePreferencesStore(storageKey, store) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(store));
  } catch { /* private mode / quota */ }
}

function getNested(store, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), store);
}

function setNested(store, path, value) {
  const keys = path.split('.');
  const next = { ...store };
  let cursor = next;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i];
    cursor[key] = { ...(cursor[key] ?? {}) };
    cursor = cursor[key];
  }
  cursor[keys[keys.length - 1]] = value;
  return next;
}

export function loadUserPreference(storageKey, preferenceKey, defaultValue) {
  const value = getNested(readPreferencesStore(storageKey), preferenceKey);
  return value === undefined ? defaultValue : value;
}

export function saveUserPreference(storageKey, preferenceKey, value) {
  const store = readPreferencesStore(storageKey);
  writePreferencesStore(storageKey, setNested(store, preferenceKey, value));
}
