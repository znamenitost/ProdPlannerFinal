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

/** Чтение байтов .cdr — только read-dev / open-dev?read=1 (без открытия Corel). */
export async function readDevCdrViaAgent(absolutePath) {
  const encodedPath = encodeURIComponent(absolutePath);
  const urls = [
    `${FILE_OPENER_BASE}/open-dev?read=1&path=${encodedPath}`,
    `${FILE_OPENER_BASE}/read-dev?path=${encodedPath}`
  ];

  let lastError = 'Не удалось прочитать файл';
  for (const url of urls) {
    try {
      const response = await fetch(url);
      const contentType = response.headers.get('content-type') || '';
      if (!response.ok) {
        lastError = (await response.text().catch(() => '')).trim() || `HTTP ${response.status}`;
        continue;
      }
      // Старый агент без read=1 отвечает text/plain «ok» и открывает файл — не принимаем.
      if (!contentType.includes('octet-stream')) {
        lastError = 'Агент не вернул файл (нужен read-dev или open-dev?read=1)';
        continue;
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.length > 0) return bytes;
    } catch (err) {
      lastError = err?.message || lastError;
    }
  }

  throw new Error(lastError);
}
