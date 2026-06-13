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

/** Путь для чтения превью: пока dev-режим — всегда локальный C:\0.cdr. */
export function resolveCdrPreviewPath() {
  if (!DEV_CDR_PREVIEW_ENABLED) return null;
  return DEV_CDR_PREVIEW_PATH;
}
