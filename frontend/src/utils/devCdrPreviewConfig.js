import { DEV_TEST_CDR_PATH } from './fileOpenerAgent';

/** Временно: превью .cdr с локального C:\0.cdr вместо MINIMARKER. Выключить перед продом. */
export const DEV_CDR_PREVIEW_ENABLED = true;

export const DEV_CDR_PREVIEW_PATH = DEV_TEST_CDR_PATH;

export function getDevCdrDefaultFolderPath() {
  return DEV_CDR_PREVIEW_ENABLED ? 'C:/' : '';
}

export function getDevCdrDefaultFileName() {
  return DEV_CDR_PREVIEW_ENABLED ? '0.cdr' : '';
}

/** Путь вида C:/ + 0.cdr (или C:\temp\file.cdr) — локальный диск, не MINIMARKER. */
export function isDevLocalWindowsPath(folderPath, fileName) {
  if (!DEV_CDR_PREVIEW_ENABLED) return false;
  const folder = String(folderPath || '').trim().replace(/\\/g, '/');
  const file = String(fileName || '').trim();
  if (!folder || !file) return false;
  return /^[A-Za-z]:(\/|$)/.test(folder);
}

/** Собирает полный путь Windows: C:/ + 0.cdr → C:\0.cdr */
export function buildDevLocalFullPath(folderPath, fileName) {
  if (!isDevLocalWindowsPath(folderPath, fileName)) return null;

  const normalizedFolder = String(folderPath || '').trim().replace(/\//g, '\\');
  const file = String(fileName || '').trim().replace(/^\\+/, '');
  if (/^[A-Za-z]:\\?$/i.test(normalizedFolder)) {
    return `${normalizedFolder.slice(0, 2)}\\${file}`;
  }
  const combined = normalizedFolder.endsWith('\\')
    ? `${normalizedFolder}${file}`
    : `${normalizedFolder}\\${file}`;
  return combined.replace(/\\{2,}/g, '\\');
}

/** Путь для чтения превью: локальный диск из задачи или запасной DEV_CDR_PREVIEW_PATH. */
export function resolveCdrPreviewPath(folderPath, fileName) {
  if (!DEV_CDR_PREVIEW_ENABLED) return null;
  return buildDevLocalFullPath(folderPath, fileName) || DEV_CDR_PREVIEW_PATH;
}
