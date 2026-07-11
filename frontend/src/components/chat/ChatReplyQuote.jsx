import { alpha, Box, Typography } from '@mui/material';

export default function ChatReplyQuote({ replyTo, isOwnBubble = false }) {
  if (!replyTo) return null;

  const accent = isOwnBubble ? 'rgba(255,255,255,0.95)' : 'primary.main';
  const previewColor = isOwnBubble ? 'rgba(255,255,255,0.78)' : 'text.secondary';
  const barColor = isOwnBubble ? 'rgba(255,255,255,0.85)' : 'primary.main';
  const bg = isOwnBubble ? 'rgba(255,255,255,0.12)' : (t) => alpha(t.palette.primary.main, 0.06);

  return (
    <Box
      sx={{
        mb: 0.75,
        px: 1,
        py: 0.5,
        borderRadius: 1,
        borderLeft: `3px solid`,
        borderLeftColor: barColor,
        bgcolor: bg,
        maxWidth: '100%'
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
