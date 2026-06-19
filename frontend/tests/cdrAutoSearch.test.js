import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('cdrAutoSearch first-attempt warnings', () => {
  it('formats file-not-found warning for post-save autopsearch', async () => {
    const { formatCdrPreviewPostSaveWarning } = await import('../src/utils/cdrPreviewErrors.js');

    const warning = formatCdrPreviewPostSaveWarning(
      'Файл или папка не найдены. Проверьте путь к папке и имя файла в задаче.\n\nФайл: \\\\MINIMARKER\\Клиенты\\Ф\\test.cdr'
    );

    assert.match(warning, /сохранена/i);
    assert.match(warning, /файл не найден/i);
  });
});
