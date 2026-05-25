import { detectClientPlatform } from './filePathForOpen';

function buildLaunchUrl(relativePath) {
  const params = new URLSearchParams({
    path: relativePath,
    clientPlatform: detectClientPlatform()
  });
  return `/api/files/launch?${params.toString()}`;
}

/** Новая вкладка: Safari/macOS не открывает smb:// из скрытого iframe. */
function triggerLaunch(launchUrl) {
  const opened = window.open(launchUrl, '_blank', 'noopener,noreferrer');
  if (opened) return true;
  window.location.assign(launchUrl);
  return true;
}

export function openFileOnClient(relativePath) {
  if (!relativePath || relativePath === '/') {
    return { ok: false, reason: 'no-path' };
  }
  return { ok: triggerLaunch(buildLaunchUrl(relativePath)), method: 'launch' };
}
