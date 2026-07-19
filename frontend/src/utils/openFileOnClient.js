import { detectClientPlatform } from './filePathForOpen';
import { openFileViaAgent } from './fileOpenerAgent';
import {
  formatOpenFileCombinedError,
  formatFileOpenError,
  shouldTryNetopenAfterAgentFailure
} from './cdrPreviewErrors';

/** Получить netopen/smb URL с сервера (без HTML-страницы launch). */
export async function resolveOpenUrl(relativePath, { isDirectory = false } = {}) {
  try {
    const response = await fetch('/api/files/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        filePath: relativePath,
        clientPlatform: detectClientPlatform(),
        isDirectory
      })
    });

    if (!response.ok) {
      const text = (await response.text().catch(() => '')).trim();
      try {
        const body = JSON.parse(text);
        return {
          ok: false,
          reason: body?.message || text || (isDirectory
            ? 'Не удалось сформировать ссылку на папку'
            : 'Не удалось сформировать ссылку на файл')
        };
      } catch {
        return {
          ok: false,
          reason: text || (isDirectory
            ? 'Не удалось сформировать ссылку на папку'
            : 'Не удалось сформировать ссылку на файл')
        };
      }
    }

    const data = await response.json();
    if (!data?.openUrl) {
      return {
        ok: false,
        reason: isDirectory
          ? 'Не удалось сформировать ссылку на папку'
          : 'Не удалось сформировать ссылку на файл'
      };
    }

    return { ok: true, openUrl: data.openUrl };
  } catch (err) {
    return {
      ok: false,
      reason: err?.message || (isDirectory ? 'Не удалось открыть папку' : 'Не удалось открыть файл')
    };
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

function shouldFallbackToLaunch(agentError, isDirectory) {
  if (shouldTryNetopenAfterAgentFailure(agentError)) return true;
  // Старый агент отклоняет папки («path not allowed») — пробуем netopen/smb.
  if (isDirectory && /path not allowed/i.test(String(agentError || ''))) return true;
  return false;
}

export async function openFileOnClient(relativePath, { isDirectory = false } = {}) {
  if (!relativePath || relativePath === '/') {
    return {
      ok: false,
      reason: isDirectory ? 'Путь к папке не указан' : 'Путь к файлу не указан'
    };
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

    if (agentError && !shouldFallbackToLaunch(agentError, isDirectory)) {
      return { ok: false, reason: formatFileOpenError(agentError, agentUncPath) };
    }
  }

  const tryLaunch = platform === 'mac' || (platform === 'Win32' && agentError);
  if (!tryLaunch) {
    return {
      ok: false,
      reason: isDirectory
        ? 'Открытие папки не поддерживается на этой платформе'
        : 'Открытие файла не поддерживается на этой платформе'
    };
  }

  const resolved = await resolveOpenUrl(relativePath, { isDirectory });
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

export async function openFolderOnClient(relativePath) {
  return openFileOnClient(relativePath, { isDirectory: true });
}
