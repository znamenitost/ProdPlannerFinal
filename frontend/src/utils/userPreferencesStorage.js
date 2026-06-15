export function getUserPreferencesKey(currentUser) {
  if (!currentUser) return 'app.preferences.v1.guest';
  if (currentUser.id) return `app.preferences.v1.${currentUser.id}`;
  if (currentUser.role === 'Admin') return 'app.preferences.v1.admin';
  return `app.preferences.v1.${currentUser.fullName}`;
}

function getLegacyUserPreferencesKeys(currentUser) {
  if (!currentUser) return [];
  const keys = [];
  if (currentUser.role === 'Admin') keys.push('app.preferences.v1.admin');
  if (currentUser.fullName) keys.push(`app.preferences.v1.${currentUser.fullName}`);
  return keys;
}

/** Переносит настройки со старых ключей (admin / fullName) на ключ по user.id. */
export function migrateLegacyUserPreferences(currentUser) {
  if (!currentUser?.id) return;

  const targetKey = getUserPreferencesKey(currentUser);
  const targetStore = readPreferencesStore(targetKey);
  if (Object.keys(targetStore).length > 0) return;

  for (const legacyKey of getLegacyUserPreferencesKeys(currentUser)) {
    if (legacyKey === targetKey) continue;
    const legacyStore = readPreferencesStore(legacyKey);
    if (Object.keys(legacyStore).length > 0) {
      writePreferencesStore(targetKey, legacyStore);
      return;
    }
  }
}

export const SHARED_PREFERENCES_KEY = 'app.preferences.v1.shared';

export function loadSharedPreference(preferenceKey, defaultValue) {
  return loadUserPreference(SHARED_PREFERENCES_KEY, preferenceKey, defaultValue);
}

export function saveSharedPreference(preferenceKey, value) {
  saveUserPreference(SHARED_PREFERENCES_KEY, preferenceKey, value);
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
