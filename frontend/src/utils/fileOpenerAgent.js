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
  return response.ok;
}
