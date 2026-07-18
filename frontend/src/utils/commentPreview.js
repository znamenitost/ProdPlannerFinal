/** Разделитель целых комментариев в denormalized preview (совпадает с бэкендом). */
export const COMMENT_PREVIEW_SEPARATOR = '\u001e';

/**
 * Для ячейки таблицы: показать комментарии с новой строки,
 * не раскрывая служебный разделитель.
 */
export function normalizeCommentPreviewForDisplay(preview) {
  return String(preview || '')
    .split(COMMENT_PREVIEW_SEPARATOR)
    .join('\n');
}

function parseCommentBlock(block, index) {
  const text = String(block ?? '').replace(/^\n+|\n+$/g, '');
  if (!text) return null;

  // Первый / baseline — автора не парсим (в тексте может быть «:»).
  if (index === 0) {
    const recipientOnly = text.match(/^→\s*(.+?):\s*([\s\S]*)$/);
    if (recipientOnly) {
      return {
        author: null,
        recipient: recipientOnly[1].trim(),
        text: recipientOnly[2].replace(/^\n+/, ''),
        hideAuthor: true
      };
    }
    return { author: null, recipient: null, text, hideAuthor: true };
  }

  const withRecipient = text.match(/^(.+?)\s*→\s*(.+?):\s*([\s\S]*)$/);
  if (withRecipient) {
    return {
      author: withRecipient[1].trim(),
      recipient: withRecipient[2].trim(),
      text: withRecipient[3].replace(/^\n+/, ''),
      hideAuthor: false
    };
  }

  const authorOnly = text.match(/^(.+?):\s*([\s\S]*)$/);
  if (authorOnly) {
    return {
      author: authorOnly[1].trim(),
      recipient: null,
      text: authorOnly[2].replace(/^\n+/, ''),
      hideAuthor: false
    };
  }

  return { author: null, recipient: null, text, hideAuthor: false };
}

const LEGACY_WITH_RECIPIENT = /^(.+?)\s→\s(.+?):\s*(.*)$/;
const LEGACY_AUTHOR_ONLY = /^(.+?):\s*(.*)$/;
const LEGACY_RECIPIENT_ONLY = /^→\s*(.+?):\s*(.*)$/;

/** Старые превью без \u001e: продолжения без заголовка остаются в том же комментарии. */
function parseLegacyPreviewLines(preview) {
  const rawLines = String(preview || '').split('\n');
  const comments = [];
  let current = null;

  for (let i = 0; i < rawLines.length; i += 1) {
    const line = rawLines[i];

    if (current == null) {
      const recipientOnly = line.match(LEGACY_RECIPIENT_ONLY);
      if (recipientOnly) {
        current = {
          author: null,
          recipient: recipientOnly[1].trim(),
          text: recipientOnly[2],
          hideAuthor: true
        };
      } else {
        current = {
          author: null,
          recipient: null,
          text: line,
          hideAuthor: true
        };
      }
      comments.push(current);
      continue;
    }

    const withRecipient = line.match(LEGACY_WITH_RECIPIENT);
    if (withRecipient) {
      current = {
        author: withRecipient[1].trim(),
        recipient: withRecipient[2].trim(),
        text: withRecipient[3],
        hideAuthor: false
      };
      comments.push(current);
      continue;
    }

    // Новая запись «Автор: …», но не продолжение «→ Получатель: …».
    const authorOnly = line.match(LEGACY_AUTHOR_ONLY);
    if (authorOnly && !line.startsWith('→')) {
      current = {
        author: authorOnly[1].trim(),
        recipient: null,
        text: authorOnly[2],
        hideAuthor: false
      };
      comments.push(current);
      continue;
    }

    current.text = current.text === '' ? line : `${current.text}\n${line}`;
  }

  return comments.filter(
    (c) => Boolean(String(c.text || '').trim()) || Boolean(c.author) || Boolean(c.recipient)
  );
}

/** Разбить denormalized preview на целые комментарии (не по каждой строке текста). */
export function parseCommentPreviewLines(preview) {
  const raw = String(preview || '');
  if (!raw.trim()) return [];

  if (raw.includes(COMMENT_PREVIEW_SEPARATOR)) {
    return raw
      .split(COMMENT_PREVIEW_SEPARATOR)
      .map((block, index) => parseCommentBlock(block, index))
      .filter(Boolean);
  }

  return parseLegacyPreviewLines(raw);
}
