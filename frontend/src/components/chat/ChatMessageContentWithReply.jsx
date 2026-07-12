import { forwardRef } from 'react';
import { Box, Divider, IconButton, Tooltip, styled } from '@mui/material';
import { Edit as EditIcon, Reply as ReplyIcon } from '@mui/icons-material';
import { ChatMessageContent } from '@mui/x-chat';
import { useMessage, useMessageContext } from '@mui/x-chat-headless';
import { useChatEditSession } from './ChatEditSessionContext';
import { useChatReplySession } from './ChatReplySessionContext';
import { replyToFromSession } from './chatReplyPreview';
import ChatReplyQuote, { BUBBLE_PADDING_X } from './ChatReplyQuote';
import { getTelegramBubbleBorderRadius } from './chatBubbleShape';
import useMessageGroupEdges from './useMessageGroupEdges';
import { tokens } from '../../theme/paletteTokens';

const { neutral } = tokens;

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

const HOVER_ACTION_BRIDGE_PX = 12;
const HOVER_ACTION_GAP_PX = 4;
const HOVER_ACTION_HIDE_DELAY_MS = 280;

const hoverActionBridgeSx = (isOwnMessage) => (isOwnMessage
  ? {
      right: `calc(100% + ${HOVER_ACTION_GAP_PX}px)`,
      paddingRight: `${HOVER_ACTION_BRIDGE_PX}px`,
      marginRight: `-${HOVER_ACTION_BRIDGE_PX - HOVER_ACTION_GAP_PX}px`
    }
  : {
      left: `calc(100% + ${HOVER_ACTION_GAP_PX}px)`,
      paddingLeft: `${HOVER_ACTION_BRIDGE_PX}px`,
      marginLeft: `-${HOVER_ACTION_BRIDGE_PX - HOVER_ACTION_GAP_PX}px`
    });

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
    alignSelf: isOwn ? 'flex-end' : 'flex-start',
    '& [data-chat-hover-actions]': {
      opacity: 0,
      pointerEvents: 'none',
      transition: theme.transitions.create('opacity', {
        duration: theme.transitions.duration.shorter,
        delay: HOVER_ACTION_HIDE_DELAY_MS
      })
    },
    '@media (hover: hover)': {
      '&:hover [data-chat-hover-actions], &:focus-within [data-chat-hover-actions]': {
        opacity: 1,
        pointerEvents: 'auto',
        transitionDelay: '0ms'
      }
    },
    '@media (hover: none)': {
      '& [data-chat-hover-actions]': {
        opacity: 1,
        pointerEvents: 'auto'
      }
    },
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
  const hasReply = Boolean(replyTo);
  const { isFirst, isLast } = useMessageGroupEdges();
  const bubbleBorderRadius = getTelegramBubbleBorderRadius({
    isOwn: isOwnMessage,
    isFirst,
    isLast
  });
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
      sx={[
        { borderRadius: bubbleBorderRadius },
        hasReply && {
          display: 'flex',
          flexDirection: 'column',
          p: 0,
          gap: 0
        },
        ...(Array.isArray(rest.sx) ? rest.sx : rest.sx ? [rest.sx] : [])
      ]}
    >
      {hasReply ? (
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            borderRadius: 'inherit'
          }}
        >
          <ChatReplyQuote replyTo={replyTo} isOwnBubble={isOwnMessage} />
          <Divider
            sx={{
              borderColor: isOwnMessage ? neutral[500] : neutral[300],
              opacity: 1
            }}
          />
          <Box
            sx={{
              px: BUBBLE_PADDING_X,
              py: 1,
              minWidth: 0
            }}
          >
            {children}
          </Box>
        </Box>
      ) : (
        children
      )}
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
            ...hoverActionBridgeSx(isOwnMessage)
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
