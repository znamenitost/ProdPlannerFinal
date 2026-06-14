import { detectClientPlatform } from './filePathForOpen';
import { openFileViaAgent } from './fileOpenerAgent';

function buildLaunchUrl(relativePath) {
  const params = new URLSearchParams({
    path: relativePath,
    clientPlatform: detectClientPlatform()
  });
  return `/api/files/launch?${params.toString()}`;
}

/**
 * Windows: netopen через скрытый iframe (без лишней вкладки с текстом «нажмите сюда»).
 */
function triggerLaunchOnWindows(launchUrl) {
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'display:none;width:0;height:0;border:0';
  iframe.setAttribute('aria-hidden', 'true');
  iframe.src = launchUrl;
  document.body.appendChild(iframe);
  window.setTimeout(() => iframe.remove(), 10_000);
  return true;
}

/** macOS Safari не открывает smb:// из iframe — отдельная вкладка. */
function triggerLaunchViaWindow(launchUrl) {
  const opened = window.open(launchUrl, '_blank');
  if (opened) return true;
  window.location.assign(launchUrl);
  return true;
}

export async function openFileOnClient(relativePath, options = {}) {
  if (!relativePath || relativePath === '/') {
    return { ok: false, reason: 'no-path' };
  }

  const platform = detectClientPlatform();

  if (platform === 'Win32') {
    try {
      const agentResult = await openFileViaAgent(relativePath);
      if (agentResult.ok) {
        return { ok: true, method: 'agent' };
      }
    } catch {
      // агент недоступен — fallback на netopen ниже
    }
  }

  const launchUrl = buildLaunchUrl(relativePath);
  const ok = platform === 'mac'
    ? triggerLaunchViaWindow(launchUrl)
    : triggerLaunchOnWindows(launchUrl);

  return { ok, method: 'launch' };
}
