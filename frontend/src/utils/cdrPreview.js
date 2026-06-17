import JSZip from 'jszip';

/** Приоритет: точные пути Corel, затем более широкие шаблоны. */
const ZIP_PREVIEW_PATTERNS = [
  /^previews\/thumbnail\.png$/i,
  /^metadata\/thumbnails\/thumbnail\.bmp$/i,
  /^previews\/thumbnail\.bmp$/i,
  /^metadata\/thumbnails\/thumbnail\.png$/i,
  /^previews\/page1\.png$/i,
  /^metadata\/thumbnails\/page1\.bmp$/i,
  /thumbnail.*\.(png|bmp|jpg|jpeg|webp)$/i,
  /^previews\/page\d+\.(png|bmp|jpg|jpeg|webp)$/i,
  /^metadata\/thumbnails\/page\d+\.(bmp|png|jpg|jpeg|webp)$/i,
  /^previews\/[^/]+\.(png|bmp|jpg|jpeg|webp)$/i,
  /^metadata\/thumbnails\/[^/]+\.(bmp|png|jpg|jpeg|webp)$/i
];

const ZIP_RIFF_FALLBACK_PATTERNS = [
  /^content\/riffData\.cdr$/i,
  /^content\/root\.dat$/i
];

const MIN_ZIP_PREVIEW_BYTES = 100;

function normalizeZipName(name) {
  return String(name || '').replace(/\\/g, '/').replace(/^\/+/, '');
}

function zipEntryNames(zip) {
  return Object.keys(zip.files).filter((n) => !zip.files[n].dir);
}

function findZipEntryName(names, pattern) {
  return names.find((name) => pattern.test(normalizeZipName(name)));
}

function isRiffBytes(bytes) {
  return bytes.length >= 4
    && bytes[0] === 0x52
    && bytes[1] === 0x49
    && bytes[2] === 0x46
    && bytes[3] === 0x46;
}

function readU32(view, offset) {
  return view.getUint32(offset, true);
}

function imageMime(data) {
  if (data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47) return 'image/png';
  if (data[0] === 0x42 && data[1] === 0x4d) return 'image/bmp';
  if (data[0] === 0xff && data[1] === 0xd8) return 'image/jpeg';
  if (data[0] === 0x52 && data[1] === 0x49 && data[2] === 0x46 && data[3] === 0x46
    && data[8] === 0x57 && data[9] === 0x45 && data[10] === 0x42 && data[11] === 0x50) {
    return 'image/webp';
  }
  return 'application/octet-stream';
}

function findBmpInBuffer(bytes, maxScan) {
  const limit = Math.min(maxScan ?? bytes.length, bytes.length);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let i = 0; i < limit - 6; i += 1) {
    if (bytes[i] === 0x42 && bytes[i + 1] === 0x4d) {
      const size = view.getInt32(i + 2, true);
      if (size > 1000 && size < bytes.length - i) {
        return { data: bytes.slice(i, i + size), method: `BM scan @ offset ${i}, ${size} bytes` };
      }
    }
  }
  return null;
}

function extractFromDisp(bytes) {
  if (bytes.length < 12) return null;
  if (bytes[0] !== 0x52 || bytes[1] !== 0x49 || bytes[2] !== 0x46 || bytes[3] !== 0x46) return null;

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let offset = 12;

  while (offset + 8 <= bytes.length) {
    const id = String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
    const size = readU32(view, offset + 4);
    const dataStart = offset + 8;
    const dataEnd = dataStart + size;

    if (id === 'DISP' && dataEnd <= bytes.length && size > 44) {
      const w = readU32(view, dataStart + 8);
      const h = readU32(view, dataStart + 12);
      const paletteStart = dataStart + 8 + 4 + 4 + 28;
      const pixelsStart = paletteStart + 1024;

      if (w > 0 && h > 0 && w < 4096 && h < 4096 && pixelsStart + w * h <= dataEnd) {
        const rgba = new Uint8ClampedArray(w * h * 4);
        for (let p = 0; p < w * h; p += 1) {
          const idx = bytes[pixelsStart + p] * 4;
          const o = p * 4;
          rgba[o] = bytes[paletteStart + idx + 2];
          rgba[o + 1] = bytes[paletteStart + idx + 1];
          rgba[o + 2] = bytes[paletteStart + idx];
          rgba[o + 3] = 255;
        }

        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        canvas.getContext('2d').putImageData(new ImageData(rgba, w, h), 0, 0);

        return {
          canvas,
          method: `RIFF DISP chunk ${w}×${h}`
        };
      }
    }

    offset = dataEnd + (size % 2);
    if (offset <= 12) break;
  }

  return null;
}

function previewFromRiffBytes(bytes, sourceLabel) {
  const disp = extractFromDisp(bytes);
  if (disp) {
    return { canvas: disp.canvas, method: `ZIP ${sourceLabel}: ${disp.method}` };
  }

  const bmp = findBmpInBuffer(bytes, 256 * 1024);
  if (bmp) {
    return { data: bmp.data, method: `ZIP ${sourceLabel}: ${bmp.method}` };
  }

  return null;
}

async function readZipImageEntry(zip, entryName) {
  const data = await zip.file(entryName).async('uint8array');
  if (!data || data.length < MIN_ZIP_PREVIEW_BYTES) return null;
  return data;
}

async function fromZipImageEntries(zip, names) {
  for (const pattern of ZIP_PREVIEW_PATTERNS) {
    const name = findZipEntryName(names, pattern);
    if (!name) continue;
    const data = await readZipImageEntry(zip, name);
    if (data) {
      return { data, method: `ZIP: ${normalizeZipName(name)} (${data.length} bytes)` };
    }
  }
  return null;
}

async function fromZipInnerRiff(zip, names) {
  for (const pattern of ZIP_RIFF_FALLBACK_PATTERNS) {
    const name = findZipEntryName(names, pattern);
    if (!name) continue;

    const data = await zip.file(name).async('uint8array');
    if (!data?.length || !isRiffBytes(data)) continue;

    const preview = previewFromRiffBytes(data, normalizeZipName(name));
    if (preview) return preview;
  }

  return null;
}

async function fromZip(bytes) {
  const zip = await JSZip.loadAsync(bytes);
  const names = zipEntryNames(zip);

  const imagePreview = await fromZipImageEntries(zip, names);
  if (imagePreview) return imagePreview;

  const riffPreview = await fromZipInnerRiff(zip, names);
  if (riffPreview) return riffPreview;

  return {
    error: `В ZIP нет превью. Записи:\n${names.map(normalizeZipName).join('\n')}`
  };
}

function previewUrlFromBytes(data) {
  const mime = imageMime(data);
  const blob = new Blob([data], { type: mime });
  return { url: URL.createObjectURL(blob), method: `Тип: ${mime}` };
}

function previewUrlFromCanvas(canvas, method) {
  return { url: canvas.toDataURL('image/png'), method };
}

/** @returns {Promise<{ ok: true, url: string, method: string } | { ok: false, error: string }>} */
export async function extractCdrPreview(bytes) {
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    try {
      const zipResult = await fromZip(bytes);
      if (zipResult.data) {
        const { url, method } = previewUrlFromBytes(zipResult.data);
        return { ok: true, url, method: zipResult.method };
      }
      if (zipResult.canvas) {
        const { url, method } = previewUrlFromCanvas(zipResult.canvas, zipResult.method);
        return { ok: true, url, method: zipResult.method };
      }
      return { ok: false, error: zipResult.error || 'Превью в ZIP не найдено' };
    } catch (err) {
      return { ok: false, error: `ZIP ошибка: ${err.message}` };
    }
  }

  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) {
    const disp = extractFromDisp(bytes);
    if (disp) {
      const { url, method } = previewUrlFromCanvas(disp.canvas, disp.method);
      return { ok: true, url, method: disp.method };
    }

    const bmp = findBmpInBuffer(bytes, 256 * 1024);
    if (bmp) {
      const { url, method } = previewUrlFromBytes(bmp.data);
      return { ok: true, url, method: `${bmp.method}\n${method}` };
    }
  } else {
    const bmp = findBmpInBuffer(bytes, 256 * 1024);
    if (bmp) {
      const { url, method } = previewUrlFromBytes(bmp.data);
      return { ok: true, url, method: `${bmp.method}\n${method}` };
    }
  }

  return { ok: false, error: 'Превью не найдено' };
}
