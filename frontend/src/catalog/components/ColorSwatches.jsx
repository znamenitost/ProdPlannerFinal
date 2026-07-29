import { Box, Stack, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';

export default function ColorSwatches({
  variants,
  selectedId,
  onSelect,
  onPreview
}) {
  const selected = variants.find((v) => v.id === selectedId);

  return (
    <Box>
      <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
        Цвет{selected ? ` · ${selected.colorName}` : ''}
      </Typography>
      <Stack direction="row" spacing={0.75} useFlexGap sx={{ flexWrap: 'wrap' }}>
        {variants.map((v) => {
          const isSelected = v.id === selectedId;
          return (
            <Box
              key={v.id}
              component="button"
              type="button"
              disabled={!v.isAvailable}
              onClick={() => onSelect(v)}
              onMouseEnter={() => onPreview?.(v)}
              title={v.colorName}
              aria-label={v.colorName}
              aria-pressed={isSelected}
              sx={{
                width: 32,
                height: 32,
                p: 0,
                borderRadius: 1,
                border: '2px solid',
                borderColor: isSelected ? 'primary.main' : 'divider',
                outline: isSelected ? (t) => `2px solid ${alpha(t.palette.primary.main, 0.28)}` : 'none',
                outlineOffset: 1,
                bgcolor: v.colorHex,
                cursor: v.isAvailable ? 'pointer' : 'not-allowed',
                opacity: v.isAvailable ? 1 : 0.4,
                overflow: 'hidden'
              }}
            />
          );
        })}
      </Stack>
    </Box>
  );
}
