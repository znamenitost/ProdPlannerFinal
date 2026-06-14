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
  const relative = normalizePathForOpen(folderPath, fileName);
  if (!relative) return null;

  const baseName = relative.split('/').pop() || '';
  if (!/\.cdr$/i.test(baseName)) return null;

  return buildWindowsUncPath(relative);
}

export function resolveCdrPreviewPath(folderPath, fileName) {
  return getDevAgentAbsolutePath(folderPath, fileName);
}

export function formatDevTaskFilePath(folderPath, fileName) {
  return getDevAgentAbsolutePath(folderPath, fileName) || '';
}
