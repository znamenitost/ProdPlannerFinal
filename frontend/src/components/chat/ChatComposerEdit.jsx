import { useEffect, useLayoutEffect, useRef } from 'react';
import { Box } from '@mui/material';
import { useChatComposer } from '@mui/x-chat-headless';
import { useChatEditSession } from './ChatEditSessionContext';
import { useChatReplySession } from './ChatReplySessionContext';
import { useSubmitReplyMessage } from './ChatComposerRootWithReply';

function focusComposer(inputRef) {
  requestAnimationFrame(() => {
    const el = inputRef.current;
    if (!el || typeof el.focus !== 'function') return;
    el.focus();
    const end = el.value?.length ?? 0;
    if (typeof el.setSelectionRange === 'function') {
      el.setSelectionRange(end, end);
    }
  });
}

/**
 * Syncs composer text when entering Telegram-style edit mode.
 */
export function ChatComposerInputWithEdit(props) {
  const session = useChatEditSession();
  const replySession = useChatReplySession();
  const composer = useChatComposer();
  const { setValue } = composer;
  const submitReply = useSubmitReplyMessage();
  const syncedEditIdRef = useRef(null);
  const syncedReplyIdRef = useRef(null);
  const inputRef = useRef(null);

  useLayoutEffect(() => {
    const editing = session?.editing;
    if (!editing) {
      syncedEditIdRef.current = null;
      return;
    }
    syncedReplyIdRef.current = null;
    if (syncedEditIdRef.current === editing.id) return;
    syncedEditIdRef.current = editing.id;
    setValue(editing.text);
    focusComposer(inputRef);
  }, [session?.editing, setValue]);

  useLayoutEffect(() => {
    const replying = replySession?.replying;
    if (!replying || session?.editing) {
      syncedReplyIdRef.current = null;
      return;
    }
    if (syncedReplyIdRef.current === replying.id) return;
    syncedReplyIdRef.current = replying.id;
    setValue('');
    focusComposer(inputRef);
  }, [replySession?.replying, session?.editing, setValue]);

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

  const syncHeight = () => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };

  useLayoutEffect(() => {
    syncHeight();
  }, [composer.value]);

  const handleKeyDown = async (event) => {
    props.onKeyDown?.(event);
    if (
      event.defaultPrevented
      || event.key !== 'Enter'
      || event.shiftKey
      || event.nativeEvent.isComposing
    ) {
      return;
    }

    event.preventDefault();
    if (replySession?.replying && !session?.editing) {
      await submitReply();
    } else {
      await composer.submit();
    }
  };

  return (
    <Box
      component="textarea"
      {...props}
      ref={inputRef}
      value={composer.value}
      placeholder={props.placeholder ?? 'Сообщение…'}
      aria-label={props['aria-label'] ?? 'Сообщение'}
      disabled={Boolean(props.disabled) || composer.isSubmitting}
      onChange={(event) => {
        props.onChange?.(event);
        if (!event.defaultPrevented) {
          setValue(event.target.value);
        }
      }}
      onKeyDown={handleKeyDown}
      onCompositionStart={(event) => {
        props.onCompositionStart?.(event);
      }}
      onCompositionEnd={(event) => {
        props.onCompositionEnd?.(event);
      }}
      sx={{
        flex: 1,
        resize: 'none',
        border: 'none',
        borderRadius: 0,
        p: 0.5,
        fontFamily: 'inherit',
        fontSize: 'body2.fontSize',
        lineHeight: 'body2.lineHeight',
        color: 'text.primary',
        bgcolor: 'transparent',
        outline: 'none',
        boxSizing: 'border-box',
        minHeight: 40,
        maxHeight: 200,
        overflowY: 'auto',
        scrollbarWidth: 'thin',
        '&:disabled': {
          color: 'text.disabled',
          cursor: 'not-allowed'
        },
        '&::placeholder': {
          color: 'text.disabled'
        },
        ...(Array.isArray(props.sx) ? undefined : props.sx)
      }}
    />
  );
}
