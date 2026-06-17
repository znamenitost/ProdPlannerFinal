import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import JSZip from 'jszip';
import { extractCdrPreview } from '../src/utils/cdrPreview.js';

function makeBmpBytes(size = 1100) {
  const bmp = new Uint8Array(size);
  bmp[0] = 0x42;
  bmp[1] = 0x4d;
  new DataView(bmp.buffer).setInt32(2, size, true);
  return bmp;
}

function makeRiffWithBmpAtOffset(bmpOffset = 112) {
  const bmp = makeBmpBytes();
  const riff = new Uint8Array(bmpOffset + bmp.length + 4);
  riff.set([0x52, 0x49, 0x46, 0x46], 0);
  new DataView(riff.buffer).setUint32(4, riff.length - 8, true);
  riff.set([0x43, 0x44, 0x52, 0x39], 8);
  riff.set(bmp, bmpOffset);
  return riff;
}

async function zipBytes(files) {
  const zip = new JSZip();
  for (const [name, data] of files) {
    zip.file(name, data);
  }
  return zip.generateAsync({ type: 'uint8array' });
}

describe('cdrPreview ZIP extraction', () => {
  it('keeps priority for metadata/thumbnails/thumbnail.bmp', async () => {
    const preferred = makeBmpBytes(1200);
    const bytes = await zipBytes([
      ['metadata/thumbnails/thumbnail.bmp', preferred],
      ['content/riffData.cdr', makeRiffWithBmpAtOffset()]
    ]);

    const result = await extractCdrPreview(bytes);
    assert.equal(result.ok, true);
    assert.match(result.method, /metadata\/thumbnails\/thumbnail\.bmp/i);
  });

  it('matches wider previews/pageN.png paths', async () => {
    const bytes = await zipBytes([
      ['previews/page2.png', makeBmpBytes(1100)]
    ]);

    const result = await extractCdrPreview(bytes);
    assert.equal(result.ok, true);
    assert.match(result.method, /previews\/page2\.png/i);
  });

  it('normalizes backslash zip entry names', async () => {
    const bytes = await zipBytes([
      ['metadata\\thumbnails\\thumbnail.bmp', makeBmpBytes(1150)]
    ]);

    const result = await extractCdrPreview(bytes);
    assert.equal(result.ok, true);
    assert.match(result.method, /thumbnail\.bmp/i);
  });

  it('falls back to DISP/BMP inside content/riffData.cdr', async () => {
    const bytes = await zipBytes([
      ['content/riffData.cdr', makeRiffWithBmpAtOffset()]
    ]);

    const result = await extractCdrPreview(bytes);
    assert.equal(result.ok, true);
    assert.match(result.method, /content\/riffData\.cdr/i);
    assert.match(result.method, /BM scan/i);
  });

  it('falls back to content/root.dat when riffData is absent', async () => {
    const bytes = await zipBytes([
      ['content/root.dat', makeRiffWithBmpAtOffset()]
    ]);

    const result = await extractCdrPreview(bytes);
    assert.equal(result.ok, true);
    assert.match(result.method, /content\/root\.dat/i);
  });
});
