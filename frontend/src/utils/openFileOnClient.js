import { detectClientPlatform } from './filePathForOpen';

function buildLaunchUrl(relativePath) {
  const params = new URLSearchParams({
    path: relativePath,
    clientPlatform: detectClientPlatform()
  });
  return `/api/files/launch?${params.toString()}`;
}

/** Скрытый iframe — не перезагружает вкладку приложения. */
function triggerLaunch(launchUrl) {
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;width:0;height:0;border:0;visibility:hidden';
  iframe.src = launchUrl;
  document.body.appendChild(iframe);
  window.setTimeout(() => {
    try {
      document.body.removeChild(iframe);
    } catch {
      /* noop */
    }
  }, 20000);
  return true;
}

export function openFileOnClient(relativePath) {
  if (!relativePath || relativePath === '/') {
    return { ok: false, reason: 'no-path' };
  }
  return { ok: triggerLaunch(buildLaunchUrl(relativePath)), method: 'launch' };
}
