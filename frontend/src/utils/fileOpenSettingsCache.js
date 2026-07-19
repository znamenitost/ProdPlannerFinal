import { fetchFileOpenSettings } from '../services/fileOpenSettingsApi.js';

export const DEFAULT_FILE_OPEN_SETTINGS = Object.freeze({
  windowsHost: 'MINIMARKER',
  shareName: 'Клиенты',
  macSmbHost: 'minimarker'
});

let cached = { ...DEFAULT_FILE_OPEN_SETTINGS };
let hydrated = false;
let loadPromise = null;
const listeners = new Set();

function normalizeSettings(raw) {
  return {
    windowsHost: String(raw?.windowsHost || DEFAULT_FILE_OPEN_SETTINGS.windowsHost).trim()
      || DEFAULT_FILE_OPEN_SETTINGS.windowsHost,
    shareName: String(raw?.shareName || DEFAULT_FILE_OPEN_SETTINGS.shareName).trim()
      || DEFAULT_FILE_OPEN_SETTINGS.shareName,
    macSmbHost: String(raw?.macSmbHost || DEFAULT_FILE_OPEN_SETTINGS.macSmbHost).trim()
      || DEFAULT_FILE_OPEN_SETTINGS.macSmbHost
  };
}

function notify() {
  for (const listener of listeners) {
    try {
      listener(cached);
    } catch {
      // ignore subscriber errors
    }
  }
}

export function getFileOpenSettings() {
  return cached;
}

export function getFileOpenShareName() {
  return cached.shareName;
}

export function getFileOpenWindowsHost() {
  return cached.windowsHost;
}

export function setFileOpenSettingsCache(next) {
  cached = normalizeSettings(next);
  hydrated = true;
  notify();
  return cached;
}

export function subscribeFileOpenSettings(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Загружает настройки с сервера (с дедупликацией параллельных запросов). */
export async function ensureFileOpenSettingsLoaded({ force = false } = {}) {
  if (!force && hydrated) return cached;
  if (!force && loadPromise) return loadPromise;

  loadPromise = fetchFileOpenSettings()
    .then((data) => setFileOpenSettingsCache(data))
    .catch(() => cached)
    .finally(() => {
      loadPromise = null;
    });

  return loadPromise;
}
