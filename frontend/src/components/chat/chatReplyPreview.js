import { textFromChatMessage } from './ChatEditSessionContext';

/** Max visible characters in a quoted reply preview (Telegram-style one-liner). */
export const REPLY_PREVIEW_MAX_LENGTH = 24;

let pendingReplyMessage = null;

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

/** Normalize reply preview from API DTO (camelCase or PascalCase). */
export function replyToFromDto(dto) {
  const raw = dto?.replyTo ?? dto?.ReplyTo;
  if (!raw) return null;

  const id = raw.id ?? raw.Id;
  if (id == null) return null;

  return {
    id: String(id),
    senderUserId: String(raw.senderUserId ?? raw.SenderUserId ?? ''),
    senderFullName: String(raw.senderFullName ?? raw.SenderFullName ?? 'Сообщение'),
    preview: truncateReplyPreview(raw.preview ?? raw.Preview)
  };
}

/** Build reply metadata from active reply composer session. */
export function replyToFromSession(replying) {
  if (!replying?.id) return null;
  return {
    id: String(replying.id),
    senderUserId: String(replying.senderUserId ?? ''),
    senderFullName: String(replying.senderFullName ?? 'Сообщение'),
    preview: truncateReplyPreview(replying.preview)
  };
}

export function setPendingReplyMessage(replying) {
  pendingReplyMessage = replying || null;
}

export function getPendingReplyMessage() {
  return pendingReplyMessage;
}

export function clearPendingReplyMessage(replyingId) {
  if (replyingId != null && pendingReplyMessage?.id !== String(replyingId)) return;
  pendingReplyMessage = null;
}

export function messageMetadataWithReply(message, replyTo) {
  if (!replyTo) return message?.metadata;
  return {
    ...(message?.metadata || {}),
    replyTo
  };
}
