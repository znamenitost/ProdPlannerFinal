import { Box, Chip } from '@mui/material';

function typeParts(type) {
  const key = String(type || '').trim();
  if (!key) return [];
  return key.split(',').map((part) => part.trim()).filter(Boolean);
}

export default function TaskTypeGlyph({ type, compact = false }) {
  const parts = typeParts(type);
  if (!parts.length) return null;

  return (
    <Box
      aria-label={parts.join(', ')}
      sx={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: 0.75,
        minWidth: 0
      }}
    >
      {parts.map((part) => (
        <Chip
          key={part}
          size="small"
          label={part}
          variant="outlined"
          sx={{
            height: compact ? 18 : 22,
            maxWidth: '100%',
            fontSize: compact ? '0.62rem' : '0.7rem',
            fontWeight: 600,
            '& .MuiChip-label': {
              px: compact ? 0.65 : 0.85,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }
          }}
        />
      ))}
    </Box>
  );
}
