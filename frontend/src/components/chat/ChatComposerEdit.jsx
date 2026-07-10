import { useEffect, useRef } from 'react';
import { alpha, Box, IconButton, Typography } from '@mui/material';
import { Close, Edit as EditIcon } from '@mui/icons-material';
import { ChatComposerTextArea } from '@mui/x-chat';
import { useChatComposer } from '@mui/x-chat-headless';
import { useChatEditSession } from './ChatEditSessionContext';

/**
 * Syncs composer text when entering Telegram-style edit mode.
 */
export function ChatComposerInputWithEdit(props) {
  const session = useChatEditSession();
  const { setValue } = useChatComposer();
  const syncedIdRef = useRef(null);

  useEffect(() => {
    const editing = session?.editing;
    if (!editing) {
      syncedIdRef.current = null;
      return;
    }
    if (syncedIdRef.current === editing.id) return;
    syncedIdRef.current = editing.id;
    setValue(editing.text);
  }, [session?.editing, setValue]);

  useEffect(() => {
    if (!session?.editing) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        session.cancelEdit();
        setValue('');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [session, setValue]);

  return <ChatComposerTextArea {...props} />;
}

/**
 * Banner above the composer while editing a message.
 */
export function ChatComposerEditHelperText(props) {
  const session = useChatEditSession();
  const { setValue } = useChatComposer();
  const editing = session?.editing;

  if (!editing) {
    return null;
  }

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
        <Typography
          variant="caption"
          color="text.secondary"
          noWrap
          sx={{ display: 'block', lineHeight: 1.2 }}
        >
          {editing.text || 'Сообщение'}
        </Typography>
      </Box>
      <IconButton
        size="small"
        aria-label="Отменить редактирование"
        onClick={() => {
          session.cancelEdit();
          setValue('');
        }}
      >
        <Close fontSize="small" />
      </IconButton>
    </Box>
  );
}
