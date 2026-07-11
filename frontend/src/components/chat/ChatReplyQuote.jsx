import { alpha, Box, Divider, Typography } from '@mui/material';
import { truncateReplyPreview } from './chatReplyPreview';
import { scrollToChatMessage } from './scrollToChatMessage';

export default function ChatReplyQuote({ replyTo, isOwnBubble = false, showDivider = true }) {
  if (!replyTo) return null;

  const senderName = replyTo.senderFullName || 'Сообщение';
  const preview = truncateReplyPreview(replyTo.preview) || 'Сообщение';

  const handleClick = () => {
    if (replyTo.id) scrollToChatMessage(replyTo.id);
  };

  return (
    <>
      <Box
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            handleClick();
          }
        }}
        aria-label={`Перейти к сообщению: ${senderName}`}
        sx={{
          mx: -1.5,
          mt: -1,
          mb: 0,
          px: 1.25,
          py: 0.75,
          borderLeft: '3px solid',
          borderLeftColor: isOwnBubble ? 'rgba(255,255,255,0.9)' : 'primary.main',
          bgcolor: isOwnBubble
            ? 'rgba(0,0,0,0.14)'
            : (t) => alpha(t.palette.grey[500], 0.12),
          cursor: 'pointer',
          userSelect: 'none',
          transition: (t) => t.transitions.create('background-color', {
            duration: t.transitions.duration.shortest
          }),
          '&:hover': {
            bgcolor: isOwnBubble
              ? 'rgba(0,0,0,0.2)'
              : (t) => alpha(t.palette.grey[500], 0.18)
          }
        }}
      >
        <Typography
          variant="caption"
          component="div"
          sx={{
            lineHeight: 1.3,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}
        >
          <Box
            component="span"
            sx={{
              fontWeight: 700,
              color: isOwnBubble ? 'rgba(255,255,255,0.95)' : 'primary.main'
            }}
          >
            {senderName}
          </Box>
          <Box
            component="span"
            sx={{
              color: isOwnBubble ? 'rgba(255,255,255,0.78)' : 'text.secondary'
            }}
          >
            {`: ${preview}`}
          </Box>
        </Typography>
      </Box>
      {showDivider ? (
        <Divider
          sx={{
            mx: -1.5,
            mb: 0.75,
            borderColor: isOwnBubble ? 'rgba(255,255,255,0.22)' : 'divider'
          }}
        />
      ) : null}
    </>
  );
}
