import { buildWindowsUncPath } from './fileOpenerAgent';
import { normalizePathForOpen } from './filePathForOpen';

export const DEV_CDR_PREVIEW_ENABLED = true;

export function getDevCdrDefaultFolderPath() {
  return '';
}

export function getDevCdrDefaultFileName() {
  return '';
}

/** UNC-путь для чтения .cdr через агент: \\MINIMARKER\Клиенты\... */
export function getDevAgentAbsolutePath(folderPath, fileName) {
  const file = String(fileName || '').trim();
  if (!file || !/\.cdr$/i.test(file)) return null;

  const relative = normalizePathForOpen(folderPath, fileName);
  if (!relative) return null;

  return buildWindowsUncPath(relative);
}

export function resolveCdrPreviewPath(folderPath, fileName) {
  return getDevAgentAbsolutePath(folderPath, fileName);
}

export function formatDevTaskFilePath(folderPath, fileName) {
  return getDevAgentAbsolutePath(folderPath, fileName) || '';
}
