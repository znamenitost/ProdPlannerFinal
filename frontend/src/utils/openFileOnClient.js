import { detectClientPlatform } from './filePathForOpen';

function buildLaunchUrl(relativePath) {
  const params = new URLSearchParams({
    path: relativePath,
    clientPlatform: detectClientPlatform()
  });
  return `/api/files/launch?${params.toString()}`;
}

/** Скрытый iframe — не перезагружает вкладку; netopen:// на Windows. */
function triggerLaunchViaIframe(launchUrl) {
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
    : triggerLaunchViaIframe(launchUrl);

  return { ok, method: 'launch' };
}
