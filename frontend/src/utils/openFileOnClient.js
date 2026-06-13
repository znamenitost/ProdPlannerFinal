import { detectClientPlatform } from './filePathForOpen';
import { openFileViaAgent, openDevFileViaAgent } from './fileOpenerAgent';
import { buildDevLocalFullPath, DEV_CDR_PREVIEW_ENABLED } from './devCdrPreviewConfig';

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

  if (DEV_CDR_PREVIEW_ENABLED && options.folderPath != null && options.fileName != null) {
    const devPath = buildDevLocalFullPath(options.folderPath, options.fileName);
    if (devPath && platform === 'Win32') {
      try {
        const result = await openDevFileViaAgent(devPath);
        if (result.ok) {
          return { ok: true, method: 'agent-dev' };
        }
        return { ok: false, reason: result.text || 'open-dev-failed' };
      } catch (err) {
        return { ok: false, reason: err?.message || 'open-dev-failed' };
      }
    }
  }

  if (platform === 'Win32') {
    try {
      const openedViaAgent = await openFileViaAgent(relativePath);
      if (openedViaAgent) {
        return { ok: true, method: 'agent' };
      }
    } catch {
      // fallback to netopen below
    }
  }

  const launchUrl = buildLaunchUrl(relativePath);
  const ok = platform === 'mac'
    ? triggerLaunchViaWindow(launchUrl)
    : triggerLaunchOnWindows(launchUrl);

  return { ok, method: 'launch' };
}
