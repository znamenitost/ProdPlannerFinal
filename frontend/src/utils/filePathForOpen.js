const DEFAULT_SHARE = 'Клиенты';

export function normalizePathForOpen(folderPath, fileName, shareName = DEFAULT_SHARE) {
  let raw = `${folderPath || ''}/${fileName || ''}`.replace(/\\/g, '/');
  while (raw.includes('//')) raw = raw.replace('//', '/');
  raw = raw.trim().replace(/^[A-Za-z]:/i, '').replace(/^\/+/, '');

  const marker = `${shareName}/`;
  const idx = raw.toLowerCase().indexOf(marker.toLowerCase());
  if (idx >= 0) raw = raw.slice(idx + marker.length);

  return raw.replace(/^\/+/, '').replace(/\/+$/, '');
}

export function detectClientPlatform() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  const platform = typeof navigator !== 'undefined' ? navigator.platform || '' : '';
  if (/Windows/i.test(ua) || /^Win/i.test(platform)) return 'Win32';
  if (/Mac|iPhone|iPad|iPod/i.test(ua)) return 'mac';
  return 'other';
}
