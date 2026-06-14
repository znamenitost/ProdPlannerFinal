import { detectClientPlatform } from './filePathForOpen';
import { openFileViaAgent } from './fileOpenerAgent';
import {
  formatOpenFileCombinedError,
  formatFileOpenError,
  shouldTryNetopenAfterAgentFailure
} from './cdrPreviewErrors';

/** Получить netopen/smb URL с сервера (без HTML-страницы launch). */
export async function resolveOpenUrl(relativePath) {
  try {
    const response = await fetch('/api/files/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        filePath: relativePath,
        clientPlatform: detectClientPlatform()
      })
    });

    if (!response.ok) {
      const text = (await response.text().catch(() => '')).trim();
      try {
        const body = JSON.parse(text);
        return { ok: false, reason: body?.message || text || 'Не удалось сформировать ссылку на файл' };
      } catch {
        return { ok: false, reason: text || 'Не удалось сформировать ссылку на файл' };
      }
    }

    const data = await response.json();
    if (!data?.openUrl) {
      return { ok: false, reason: 'Не удалось сформировать ссылку на файл' };
    }

    return { ok: true, openUrl: data.openUrl };
  } catch (err) {
    return { ok: false, reason: err?.message || 'Не удалось открыть файл' };
  }
}

/**
 * @returns {{ ok: boolean, reason?: string }}
 */
export function triggerLaunch(openUrl, platform) {
  const opened = window.open(openUrl, '_blank');
  if (opened) return { ok: true };

  if (platform === 'mac') {
    window.location.assign(openUrl);
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

    if (agentError && !shouldTryNetopenAfterAgentFailure(agentError)) {
      return { ok: false, reason: formatFileOpenError(agentError, agentUncPath) };
    }
  }

  const tryLaunch = platform === 'mac' || (platform === 'Win32' && agentError);
  if (!tryLaunch) {
    return { ok: false, reason: 'Открытие файла не поддерживается на этой платформе' };
  }

  const resolved = await resolveOpenUrl(relativePath);
  if (!resolved.ok) {
    return {
      ok: false,
      reason: formatOpenFileCombinedError(agentError, agentUncPath, resolved.reason)
    };
  }

  const launch = triggerLaunch(resolved.openUrl, platform);
  if (!launch.ok) {
    return {
      ok: false,
      reason: formatOpenFileCombinedError(agentError, agentUncPath, launch.reason)
    };
  }

  return { ok: true, method: 'launch' };
}
