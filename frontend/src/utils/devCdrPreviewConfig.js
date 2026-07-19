import { buildWindowsUncPath } from './fileOpenerAgent';
import { normalizePathForOpen } from './filePathForOpen';
import { getFileOpenShareName, getFileOpenSettings } from './fileOpenSettingsCache';

export const DEV_CDR_PREVIEW_ENABLED = true;

export function getDevCdrDefaultFolderPath() {
  return '';
}

export function getDevCdrDefaultFileName() {
  return '';
}

/** UNC-путь для чтения .cdr через агент: \\сервер\шара\... */
export function getDevAgentAbsolutePath(folderPath, fileName) {
  const relative = normalizePathForOpen(folderPath, fileName, getFileOpenShareName());
  if (!relative) return null;

  const baseName = relative.split('/').pop() || '';
  if (!/\.cdr$/i.test(baseName)) return null;

  const { windowsHost, shareName } = getFileOpenSettings();
  return buildWindowsUncPath(relative, windowsHost, shareName);
}

export function resolveCdrPreviewPath(folderPath, fileName) {
  return getDevAgentAbsolutePath(folderPath, fileName);
}

export function formatDevTaskFilePath(folderPath, fileName) {
  return getDevAgentAbsolutePath(folderPath, fileName) || '';
}
