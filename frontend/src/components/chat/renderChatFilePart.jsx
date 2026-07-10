import { alpha, Box, Link } from '@mui/material';
import { InsertDriveFile } from '@mui/icons-material';
import ChatImagePreview from './ChatImagePreview';

export function renderChatFilePart({ part }) {
  const filename = part.filename || 'Файл';
  const isImage = part.mediaType?.startsWith('image/');

  if (isImage && part.url) {
    return (
      <ChatImagePreview
        src={part.url}
        alt={filename}
        maxPreviewHeight={280}
        maxPreviewWidth={320}
      />
    );
  }

  return (
    <Box
      component={Link}
      href={part.url}
      target="_blank"
      rel="noopener noreferrer"
      underline="none"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 0.75,
        px: 1.25,
        py: 0.5,
        maxWidth: 280,
        borderRadius: 2,
        border: (t) => `1px solid ${t.palette.divider}`,
        bgcolor: (t) => alpha(t.palette.background.paper, 0.8),
        color: 'text.primary',
        fontSize: '0.8125rem',
        '&:hover': {
          bgcolor: (t) => alpha(t.palette.primary.main, 0.06),
          borderColor: 'primary.light'
        }
      }}
    >
      <InsertDriveFile sx={{ fontSize: 18, color: 'text.secondary', flexShrink: 0 }} />
      <Box
        component="span"
        sx={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          minWidth: 0
        }}
      >
        {filename}
      </Box>
    </Box>
  );
}
