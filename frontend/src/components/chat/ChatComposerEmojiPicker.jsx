import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import {
  CircularProgress,
  IconButton,
  Popover,
  Tooltip,
  useMediaQuery
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { EmojiEmotions } from '@mui/icons-material';
import { useChatComposer } from '@mui/x-chat-headless';

const EmojiPicker = lazy(() => import('emoji-picker-react'));

const emojiRuPromise = import('emoji-picker-react/dist/data/emojis-ru');

function EmojiPickerPanel({ onPick }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [emojiData, setEmojiData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    emojiRuPromise.then((mod) => {
      if (!cancelled) setEmojiData(mod.default ?? mod);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const pickerTheme = theme.palette.mode === 'dark' ? 'dark' : 'light';

  return (
    <Suspense
      fallback={(
        <CircularProgress
          size={28}
          sx={{ display: 'block', m: 'auto', my: 6 }}
          aria-label="Загрузка эмодзи"
        />
      )}
    >
      {emojiData ? (
        <EmojiPicker
          open
          theme={pickerTheme}
          emojiData={emojiData}
          lazyLoadEmojis
          autoFocusSearch={false}
          searchPlaceholder="Поиск"
          width={isMobile ? 280 : 320}
          height={isMobile ? 360 : 400}
          previewConfig={{ showPreview: true }}
          onEmojiClick={(emojiDataClick) => {
            onPick(emojiDataClick.emoji);
          }}
          onReactionClick={(emojiDataClick) => {
            onPick(emojiDataClick.emoji);
          }}
        />
      ) : (
        <CircularProgress
          size={28}
          sx={{ display: 'block', m: 'auto', my: 6 }}
          aria-label="Загрузка эмодзи"
        />
      )}
    </Suspense>
  );
}

/**
 * Emoji button for the chat composer (lazy-loaded picker, Russian labels).
 */
export default function ChatComposerEmojiPicker() {
  const theme = useTheme();
  const { value, setValue } = useChatComposer();
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  const insertEmoji = useCallback((emoji) => {
    const active = document.activeElement;
    const inComposer = active?.tagName === 'TEXTAREA'
      && active.closest('.MuiChatComposer-root');

    if (inComposer) {
      const start = active.selectionStart ?? value.length;
      const end = active.selectionEnd ?? value.length;
      const next = `${value.slice(0, start)}${emoji}${value.slice(end)}`;
      setValue(next);
      const caret = start + emoji.length;
      requestAnimationFrame(() => {
        active.focus();
        if (typeof active.setSelectionRange === 'function') {
          active.setSelectionRange(caret, caret);
        }
      });
      return;
    }

    setValue(`${value}${emoji}`);
  }, [setValue, value]);

  return (
    <>
      <Tooltip title="Эмодзи">
        <IconButton
          size="small"
          aria-label="Эмодзи"
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={(event) => setAnchorEl(event.currentTarget)}
          sx={{
            width: 36,
            height: 36,
            flexShrink: 0,
            color: 'text.secondary',
            '&:hover': { color: 'text.primary' }
          }}
        >
          <EmojiEmotions fontSize="small" />
        </IconButton>
      </Tooltip>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'top', horizontal: 'left' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{
          paper: {
            sx: {
              overflow: 'hidden',
              borderRadius: 2,
              boxShadow: theme.shadows[8],
              zIndex: theme.zIndex.modal + 2
            }
          }
        }}
      >
        <EmojiPickerPanel onPick={insertEmoji} />
      </Popover>
    </>
  );
}
