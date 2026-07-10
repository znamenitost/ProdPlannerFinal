const IMAGE_EXTENSIONS = new Set([
  'jpg',
  'jpeg',
  'png',
  'gif',
  'webp',
  'bmp',
  'svg',
  'avif',
  'heic',
  'heif'
]);

/**
 * Detect previewable chat images by MIME and/or common file extensions.
 */
export function isChatImageAttachment(mediaType, fileName) {
  const mime = String(mediaType || '').toLowerCase();
  if (mime.startsWith('image/')) return true;

  const name = String(fileName || '');
  const dot = name.lastIndexOf('.');
  if (dot < 0 || dot === name.length - 1) return false;
  const ext = name.slice(dot + 1).toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
}
