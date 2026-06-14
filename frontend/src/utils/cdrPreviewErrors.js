import { FILE_OPENER_INSTALL_HINT } from './fileOpenerHints.js';
import { normalizePathForOpen } from './filePathForOpen.js';

const AGENT_ERROR_MESSAGES = {
  'file not found': 'Файл или папка не найдены. Проверьте путь к папке и имя файла в задаче',
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

/** Агент ответил, но файл/папка на UNC недоступны (404, off VPN и т.п.). */
export function isFileNotFoundAgentError(message) {
  const lower = String(message || '').trim().toLowerCase();
  if (lower === 'file not found') return true;
  if (lower === 'http 404') return true;
  return false;
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
      return `Файл или папка не найдены. Проверьте путь к папке и имя файла в задаче.${pathSuffix}`;
    }
    if (status === '403') return `Доступ к файлу запрещён агентом.${pathSuffix}`;
    return `Ошибка агента (HTTP ${status}).${pathSuffix}`;
  }

  const lower = message.toLowerCase();
  for (const [key, label] of Object.entries(AGENT_ERROR_MESSAGES)) {
    if (lower === key) {
      return `${label}.${pathSuffix}`;
    }
  }

  if (message.startsWith('Агент ') || message.startsWith('Пустой ')) {
    return `${message}${pathSuffix}`;
  }

  return `${message}${pathSuffix}`;
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
