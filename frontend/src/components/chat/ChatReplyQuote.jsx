import { Box, Typography } from '@mui/material';
import { tokens } from '../../theme/paletteTokens';
import { truncateReplyPreview } from './chatReplyPreview';
import { scrollToChatMessage } from './scrollToChatMessage';

const BUBBLE_PADDING_X = 1.5;
const { neutral, primary } = tokens;

function quoteSurface(isOwnBubble) {
  if (isOwnBubble) {
    return {
      bgcolor: primary.dark,
      borderLeftColor: neutral[700],
      hoverBg: '#5E8399',
      nameColor: primary.contrastText,
      previewColor: primary.light
    };
  }

  return {
    bgcolor: neutral[200],
    borderLeftColor: neutral[600],
    hoverBg: neutral[300],
    nameColor: primary.dark,
    previewColor: neutral[600]
  };
}

export default function ChatReplyQuote({ replyTo, isOwnBubble = false }) {
  if (!replyTo) return null;

  const senderName = replyTo.senderFullName || 'Сообщение';
  const preview = truncateReplyPreview(replyTo.preview) || 'Сообщение';
  const surface = quoteSurface(isOwnBubble);

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
      sx={(theme) => ({
        px: BUBBLE_PADDING_X,
        pt: 1,
        pb: 0.75,
        borderLeft: '3px solid',
        borderLeftColor: surface.borderLeftColor,
        bgcolor: surface.bgcolor,
        cursor: 'pointer',
        userSelect: 'none',
        transition: theme.transitions.create('background-color', {
          duration: theme.transitions.duration.shortest
        }),
        '&:hover': {
          bgcolor: surface.hoverBg
        }
      })}
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
            color: surface.nameColor
          }}
        >
          {senderName}
        </Box>
        <Box
          component="span"
          sx={{
            color: surface.previewColor
          }}
        >
          {`: ${preview}`}
        </Box>
      </Typography>
    </Box>
  );
}

export { BUBBLE_PADDING_X };
