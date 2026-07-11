import { Box } from '@mui/material';
import ChatComposerBanner from './ChatComposerBanner';
import { ChatComposerInputWithEdit } from './ChatComposerEdit';

/**
 * Composer input with edit/reply banner above the text field (Telegram-style).
 */
export default function ChatComposerInputWithReply(props) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%', minWidth: 0 }}>
      <ChatComposerBanner />
      <ChatComposerInputWithEdit {...props} />
    </Box>
  );
}
