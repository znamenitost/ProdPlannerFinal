import { Box } from '@mui/material';
import { ChatMessageContent } from '@mui/x-chat';
import { useMessageContext } from '@mui/x-chat-headless';
import ChatReplyQuote from './ChatReplyQuote';

export default function ChatMessageContentWithReply(props) {
  const { message, isOwnMessage } = useMessageContext();
  const replyTo = message?.metadata?.replyTo;

  return (
    <Box
      data-chat-message-id={message?.id || undefined}
      sx={{ minWidth: 0, maxWidth: '100%' }}
    >
      {replyTo ? <ChatReplyQuote replyTo={replyTo} isOwnBubble={isOwnMessage} /> : null}
      <ChatMessageContent {...props} />
    </Box>
  );
}
