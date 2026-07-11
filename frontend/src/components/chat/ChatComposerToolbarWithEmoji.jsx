import { ChatComposerToolbar } from '@mui/x-chat';
import ChatComposerEmojiPicker from './ChatComposerEmojiPicker';

/**
 * Default composer toolbar with an emoji button before attach/send.
 */
export default function ChatComposerToolbarWithEmoji({ children, sx, ...props }) {
  return (
    <ChatComposerToolbar
      {...props}
      sx={{
        gap: 0.5,
        ...sx
      }}
    >
      <ChatComposerEmojiPicker />
      {children}
    </ChatComposerToolbar>
  );
}
