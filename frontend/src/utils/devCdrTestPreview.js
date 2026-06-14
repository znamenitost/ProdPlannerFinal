import { readDevCdrViaAgent } from './fileOpenerAgent';
import { extractCdrPreview } from './cdrPreview';
import { formatCdrPreviewReadError } from './cdrPreviewErrors';

/** Локальный файл на ПК для ручной проверки read-dev (не MINIMARKER). */
export const DEV_TEST_CDR_PATH = String.raw`C:\0.cdr`;

/** Отдельный тест: агент читает C:\0.cdr, превью только в диалоге (без БД). */
export async function buildDevTestCdrPreview() {
  const path = DEV_TEST_CDR_PATH;
  try {
    const bytes = await readDevCdrViaAgent(path);
    const result = await extractCdrPreview(bytes);
    if (!result.ok) {
      throw new Error(`${result.error}\nФайл: ${path}`);
    }
    return { url: result.url, method: result.method, path };
  } catch (err) {
    throw new Error(formatCdrPreviewReadError(err?.message, path));
  }
}
