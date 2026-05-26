import { detectClientPlatform } from './filePathForOpen';

function buildLaunchUrl(relativePath) {
  const params = new URLSearchParams({
    path: relativePath,
    clientPlatform: detectClientPlatform()
  });
  return `/api/files/launch?${params.toString()}`;
}

/**
 * Windows: навигация из клика (user gesture) → /api/files/launch → 302 netopen://.
 * Iframe + HTML с location.replace блокируется Chrome («user gesture is required»).
 */
function triggerLaunchOnWindows(launchUrl) {
  const link = document.createElement('a');
  link.href = launchUrl;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
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
