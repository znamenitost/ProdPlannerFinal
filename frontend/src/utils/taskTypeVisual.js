import { tokens } from '../theme/paletteTokens.js';

/** Цвет кружка типа — те же токены, что у темы приложения. Иконки в TaskTypeGlyph. */
export const TASK_TYPE_VISUAL = {
  Резка: { icon: 'saw', color: tokens.primary.main },
  'УФ Печать': { icon: 'print', color: tokens.success.main },
  'УФ ДТФ': { icon: 'sticker', color: tokens.warning.main },
  '3D печать': { icon: 'printer3d', color: tokens.error.main },
  'Гравировка CO2': { icon: 'laserCo2', color: tokens.info.dark },
  'Гравировка FB': { icon: 'laserFiber', color: tokens.secondary.dark },
  Сублимация: { icon: 'press', color: tokens.workDone },
  Сборка: { icon: 'hands', color: tokens.noItems },
  Затирка: { icon: 'paintCan', color: tokens.primary.dark },
  Чистка: { icon: 'clean', color: tokens.secondary.light }
};

export const DEFAULT_TASK_TYPE_VISUAL = { icon: 'other', color: tokens.neutral[300] };

export function getTaskTypeVisual(type) {
  const key = String(type || '').trim();
  if (TASK_TYPE_VISUAL[key]) return TASK_TYPE_VISUAL[key];
  const parts = key.split(',').map((part) => part.trim()).filter(Boolean);
  for (const part of parts) {
    if (TASK_TYPE_VISUAL[part]) return TASK_TYPE_VISUAL[part];
  }
  return DEFAULT_TASK_TYPE_VISUAL;
}
