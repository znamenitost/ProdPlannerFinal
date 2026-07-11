import { alpha, Box, Typography } from '@mui/material';
import { scrollToChatMessage } from './scrollToChatMessage';

export default function ChatReplyQuote({ replyTo, isOwnBubble = false }) {
  if (!replyTo) return null;

  const accent = isOwnBubble ? 'rgba(255,255,255,0.95)' : 'primary.main';
  const previewColor = isOwnBubble ? 'rgba(255,255,255,0.78)' : 'text.secondary';
  const barColor = isOwnBubble ? 'rgba(255,255,255,0.85)' : 'primary.main';
  const bg = isOwnBubble ? 'rgba(255,255,255,0.12)' : (t) => alpha(t.palette.primary.main, 0.06);

  const handleClick = () => {
    if (replyTo.id) scrollToChatMessage(replyTo.id);
  };

  return (
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
      aria-label={`Перейти к сообщению: ${replyTo.senderFullName || 'Сообщение'}`}
      sx={{
        mb: 0.75,
        px: 1,
        py: 0.5,
        borderRadius: 1,
        borderLeft: `3px solid`,
        borderLeftColor: barColor,
        bgcolor: bg,
        maxWidth: '100%',
        cursor: 'pointer',
        transition: (t) => t.transitions.create('background-color', {
          duration: t.transitions.duration.shortest
        }),
        '&:hover': {
          bgcolor: isOwnBubble ? 'rgba(255,255,255,0.18)' : (t) => alpha(t.palette.primary.main, 0.1)
        }
      }}
    >
      <Typography
        variant="caption"
        sx={{
          fontWeight: 700,
          color: accent,
          display: 'block',
          lineHeight: 1.2,
          mb: 0.15
        }}
      >
        {replyTo.senderFullName || 'Сообщение'}
      </Typography>
      <Typography
        variant="caption"
        noWrap
        sx={{
          color: previewColor,
          display: 'block',
          lineHeight: 1.25
        }}
      >
        {replyTo.preview || 'Сообщение'}
      </Typography>
    </Box>
  );
}
