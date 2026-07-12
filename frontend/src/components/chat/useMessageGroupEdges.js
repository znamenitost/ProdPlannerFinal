import { useMemo } from 'react';
import { useMessage, useMessageIds, useMessageContext } from '@mui/x-chat-headless';

const defaultGroupKey = (message) => message?.author?.id ?? message?.role ?? '';

export default function useMessageGroupEdges(groupKeyResolver = defaultGroupKey) {
  const { messageId, message } = useMessageContext();
  const messageIds = useMessageIds();
  const index = messageIds.indexOf(messageId);
  const previousMessageId = index > 0 ? messageIds[index - 1] : undefined;
  const nextMessageId = index >= 0 && index < messageIds.length - 1
    ? messageIds[index + 1]
    : undefined;
  const previousMessage = useMessage(previousMessageId ?? '');
  const nextMessage = useMessage(nextMessageId ?? '');

  return useMemo(() => {
    const currentKey = message ? groupKeyResolver(message) : null;
    const previousKey = previousMessage ? groupKeyResolver(previousMessage) : null;
    const nextKey = nextMessage ? groupKeyResolver(nextMessage) : null;

    return {
      isFirst: previousKey === null || previousKey !== currentKey,
      isLast: nextKey === null || nextKey !== currentKey
    };
  }, [groupKeyResolver, message, nextMessage, previousMessage]);
}
