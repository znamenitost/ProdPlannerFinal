import { detectClientPlatform } from './filePathForOpen';

export const FILE_OPENER_PORT = 17888;
export const FILE_OPENER_BASE = `http://127.0.0.1:${FILE_OPENER_PORT}`;

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

export async function openFileViaAgent(relativePath) {
  const uncPath = buildWindowsUncPath(relativePath);
  const url = `${FILE_OPENER_BASE}/open?path=${encodeURIComponent(uncPath)}`;
  const response = await fetch(url);
  if (response.ok) {
    return { ok: true, uncPath };
  }
  const text = (await response.text().catch(() => '')).trim();
  return {
    ok: false,
    uncPath,
    error: text || `HTTP ${response.status}`
  };
}

/** Чтение байтов .cdr: read-dev → open-dev?read=1 (только octet-stream, без открытия Corel). */
export async function readDevCdrViaAgent(absolutePath) {
  const encodedPath = encodeURIComponent(absolutePath);
  const urls = [
    `${FILE_OPENER_BASE}/read-dev?path=${encodedPath}`,
    `${FILE_OPENER_BASE}/open-dev?read=1&path=${encodedPath}`
  ];

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
        const text = (await response.text().catch(() => '')).trim();
        lastError = text === 'ok'
          ? 'Агент открыл файл вместо чтения — переустановите из меню приложения'
          : (text || 'Агент не вернул файл');
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
