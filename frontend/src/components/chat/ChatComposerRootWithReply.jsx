import { useCallback } from 'react';
import { useChatActions, useChatStore, useComposerContext } from '@mui/x-chat-headless';
import { useChatReplySession } from './ChatReplySessionContext';
import { messageMetadataWithReply, replyToFromSession } from './chatReplyPreview';

function createLocalMessageId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `local-${crypto.randomUUID()}`;
  }
  return `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function filePartFromAttachment(attachment) {
  const file = attachment.file;
  return {
    type: 'file',
    mediaType: file?.type || 'application/octet-stream',
    url: attachment.previewUrl
      || (file && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
        ? URL.createObjectURL(file)
        : ''),
    filename: file?.name || 'Файл'
  };
}

export function useSubmitReplyMessage() {
  const composer = useComposerContext();
  const actions = useChatActions();
  const store = useChatStore();
  const replySession = useChatReplySession();

  return useCallback(async () => {
    const replyTo = replyToFromSession(replySession?.replying);
    if (!replyTo || !actions) return false;

    const value = composer.value;
    const attachments = [...composer.attachments];
    const hasText = value.trim() !== '';
    const hasAttachments = attachments.length > 0;
    if (
      store.state.isStreaming
      || store.state.composerIsComposing
      || (!hasText && !hasAttachments)
    ) {
      return true;
    }

    const parts = [];
    if (hasText) {
      parts.push({ type: 'text', text: value });
    }
    for (const attachment of attachments) {
      parts.push(filePartFromAttachment(attachment));
    }

    store.clearComposer();
    await actions.sendMessage({
      id: createLocalMessageId(),
      parts,
      attachments,
      author: store.currentUser,
      metadata: messageMetadataWithReply(null, replyTo)
    });
    replySession?.cancelReply();

    return true;
  }, [actions, composer.attachments, composer.value, replySession, store]);
}
