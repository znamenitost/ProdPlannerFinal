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

/** Чтение байтов .cdr — только /read-dev (без open-dev, чтобы не открывать Corel). */
export async function readDevCdrViaAgent(absolutePath) {
  const url = `${FILE_OPENER_BASE}/read-dev?path=${encodeURIComponent(absolutePath)}`;
  const response = await fetch(url);
  const contentType = response.headers.get('content-type') || '';

  if (!response.ok) {
    const text = (await response.text().catch(() => '')).trim();
    throw new Error(text || `HTTP ${response.status}`);
  }
  if (!contentType.includes('octet-stream')) {
    throw new Error('Агент не вернул файл (нужен эндпоинт /read-dev)');
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.length === 0) {
    throw new Error('Пустой ответ агента');
  }
  return bytes;
}
