import { ChatComposerSendButton } from '@mui/x-chat';
import { useSubmitReplyMessage } from './ChatComposerRootWithReply';
import { useChatReplySession } from './ChatReplySessionContext';

/**
 * Send button that routes reply mode through the custom submit path.
 */
export default function ChatComposerSendButtonWithReply(props) {
  const submitReply = useSubmitReplyMessage();
  const replySession = useChatReplySession();
  const isReplying = Boolean(replySession?.replying);

  const handleClick = async (event) => {
    props.onClick?.(event);
    if (event.defaultPrevented || !isReplying) return;
    event.preventDefault();
    await submitReply();
  };

  return (
    <ChatComposerSendButton
      {...props}
      type={isReplying ? 'button' : 'submit'}
      onClick={handleClick}
    />
  );
}
