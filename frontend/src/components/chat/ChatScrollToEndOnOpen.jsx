import { useEffect, useRef } from 'react';
import { useChat, useMessageIds } from '@mui/x-chat-headless';

function scrollMessageListToEnd() {
  const scroller = document.querySelector('.MuiChatMessageList-scroller');
  if (!scroller) return;
  scroller.scrollTop = scroller.scrollHeight;
}

/**
 * Scrolls the active thread to the latest message once per conversation open.
 */
export default function ChatScrollToEndOnOpen() {
  const { activeConversationId, isLoadingHistory } = useChat();
  const messageIds = useMessageIds();
  const initialScrollDoneRef = useRef(new Map());

  useEffect(() => {
    if (!activeConversationId || isLoadingHistory || messageIds.length === 0) return;
    if (initialScrollDoneRef.current.get(activeConversationId)) return;

    initialScrollDoneRef.current.set(activeConversationId, true);

    requestAnimationFrame(scrollMessageListToEnd);
    const t1 = setTimeout(scrollMessageListToEnd, 0);
    const t2 = setTimeout(scrollMessageListToEnd, 150);
    const t3 = setTimeout(scrollMessageListToEnd, 400);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [activeConversationId, isLoadingHistory, messageIds.length]);

  useEffect(() => {
    if (!activeConversationId) return undefined;
    return () => {
      initialScrollDoneRef.current.delete(activeConversationId);
    };
  }, [activeConversationId]);

  return null;
}
