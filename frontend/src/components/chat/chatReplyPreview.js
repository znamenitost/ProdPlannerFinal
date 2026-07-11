import { textFromChatMessage } from './ChatEditSessionContext';

/** Max visible characters in a quoted reply preview (Telegram-style one-liner). */
export const REPLY_PREVIEW_MAX_LENGTH = 24;

export function truncateReplyPreview(text, maxLength = REPLY_PREVIEW_MAX_LENGTH) {
  const trimmed = String(text ?? '').trim();
  if (!trimmed) return '';
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength)}…`;
}

export function replyPreviewFromMessage(message) {
  const text = textFromChatMessage(message);
  if (text) return truncateReplyPreview(text);

  const files = (message?.parts || []).filter((p) => p.type === 'file');
  if (files.length === 1) {
    const name = files[0].filename || 'Файл';
    return truncateReplyPreview(`📎 ${name}`);
  }
  if (files.length > 1) return `${files.length} файла`;
  return 'Сообщение';
}
