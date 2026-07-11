import { alpha, Box, IconButton, Tooltip } from '@mui/material';
import { Edit as EditIcon, Reply as ReplyIcon } from '@mui/icons-material';
import { ChatMessageContent } from '@mui/x-chat';
import { useMessageContext } from '@mui/x-chat-headless';
import { useChatEditSession } from './ChatEditSessionContext';
import { useChatReplySession } from './ChatReplySessionContext';
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

export default function ChatMessageContentWithReply(props) {
  const { message, isOwnMessage } = useMessageContext();
  const replySession = useChatReplySession();
  const editSession = useChatEditSession();
  const replyTo = message?.metadata?.replyTo;
  const canInteract = message?.id
    && message.status !== 'streaming'
    && message.status !== 'pending';

  const startReply = (event) => {
    event.stopPropagation();
    if (message) replySession?.startReply(message);
  };

  const startEdit = (event) => {
    event.stopPropagation();
    if (message?.role === 'user') editSession?.startEdit(message);
  };

  return (
    <Box
      data-chat-message-id={message?.id || undefined}
      className="chat-message-content"
      sx={{
        position: 'relative',
        minWidth: 0,
        maxWidth: '100%',
        '& [data-chat-hover-actions]': {
          opacity: 0,
          pointerEvents: 'none',
          transition: (t) => t.transitions.create('opacity', {
            duration: t.transitions.duration.shortest
          })
        },
        '.MuiChatMessage-root:hover & [data-chat-hover-actions], &:focus-within [data-chat-hover-actions]': {
          opacity: 1,
          pointerEvents: 'auto'
        },
        '@media (hover: none)': {
          '& [data-chat-hover-actions]': {
            opacity: 1,
            pointerEvents: 'auto'
          }
        }
      }}
    >
      {replyTo ? <ChatReplyQuote replyTo={replyTo} isOwnBubble={isOwnMessage} /> : null}
      <ChatMessageContent {...props} />
      {canInteract ? (
        <Box
          data-chat-hover-actions
          sx={{
            position: 'absolute',
            top: 4,
            right: isOwnMessage ? 4 : undefined,
            left: isOwnMessage ? undefined : 4,
            display: 'flex',
            flexDirection: 'column',
            gap: 0.25,
            zIndex: 1
          }}
        >
          <Tooltip title="Ответить" placement={isOwnMessage ? 'left' : 'right'}>
            <IconButton
              size="small"
              aria-label="Ответить"
              onClick={startReply}
              sx={hoverActionSx}
            >
              <ReplyIcon sx={{ fontSize: 16, color: 'primary.main' }} />
            </IconButton>
          </Tooltip>
          {isOwnMessage ? (
            <Tooltip title="Изменить" placement="left">
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
    </Box>
  );
}
