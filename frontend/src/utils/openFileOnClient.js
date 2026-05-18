/**
 * Открытие файла на компьютере пользователя: /api/files/launch → smb:// или netopen://
 */
function buildLaunchUrl(relativePath) {
  const platform =
    typeof navigator !== 'undefined' ? (navigator.userAgent || navigator.platform || '') : '';
  const params = new URLSearchParams({
    path: relativePath,
    clientPlatform: platform
  });
  return `/api/files/launch?${params.toString()}`;
}

function triggerLaunch(launchUrl) {
  const link = document.createElement('a');
  link.href = launchUrl;
  link.style.display = 'none';
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  return true;
}

/** @param {string} relativePath например С/Спортмебель/15,05,26 спортт.cdr */
export function openFileOnClient(relativePath) {
  if (!relativePath || relativePath === '/') {
    return { ok: false, reason: 'no-path' };
  }
  return { ok: triggerLaunch(buildLaunchUrl(relativePath)), method: 'launch' };
}
