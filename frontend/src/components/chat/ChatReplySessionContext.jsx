import { createContext, useContext } from 'react';
import { textFromChatMessage } from './ChatEditSessionContext';

/** @typedef {{ id: string, conversationId: string, senderUserId: string, senderFullName: string, preview: string }} ChatReplyingMessage */

/**
 * @typedef {{
 *   replying: ChatReplyingMessage | null,
 *   startReply: (message: import('@mui/x-chat-headless').ChatMessage) => void,
 *   cancelReply: () => void
 * }} ChatReplySessionValue
 */

/** @type {import('react').Context<ChatReplySessionValue | null>} */
export const ChatReplySessionContext = createContext(null);

export function useChatReplySession() {
  return useContext(ChatReplySessionContext);
}

export function replyPreviewFromMessage(message) {
  const text = textFromChatMessage(message);
  if (text) return text.length > 120 ? `${text.slice(0, 119)}…` : text;
  const files = (message?.parts || []).filter((p) => p.type === 'file');
  if (files.length === 1) return files[0].filename || 'Файл';
  if (files.length > 1) return `${files.length} файла`;
  return 'Сообщение';
}
