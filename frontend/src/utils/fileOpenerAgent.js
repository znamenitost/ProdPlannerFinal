import { detectClientPlatform } from './filePathForOpen';

export const FILE_OPENER_PORT = 17888;
export const FILE_OPENER_BASE = `http://127.0.0.1:${FILE_OPENER_PORT}`;

/** Временный путь для dev-теста на Windows VM. String.raw — иначе \0 в исходнике даёт NUL-символ. */
export const DEV_TEST_CDR_PATH = String.raw`C:\0.cdr`;

const DEFAULT_WINDOWS_HOST = 'MINIMARKER';
const DEFAULT_SHARE = 'Клиенты';

export function buildWindowsUncPath(
  relativePath,
  host = DEFAULT_WINDOWS_HOST,
  shareName = DEFAULT_SHARE
) {
  const path = String(relativePath || '').replace(/\//g, '\\').replace(/^\\+/, '');
  return `\\\\${host}\\${shareName}\\${path}`;
}

export async function isFileOpenerAgentRunning(timeoutMs = 800) {
  if (detectClientPlatform() !== 'Win32') return false;
  try {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(`${FILE_OPENER_BASE}/health`, {
      signal: controller.signal
    });
    window.clearTimeout(timer);
    return response.ok;
  } catch {
    return false;
  }
}

/** Есть ли в агенте эндпоинт /open-dev (без path вернёт 400, не 404). */
export async function isFileOpenerDevOpenSupported(timeoutMs = 800) {
  if (detectClientPlatform() !== 'Win32') return false;
  try {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(`${FILE_OPENER_BASE}/open-dev`, {
      signal: controller.signal
    });
    window.clearTimeout(timer);
    const text = await response.text();
    return response.status === 400 && text === 'missing path';
  } catch {
    return false;
  }
}

export async function openFileViaAgent(relativePath) {
  const uncPath = buildWindowsUncPath(relativePath);
  const url = `${FILE_OPENER_BASE}/open?path=${encodeURIComponent(uncPath)}`;
  const response = await fetch(url);
  return response.ok;
}

export async function openDevFileViaAgent(absolutePath) {
  const url = `${FILE_OPENER_BASE}/open-dev?path=${encodeURIComponent(absolutePath)}`;
  const response = await fetch(url);
  const text = await response.text();
  return { ok: response.ok, status: response.status, text };
}

let cachedCapabilities = null;

async function fetchFileOpenerCapabilities(timeoutMs = 800) {
  if (cachedCapabilities) return cachedCapabilities;
  if (detectClientPlatform() !== 'Win32') return [];

  try {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeoutMs);
    const response = await fetch(`${FILE_OPENER_BASE}/capabilities`, {
      signal: controller.signal
    });
    window.clearTimeout(timer);
    if (!response.ok) {
      cachedCapabilities = [];
      return cachedCapabilities;
    }
    const text = await response.text();
    cachedCapabilities = text.split(',').map((part) => part.trim()).filter(Boolean);
    return cachedCapabilities;
  } catch {
    cachedCapabilities = [];
    return cachedCapabilities;
  }
}

/** Чтение байтов .cdr через агент (без запуска Corel). */
export async function readDevCdrViaAgent(absolutePath) {
  const caps = await fetchFileOpenerCapabilities();
  const encodedPath = encodeURIComponent(absolutePath);
  const urls = [];

  if (caps.includes('read-on-open-dev')) {
    urls.push(`${FILE_OPENER_BASE}/open-dev?read=1&path=${encodedPath}`);
  }
  if (caps.includes('read-dev')) {
    urls.push(`${FILE_OPENER_BASE}/read-dev?path=${encodedPath}`);
  }

  if (urls.length === 0) {
    throw new Error(
      'Агент устарел: нет чтения для превью. Меню → Скачать агент → install.bat (от администратора).'
    );
  }

  let lastError = 'Не удалось прочитать файл';
  for (const url of urls) {
    try {
      const response = await fetch(url);
      const contentType = response.headers.get('content-type') || '';
      if (!response.ok) {
        const text = (await response.text().catch(() => '')).trim();
        lastError = text || `HTTP ${response.status}`;
        continue;
      }
      if (!contentType.includes('octet-stream')) {
        lastError = 'Агент не вернул файл — обновите через install.bat';
        continue;
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length > 0) return bytes;
      lastError = 'Пустой ответ агента';
    } catch (err) {
      lastError = err?.message || lastError;
    }
  }

  throw new Error(lastError);
}

export async function isFileOpenerDevReadSupported(timeoutMs = 800) {
  const caps = await fetchFileOpenerCapabilities(timeoutMs);
  return caps.includes('read-on-open-dev') || caps.includes('read-dev');
}
