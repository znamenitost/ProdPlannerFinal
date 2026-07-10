import { createContext, useContext } from 'react';

/** @typedef {{ id: string, conversationId: string, text: string }} ChatEditingMessage */

/**
 * @typedef {{
 *   editing: ChatEditingMessage | null,
 *   startEdit: (message: import('@mui/x-chat-headless').ChatMessage) => void,
 *   cancelEdit: () => void
 * }} ChatEditSessionValue
 */

/** @type {import('react').Context<ChatEditSessionValue | null>} */
export const ChatEditSessionContext = createContext(null);

export function useChatEditSession() {
  return useContext(ChatEditSessionContext);
}

export function textFromChatMessage(message) {
  if (!message?.parts?.length) return '';
  return message.parts
    .filter((p) => p.type === 'text')
    .map((p) => p.text || '')
    .join('');
}
