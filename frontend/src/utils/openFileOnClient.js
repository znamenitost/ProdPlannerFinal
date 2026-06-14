import { detectClientPlatform } from './filePathForOpen';
import { openFileViaAgent } from './fileOpenerAgent';
import {
  formatOpenFileCombinedError,
  isFileNotFoundAgentError
} from './cdrPreviewErrors';

function buildLaunchUrl(relativePath) {
  const params = new URLSearchParams({
    path: relativePath,
    clientPlatform: detectClientPlatform()
  });
  return `/api/files/launch?${params.toString()}`;
}

/** Проверка, что сервер собрал ссылку netopen/smb (без запуска протокола). */
export async function preflightLaunchUrl(launchUrl) {
  try {
    const response = await fetch(launchUrl, { credentials: 'include', redirect: 'manual' });
    if (response.status === 400) {
      const text = (await response.text().catch(() => '')).trim();
      try {
        const body = JSON.parse(text);
        return { ok: false, reason: body?.message || text || 'Не удалось сформировать ссылку на файл' };
      } catch {
        return { ok: false, reason: text || 'Не удалось сформировать ссылку на файл' };
      }
    }
    if (response.status >= 200 && response.status < 400) {
      return { ok: true };
    }
    return { ok: false, reason: `Не удалось открыть файл (HTTP ${response.status})` };
  } catch (err) {
    return { ok: false, reason: err?.message || 'Не удалось открыть файл' };
  }
}

/**
 * Синхронно резервирует вкладку, пока жив user gesture — иначе netopen блокируется браузером.
 */
export function reserveLaunchWindow(platform) {
  if (platform !== 'Win32' && platform !== 'mac') return null;
  try {
    return window.open('about:blank', '_blank', 'noopener,noreferrer');
  } catch {
    return null;
  }
}

function triggerLaunchViaWindow(launchUrl) {
  const opened = window.open(launchUrl, '_blank');
  if (opened) return true;
  window.location.assign(launchUrl);
  return true;
}

/**
 * @returns {{ ok: boolean, reason?: string }}
 */
export function triggerLaunch(launchUrl, platform, reservedWindow) {
  if (reservedWindow && !reservedWindow.closed) {
    try {
      reservedWindow.location.href = launchUrl;
      return { ok: true };
    } catch {
      try {
        reservedWindow.close();
      } catch {
        /* ignore */
      }
    }
  }

  if (platform === 'mac') {
    return triggerLaunchViaWindow(launchUrl)
      ? { ok: true }
      : { ok: false, reason: 'Браузер заблокировал открытие файла' };
  }

  if (platform === 'Win32') {
    return {
      ok: false,
      reason: 'Браузер заблокировал окно открытия файла. Разрешите всплывающие окна для этого сайта.'
    };
  }

  return { ok: false, reason: 'Открытие файла поддерживается только на Windows и macOS' };
}

export async function openFileOnClient(relativePath, options = {}) {
  if (!relativePath || relativePath === '/') {
    return { ok: false, reason: 'Путь к файлу не указан' };
  }

  const platform = detectClientPlatform();
  const launchUrl = buildLaunchUrl(relativePath);
  const reservedWindow = options.launchWindow ?? reserveLaunchWindow(platform);

  let agentError = null;
  let agentUncPath = null;

  if (platform === 'Win32') {
    try {
      const agentResult = await openFileViaAgent(relativePath);
      if (agentResult.ok) {
        reservedWindow?.close();
        return { ok: true, method: 'agent' };
      }
      agentError = agentResult.error || 'HTTP error';
      agentUncPath = agentResult.uncPath;
    } catch (err) {
      agentError = err?.message || 'Не удалось связаться с агентом';
    }
  }

  const tryLaunch = platform === 'mac' || (platform === 'Win32' && agentError);
  if (!tryLaunch) {
    reservedWindow?.close();
    return { ok: false, reason: 'Открытие файла не поддерживается на этой платформе' };
  }

  const preflight = await preflightLaunchUrl(launchUrl);
  if (!preflight.ok) {
    reservedWindow?.close();
    return {
      ok: false,
      reason: formatOpenFileCombinedError(agentError, agentUncPath, preflight.reason)
    };
  }

  const launch = triggerLaunch(launchUrl, platform, reservedWindow);
  if (!launch.ok) {
    return {
      ok: false,
      reason: formatOpenFileCombinedError(agentError, agentUncPath, launch.reason)
    };
  }

  if (platform === 'Win32' && agentError && isFileNotFoundAgentError(agentError)) {
    return { ok: true, method: 'launch', fallback: true };
  }

  if (platform === 'Win32' && agentError) {
    return { ok: true, method: 'launch', fallback: true };
  }

  return { ok: true, method: 'launch' };
}
