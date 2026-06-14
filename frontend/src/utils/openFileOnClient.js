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
 * @returns {{ ok: boolean, reason?: string }}
 */
export function triggerLaunch(launchUrl, platform) {
  const opened = window.open(launchUrl, '_blank');
  if (opened) return { ok: true };

  if (platform === 'mac') {
    window.location.assign(launchUrl);
    return { ok: true };
  }

  return {
    ok: false,
    reason: 'Браузер заблокировал открытие файла. Разрешите всплывающие окна для этого сайта.'
  };
}

export async function openFileOnClient(relativePath) {
  if (!relativePath || relativePath === '/') {
    return { ok: false, reason: 'Путь к файлу не указан' };
  }

  const platform = detectClientPlatform();
  const launchUrl = buildLaunchUrl(relativePath);

  let agentError = null;
  let agentUncPath = null;

  if (platform === 'Win32') {
    try {
      const agentResult = await openFileViaAgent(relativePath);
      if (agentResult.ok) {
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
    return { ok: false, reason: 'Открытие файла не поддерживается на этой платформе' };
  }

  const preflight = await preflightLaunchUrl(launchUrl);
  if (!preflight.ok) {
    return {
      ok: false,
      reason: formatOpenFileCombinedError(agentError, agentUncPath, preflight.reason)
    };
  }

  const launch = triggerLaunch(launchUrl, platform);
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
