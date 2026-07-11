import { forwardRef } from 'react';
import { Box, IconButton, Tooltip, styled } from '@mui/material';
import { Edit as EditIcon, Reply as ReplyIcon } from '@mui/icons-material';
import { ChatMessageContent } from '@mui/x-chat';
import { useMessage, useMessageContext } from '@mui/x-chat-headless';
import { useChatEditSession } from './ChatEditSessionContext';
import { useChatReplySession } from './ChatReplySessionContext';
import { replyToFromSession } from './chatReplyPreview';
import ChatReplyQuote from './ChatReplyQuote';

const hoverActionSx = {
  width: 28,
  height: 28,
  bgcolor: 'background.paper',
  border: (t) => `1px solid ${t.palette.divider}`,
  boxShadow: 1,
  '&:hover': {
    bgcolor: 'action.hover'
  }
};

const ChatMessageBubbleRoot = styled(Box, {
  name: 'MuiChatMessage',
  slot: 'Bubble',
  shouldForwardProp: (prop) => prop !== 'ownerState'
})(({ theme, ownerState }) => {
  const isUserRole = ownerState?.role === 'user';
  const isOwn = ownerState?.isOwnMessage ?? false;

  return {
    position: 'relative',
    overflow: 'visible',
    fontSize: theme.typography.body2.fontSize,
    lineHeight: theme.typography.body2.lineHeight,
    wordBreak: 'break-word',
    whiteSpace: isUserRole ? 'pre-wrap' : 'normal',
    maxWidth: '100%',
    boxSizing: 'border-box',
    padding: theme.spacing(1, 1.5),
    borderRadius: theme.shape.borderRadius,
    alignSelf: isOwn ? 'flex-end' : 'flex-start',
    '& p': {
      margin: 0
    }
  };
});

const ChatMessageBubbleWithReply = forwardRef(function ChatMessageBubbleWithReply(props, ref) {
  const {
    children,
    className,
    ownerState,
    ...rest
  } = props;

  const { messageId, isOwnMessage } = useMessageContext();
  const message = useMessage(messageId);
  const replySession = useChatReplySession();
  const editSession = useChatEditSession();
  const outgoingReplyTo = isOwnMessage && message?.status === 'sending'
    ? replyToFromSession(replySession?.replying)
    : null;
  const replyTo = message?.metadata?.replyTo || outgoingReplyTo;
  const canInteract = message?.id
    && message.status !== 'streaming'
    && message.status !== 'pending';

  const startReply = (event) => {
    event.stopPropagation();
    if (!message || isOwnMessage) return;
    replySession?.startReply(message);
  };

  const startEdit = (event) => {
    event.stopPropagation();
    if (message?.role === 'user') editSession?.startEdit(message);
  };

  return (
    <ChatMessageBubbleRoot
      ref={ref}
      data-chat-message-id={message?.id || undefined}
      className={className}
      ownerState={ownerState}
      data-role={ownerState?.role}
      {...rest}
    >
      {replyTo ? (
        <ChatReplyQuote replyTo={replyTo} isOwnBubble={isOwnMessage} />
      ) : null}
      {children}
      {canInteract ? (
        <Box
          data-chat-hover-actions
          sx={{
            position: 'absolute',
            top: 4,
            display: 'flex',
            flexDirection: 'column',
            gap: 0.25,
            zIndex: 2,
            ...(isOwnMessage
              ? { right: 'calc(100% + 6px)' }
              : { left: 'calc(100% + 6px)' })
          }}
        >
          {!isOwnMessage ? (
            <Tooltip title="Ответить" placement="top">
              <IconButton
                size="small"
                aria-label="Ответить"
                onClick={startReply}
                sx={hoverActionSx}
              >
                <ReplyIcon sx={{ fontSize: 16, color: 'primary.main' }} />
              </IconButton>
            </Tooltip>
          ) : null}
          {isOwnMessage ? (
            <Tooltip title="Изменить" placement="top">
              <IconButton
                size="small"
                aria-label="Изменить"
                onClick={startEdit}
                sx={hoverActionSx}
              >
                <EditIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
              </IconButton>
            </Tooltip>
          ) : null}
        </Box>
      ) : null}
    </ChatMessageBubbleRoot>
  );
});

export default function ChatMessageContentWithReply(props) {
  return (
    <ChatMessageContent
      {...props}
      slots={{
        ...props.slots,
        bubble: ChatMessageBubbleWithReply
      }}
    />
  );
}
