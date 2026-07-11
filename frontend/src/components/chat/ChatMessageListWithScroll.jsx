import { ChatMessageList } from '@mui/x-chat';
import ChatScrollToEndOnOpen from './ChatScrollToEndOnOpen';

export default function ChatMessageListWithScroll(props) {
  return (
    <>
      <ChatScrollToEndOnOpen />
      <ChatMessageList {...props} />
    </>
  );
}
