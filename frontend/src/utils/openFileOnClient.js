import { detectClientPlatform } from './filePathForOpen';

function buildLaunchUrl(relativePath) {
  const params = new URLSearchParams({
    path: relativePath,
    clientPlatform: detectClientPlatform()
  });
  return `/api/files/launch?${params.toString()}`;
}

/**
 * Windows: открываем лаунчер-страницу с netopen:// в новой вкладке.
 * Новая вкладка открыта из user gesture (клика), поэтому location.replace(netopen://) разрешён.
 */
function triggerLaunchOnWindows(launchUrl) {
  window.open(launchUrl, '_blank', 'noopener,noreferrer');
  return true;
}

/** macOS Safari не открывает smb:// из iframe — отдельная вкладка. */
function triggerLaunchViaWindow(launchUrl) {
  const opened = window.open(launchUrl, '_blank');
  if (opened) return true;
  window.location.assign(launchUrl);
  return true;
}

export function openFileOnClient(relativePath) {
  if (!relativePath || relativePath === '/') {
    return { ok: false, reason: 'no-path' };
  }

  const launchUrl = buildLaunchUrl(relativePath);
  const platform = detectClientPlatform();
  const ok = platform === 'mac'
    ? triggerLaunchViaWindow(launchUrl)
    : triggerLaunchOnWindows(launchUrl);

  return { ok, method: 'launch' };
}
