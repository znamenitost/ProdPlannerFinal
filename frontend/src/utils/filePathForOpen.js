const DEFAULT_SHARE = 'Клиенты';

function stripShareRelativeFolder(folderPath, shareName = DEFAULT_SHARE) {
  let raw = String(folderPath || '').replace(/\\/g, '/').trim();
  raw = raw.replace(/^[A-Za-z]:/i, '').replace(/^\/+/, '');

  const marker = `${shareName}/`;
  const idx = raw.toLowerCase().indexOf(marker.toLowerCase());
  if (idx >= 0) raw = raw.slice(idx + marker.length);

  return raw.replace(/^\/+|\/+$/g, '');
}

/** Однобуквенный сегмент после «Клиенты» (Ф, С, …). */
export function isClientLetterSegment(segment) {
  return Boolean(segment && segment.length === 1 && /\p{L}/u.test(segment));
}

/**
 * Дополняет путь буквой-каталогом, если указан без корня «Клиенты/БУКВА/».
 * Буква берётся из первой буквы папки в задаче (например «Федерация…» → «Ф»).
 */
export function ensureClientLetterPrefix(relativePath, folderPathHint = '') {
  const parts = String(relativePath || '').split('/').filter(Boolean);
  if (parts.length === 0) return '';

  if (isClientLetterSegment(parts[0])) {
    return parts.join('/');
  }

  const folderOnly = String(folderPathHint || '').trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
    || (parts.length > 1 ? parts.slice(0, -1).join('/') : '');

  if (!folderOnly && parts.length === 1) {
    return parts.join('/');
  }

  const letterSource = folderOnly || parts[0];
  const letter = letterSource.match(/\p{L}/u)?.[0];
  if (!letter) return parts.join('/');

  return `${letter}/${parts.join('/')}`;
}

/** Как на бэкенде (FilePathNormalizer): .cdr, .ai, .pdf, .eps — иначе дописываем .cdr. */
export function hasSupportedOpenExtension(fileName) {
  const name = String(fileName || '').split('[')[0].trim();
  return /\.(cdr|ai|pdf|eps)$/i.test(name);
}

export function ensureSupportedFileExtension(fileName) {
  const clean = String(fileName || '').split('[')[0].trim();
  if (!clean) return '';
  if (hasSupportedOpenExtension(clean)) return clean;
  return `${clean}.cdr`;
}

export function normalizePathForOpen(folderPath, fileName, shareName = DEFAULT_SHARE) {
  let raw = `${folderPath || ''}/${fileName || ''}`.replace(/\\/g, '/');
  while (raw.includes('//')) raw = raw.replace('//', '/');
  raw = raw.trim().replace(/^[A-Za-z]:/i, '').replace(/^\/+/, '');

  const marker = `${shareName}/`;
  const idx = raw.toLowerCase().indexOf(marker.toLowerCase());
  if (idx >= 0) raw = raw.slice(idx + marker.length);

  const trimmed = raw.replace(/^\/+/, '').replace(/\/+$/, '');
  if (!trimmed) return '';

  const parts = trimmed.split('/').filter(Boolean);
  if (parts.length === 0) return '';

  parts[parts.length - 1] = ensureSupportedFileExtension(parts[parts.length - 1]);
  const withExtension = parts.join('/');

  return ensureClientLetterPrefix(withExtension, stripShareRelativeFolder(folderPath, shareName));
}

export function detectClientPlatform() {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';
  const platform = typeof navigator !== 'undefined' ? navigator.platform || '' : '';
  if (/Windows/i.test(ua) || /^Win/i.test(platform)) return 'Win32';
  if (/Mac|iPhone|iPad|iPod/i.test(ua)) return 'mac';
  return 'other';
}
