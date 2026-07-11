import { useEffect, useLayoutEffect, useRef } from 'react';
import { ChatComposerTextArea } from '@mui/x-chat';
import { useChatComposer } from '@mui/x-chat-headless';
import { useChatEditSession } from './ChatEditSessionContext';
import { useChatReplySession } from './ChatReplySessionContext';

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
  const { setValue } = useChatComposer();
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

  return <ChatComposerTextArea {...props} ref={inputRef} />;
}
