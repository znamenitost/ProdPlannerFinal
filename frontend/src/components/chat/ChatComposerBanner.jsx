import { useEffect } from 'react';
import { alpha, Box, IconButton, Typography } from '@mui/material';
import { Close, Edit as EditIcon, Reply as ReplyIcon } from '@mui/icons-material';
import { useChatComposer } from '@mui/x-chat-headless';
import { tokens } from '../../theme/paletteTokens';
import { useChatEditSession } from './ChatEditSessionContext';
import { useChatReplySession } from './ChatReplySessionContext';
import { truncateReplyPreview } from './chatReplyPreview';

const { neutral, primary } = tokens;

/**
 * Banner above the composer while editing or replying to a message.
 */
export default function ChatComposerBanner() {
  const editSession = useChatEditSession();
  const replySession = useChatReplySession();
  const { setValue } = useChatComposer();
  const editing = editSession?.editing;
  const replying = replySession?.replying;

  useEffect(() => {
    if (!editing && !replying) return undefined;
    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      if (editing) {
        editSession.cancelEdit();
        setValue('');
      } else if (replying) {
        replySession.cancelReply();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [editSession, replySession, editing, replying, setValue]);

  if (editing) {
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 0.5,
          py: 0.25,
          mb: 0.25,
          borderLeft: (t) => `3px solid ${t.palette.primary.main}`,
          bgcolor: (t) => alpha(t.palette.primary.main, 0.06),
          borderRadius: 1
        }}
      >
        <EditIcon sx={{ fontSize: 16, color: 'primary.main', ml: 0.75 }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="caption" sx={{ fontWeight: 600, color: 'primary.main', display: 'block', lineHeight: 1.2 }}>
            Редактирование
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', lineHeight: 1.2 }}>
            {editing.text || 'Сообщение'}
          </Typography>
        </Box>
        <IconButton
          size="small"
          aria-label="Отменить редактирование"
          onClick={() => {
            editSession.cancelEdit();
            setValue('');
          }}
        >
          <Close fontSize="small" />
        </IconButton>
      </Box>
    );
  }

  if (replying) {
    const preview = truncateReplyPreview(replying.preview) || 'Сообщение';
    return (
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.25,
          py: 0.75,
          mb: 0.5,
          borderLeft: `3px solid ${neutral[600]}`,
          bgcolor: neutral[200],
          borderRadius: 1
        }}
      >
        <ReplyIcon sx={{ fontSize: 16, color: neutral[600], flexShrink: 0 }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="caption"
            sx={{
              fontWeight: 700,
              color: primary.dark,
              display: 'block',
              lineHeight: 1.2,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {replying.senderFullName}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              lineHeight: 1.2,
              color: neutral[600],
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap'
            }}
          >
            {preview}
          </Typography>
        </Box>
        <IconButton
          size="small"
          aria-label="Отменить ответ"
          onClick={() => replySession.cancelReply()}
        >
          <Close fontSize="small" />
        </IconButton>
      </Box>
    );
  }

  return null;
}
