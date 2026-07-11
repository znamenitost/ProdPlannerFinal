import { ChatMessageContent } from '@mui/x-chat';
import { useMessageContext } from '@mui/x-chat-headless';
import ChatReplyQuote from './ChatReplyQuote';

export default function ChatMessageContentWithReply(props) {
  const { message, isOwnMessage } = useMessageContext();
  const replyTo = message?.metadata?.replyTo;

  return (
    <>
      {replyTo ? <ChatReplyQuote replyTo={replyTo} isOwnBubble={isOwnMessage} /> : null}
      <ChatMessageContent {...props} />
    </>
  );
}
