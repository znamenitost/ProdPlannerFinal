import { Box, CircularProgress, Typography } from '@mui/material';
import { ChatMessageSkeleton } from '@mui/x-chat';
import { useChatStatus, useMessageIds } from '@mui/x-chat-headless';

const THREAD_HEADER_OFFSET = 52;

/**
 * Loading affordance for the active thread:
 * - initial page: skeleton bubbles + spinner
 * - older pages (scroll up): compact spinner below the header
 */
export default function ChatThreadLoadingOverlay() {
  const { isLoadingHistory } = useChatStatus();
  const messageIds = useMessageIds();

  if (!isLoadingHistory) return null;

  const isInitialLoad = messageIds.length === 0;

  if (isInitialLoad) {
    return (
      <Box
        aria-busy="true"
        aria-live="polite"
        sx={{
          position: 'absolute',
          top: THREAD_HEADER_OFFSET,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 2,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2.5,
          px: 3,
          bgcolor: 'background.default',
          pointerEvents: 'none'
        }}
      >
        <Box sx={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <ChatMessageSkeleton lines={2} sx={{ alignSelf: 'flex-start', width: '62%' }} />
          <ChatMessageSkeleton lines={3} sx={{ alignSelf: 'flex-end', width: '54%' }} />
          <ChatMessageSkeleton lines={2} sx={{ alignSelf: 'flex-start', width: '48%' }} />
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <CircularProgress size={22} color="primary" />
          <Typography variant="body2" color="text.secondary">
            Загрузка сообщений…
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      aria-busy="true"
      aria-live="polite"
      sx={{
        position: 'absolute',
        top: THREAD_HEADER_OFFSET,
        left: 0,
        right: 0,
        zIndex: 2,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        py: 1,
        bgcolor: (t) => t.palette.background.default,
        borderBottom: (t) => `1px solid ${t.palette.divider}`,
        pointerEvents: 'none'
      }}
    >
      <CircularProgress size={16} color="primary" />
      <Typography variant="caption" color="text.secondary">
        Загрузка…
      </Typography>
    </Box>
  );
}
