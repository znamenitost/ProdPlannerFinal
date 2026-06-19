import { FILE_OPENER_INSTALL_HINT } from './fileOpenerHints.js';
import { normalizePathForOpen } from './filePathForOpen.js';

const AGENT_ERROR_MESSAGES = {
  'file not found': 'Файл не найден',
  'missing path': 'Не указан путь к файлу',
  'read path not allowed': 'Путь не разрешён для чтения',
  'dev path not allowed': 'Путь не разрешён (только C:\\... или \\\\MINIMARKER\\Клиенты\\...)',
  'path not allowed': 'Путь не разрешён',
  'not found': 'Запрос к агенту не найден',
};

/** Подсказка по колонкам «задача» + «файл»; null если путь к открытию собрать можно. */
export function getTaskFilePathHint(folderPath, fileName) {
  const file = String(fileName || '').trim();
  if (!file) {
    return 'Укажите имя файла для открытия и превью';
  }

  const relative = normalizePathForOpen(folderPath, fileName);
  if (!relative) {
    return 'Не удалось определить путь. Проверьте папку и имя файла';
  }

  return null;
}

/** @returns {string|null} Текст ошибки или null, если путь к .cdr корректен. */
export function getCdrPathValidationError(folderPath, fileName) {
  const hint = getTaskFilePathHint(folderPath, fileName);
  if (hint) return hint;

  const file = String(fileName || '').trim();
  const relative = normalizePathForOpen(folderPath, fileName);
  if (!/\.cdr$/i.test(relative.split('/').pop() || '')) {
    return `Превью строится только для .cdr — указан файл «${file}»`;
  }

  return null;
}

function isAgentUnreachableMessage(message) {
  const normalized = String(message || '').toLowerCase();
  return normalized.includes('failed to fetch')
    || normalized.includes('networkerror')
    || normalized.includes('network error')
    || normalized.includes('aborterror')
    || normalized.includes('fetch failed')
    || normalized.includes('not allowed to request resource')
    || normalized.includes('access control')
    || normalized.includes('load failed');
}

/** Предупреждение пользователю только при недоступном агенте (не путь/файл/превью). */
export function isAgentUnavailableWarning(message) {
  const text = String(message || '');
  if (!text) return false;
  if (text.includes(FILE_OPENER_INSTALL_HINT)) return true;
  if (/локальный агент недоступен/i.test(text)) return true;
  if (/только на windows/i.test(text)) return true;
  if (/агент не запущен/i.test(text)) return true;
  return false;
}

/** Короткое сообщение: файл не найден по UNC/локальному пути. */
export function formatFileNotFoundByPath(filePath = '') {
  const path = String(filePath || '').trim();
  if (path) return `Файл по пути (${path}) не найден`;
  return 'Файл не найден';
}

function extractFilePathFromErrorMessage(message) {
  const pathMatch = String(message || '').match(/(?:Путь|Файл):\s*(.+)$/m);
  return pathMatch?.[1]?.trim() || '';
}

function isFileNotFoundDetail(message) {
  const text = String(message || '');
  return isFileNotFoundAgentError(text)
    || /файл по пути/i.test(text)
    || /файл или папка не найден/i.test(text);
}

/** Агент ответил, но файл/папка на UNC недоступны (404, off VPN и т.п.). */
export function isFileNotFoundAgentError(message) {
  const lower = String(message || '').trim().toLowerCase();
  if (lower === 'file not found') return true;
  if (lower === 'http 404') return true;
  return false;
}

/** Netopen только если агент недоступен; при «файл не найден» и прочих ответах агента — ошибка в UI. */
export function shouldTryNetopenAfterAgentFailure(agentError) {
  if (!agentError) return false;
  if (isFileNotFoundAgentError(agentError)) return false;
  return isAgentUnreachableMessage(agentError);
}

/** Сообщение, когда и агент, и netopen не смогли открыть файл. */
export function formatOpenFileCombinedError(agentMessage, filePath = '', launchReason = '') {
  const agentPart = agentMessage
    ? formatFileOpenError(agentMessage, filePath)
    : '';
  const launchPart = String(launchReason || '').trim()
    || 'Не удалось запустить netopen. Проверьте, что обработчик netopen установлен, или подключитесь к локальной сети.';

  if (agentPart && isFileNotFoundAgentError(agentMessage)) {
    return `${agentPart}\n\nТакже не удалось открыть через netopen: ${launchPart}`;
  }
  if (agentPart) {
    return `${agentPart}\n\n${launchPart}`;
  }
  return launchPart;
}

/** Человекочитаемая ошибка открытия файла через локальный агент. */
export function formatFileOpenError(rawMessage, filePath = '') {
  return formatCdrPreviewReadError(rawMessage, filePath);
}

/** Человекочитаемая ошибка чтения .cdr через локальный агент. */
export function formatCdrPreviewReadError(rawMessage, filePath = '') {
  const message = String(rawMessage || '').trim();
  const pathSuffix = filePath ? `\nПуть: ${filePath}` : '';

  if (!message || message === 'Не удалось прочитать файл') {
    return `Не удалось прочитать .cdr через локальный агент.${pathSuffix}`;
  }

  if (isAgentUnreachableMessage(message)) {
    return `Локальный агент недоступен. ${FILE_OPENER_INSTALL_HINT}${pathSuffix}`;
  }

  const httpMatch = message.match(/^HTTP (\d{3})$/i);
  if (httpMatch) {
    const status = httpMatch[1];
    if (status === '404') {
      return formatFileNotFoundByPath(filePath);
    }
    if (status === '403') return `Доступ к файлу запрещён агентом.${pathSuffix}`;
    return `Ошибка агента (HTTP ${status}).${pathSuffix}`;
  }

  const lower = message.toLowerCase();
  if (lower === 'file not found') {
    return formatFileNotFoundByPath(filePath);
  }

  for (const [key, label] of Object.entries(AGENT_ERROR_MESSAGES)) {
    if (lower === key) {
      if (key === 'file not found') {
        return formatFileNotFoundByPath(filePath);
      }
      return `${label}.${pathSuffix}`;
    }
  }

  if (message.startsWith('Агент ') || message.startsWith('Пустой ')) {
    return `${message}${pathSuffix}`;
  }

  return `${message}${pathSuffix}`;
}

/** Ошибка «файл не найден» — можно повторить позже (задержка синхронизации и т.п.). */
export function isCdrPreviewRetryableFailure(message) {
  return isFileNotFoundAgentError(message)
    || /файл по пути/i.test(String(message || ''))
    || /файл или папка не найден/i.test(String(message || ''));
}

/** Есть имя файла — при сохранении пытаемся построить превью и показать предупреждение при сбое. */
export function shouldAttemptCdrPreviewOnSave(_folderPath, fileName) {
  return Boolean(String(fileName || '').trim());
}

/**
 * Предупреждение после сохранения задачи: задача записана, превью — нет.
 * @param {string} detail — уже локализованная причина
 */
export function formatCdrPreviewPostSaveWarning(detail) {
  const message = String(detail || '').trim();
  if (!message) {
    return 'Задача сохранена, но превью не получено';
  }

  if (isAgentUnavailableWarning(message)) {
    return message;
  }

  if (isFileNotFoundDetail(message)) {
    if (/файл по пути/i.test(message)) return message;
    return formatFileNotFoundByPath(extractFilePathFromErrorMessage(message));
  }

  if (
    /превью не найдено/i.test(message)
    || /в zip нет превью/i.test(message)
    || /zip ошибка/i.test(message)
    || /не удалось извлечь/i.test(message)
  ) {
    return `Задача сохранена, но не удалось извлечь превью из .cdr.\n\n${message}`;
  }

  if (
    /сохранить превью|превью не записано|базе данных/i.test(message)
    || /превью слишком большое|пустой файл превью|файл превью не передан/i.test(message)
  ) {
    return `Задача сохранена, но превью не записано в базу.\n\n${message}`;
  }

  if (/превью строится только для \.cdr/i.test(message)) {
    return `Задача сохранена, но превью недоступно.\n\n${message}`;
  }

  return `Задача сохранена, но превью не получено.\n\n${message}`;
}

/** Человекочитаемая ошибка сохранения превью в БД. */
export function formatCdrPreviewPersistError(rawMessage) {
  const message = String(rawMessage || '').trim();
  if (!message) return 'Не удалось сохранить превью в базе данных';

  const known = [
    'Превью слишком большое',
    'Пустой файл превью',
    'Задача не найдена',
    'Файл превью не передан',
  ];
  if (known.some((text) => message.includes(text))) {
    return message;
  }

  return `Не удалось сохранить превью в базе данных: ${message}`;
}
