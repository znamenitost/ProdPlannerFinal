import { alpha, Box, Typography } from '@mui/material';
import { truncateReplyPreview } from './chatReplyPreview';
import { scrollToChatMessage } from './scrollToChatMessage';

export default function ChatReplyQuote({ replyTo, isOwnBubble = false }) {
  if (!replyTo) return null;

  const senderName = replyTo.senderFullName || 'Сообщение';
  const preview = truncateReplyPreview(replyTo.preview) || 'Сообщение';
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
      aria-label={`Перейти к сообщению: ${senderName}`}
      sx={{
        mb: 0.75,
        px: 1,
        py: 0.5,
        borderRadius: 1,
        borderLeft: '3px solid',
        borderLeftColor: barColor,
        bgcolor: bg,
        maxWidth: '100%',
        cursor: 'pointer',
        userSelect: 'none',
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
          mb: 0.15,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
      >
        {senderName}
      </Typography>
      <Typography
        variant="caption"
        sx={{
          color: previewColor,
          display: 'block',
          lineHeight: 1.25,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap'
        }}
      >
        {preview}
      </Typography>
    </Box>
  );
}
