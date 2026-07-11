import { createContext, useContext } from 'react';

export { replyPreviewFromMessage } from './chatReplyPreview';

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
