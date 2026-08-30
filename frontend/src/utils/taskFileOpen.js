import { openFileOnClient, openFolderOnClient } from './openFileOnClient';
import { normalizePathForOpen, normalizeFolderPathForOpen } from './filePathForOpen';
import {
  ensureFileOpenSettingsLoaded,
  getFileOpenShareName
} from './fileOpenSettingsCache';

export async function openTaskFile(row) {
  await ensureFileOpenSettingsLoaded();
  const relativePath = normalizePathForOpen(row.folderPath, row.fileName, getFileOpenShareName());
  if (!relativePath || relativePath === '/') {
    throw new Error('Путь к файлу не указан');
  }
  const result = await openFileOnClient(relativePath);
  if (!result.ok) {
    throw new Error(result.reason || 'Не удалось открыть файл');
  }
}

export async function openTaskFolder(row) {
  await ensureFileOpenSettingsLoaded();
  const relativePath = normalizeFolderPathForOpen(row.folderPath, getFileOpenShareName());
  if (!relativePath || relativePath === '/') {
    throw new Error('Путь к папке не указан');
  }
  const result = await openFolderOnClient(relativePath);
  if (!result.ok) {
    throw new Error(result.reason || 'Не удалось открыть папку');
  }
}
