import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('cdrAutoSearch first-attempt warnings', () => {
  it('formats file-not-found warning for post-save autopsearch', async () => {
    const { formatFileNotFoundByPath } = await import('../src/utils/cdrPreviewErrors.js');

    const warning = formatFileNotFoundByPath('\\\\MINIMARKER\\Клиенты\\Ф\\test.cdr');

    assert.equal(warning, 'Файл по пути (\\\\MINIMARKER\\Клиенты\\Ф\\test.cdr) не найден');
  });
});
