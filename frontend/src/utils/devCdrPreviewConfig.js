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

/** Нормализует папку: C:/, латинская C, убирает лишнее. */
export function normalizeDevFolderPath(folderPath) {
  let folder = String(folderPath || '').trim().replace(/\\/g, '/');
  if (/^[Сс]\//.test(folder) || /^[Сс]:/.test(folder)) {
    folder = `C${folder.slice(1)}`;
  }
  return folder;
}

function isDevDefaultTestFile(folderPath, fileName) {
  const folder = normalizeDevFolderPath(folderPath);
  const file = String(fileName || '').trim();
  return (folder === 'C:/' || folder === 'C:') && file === '0.cdr';
}

/** Путь вида C:/ + 0.cdr — локальный диск, не MINIMARKER. */
export function isDevLocalWindowsPath(folderPath, fileName) {
  if (!DEV_CDR_PREVIEW_ENABLED) return false;
  const folder = normalizeDevFolderPath(folderPath);
  const file = String(fileName || '').trim();
  if (!folder || !file) return false;
  return /^[A-Za-z]:(\/|$)/.test(folder);
}

/** Собирает полный путь Windows: C:/ + 0.cdr → C:\0.cdr */
export function buildDevLocalFullPath(folderPath, fileName) {
  if (!DEV_CDR_PREVIEW_ENABLED) return null;

  const folder = normalizeDevFolderPath(folderPath);
  const file = String(fileName || '').trim().replace(/^\\+/, '');
  if (!file) return null;
  if (!/^[A-Za-z]:(\/|$)/.test(folder)) return null;

  const normalizedFolder = folder.replace(/\//g, '\\');
  if (/^[A-Za-z]:\\?$/i.test(normalizedFolder)) {
    return `${normalizedFolder.slice(0, 2)}\\${file}`;
  }
  const combined = normalizedFolder.endsWith('\\')
    ? `${normalizedFolder}${file}`
    : `${normalizedFolder}\\${file}`;
  return combined.replace(/\\{2,}/g, '\\');
}

/**
 * Единый абсолютный путь для open-dev и read-dev.
 * Таблица (C:/ + 0.cdr) → тот же C:\0.cdr, что в DEV-панели.
 */
export function getDevAgentAbsolutePath(folderPath, fileName) {
  if (!DEV_CDR_PREVIEW_ENABLED) return null;
  const built = buildDevLocalFullPath(folderPath, fileName);
  if (built) return built;
  if (isDevDefaultTestFile(folderPath, fileName)) return DEV_CDR_PREVIEW_PATH;
  return null;
}

export function resolveCdrPreviewPath(folderPath, fileName) {
  return getDevAgentAbsolutePath(folderPath, fileName);
}

export function formatDevTaskFilePath(folderPath, fileName) {
  return getDevAgentAbsolutePath(folderPath, fileName) || DEV_CDR_PREVIEW_PATH;
}
