import { Box, CircularProgress, Paper, Typography } from '@mui/material';
import { USER_ACTION_MESSAGES } from '../utils/actionError';

function clampAnchor(anchor) {
  const x = Number(anchor?.x) || 0;
  const y = Number(anchor?.y) || 0;
  const maxLeft = Math.max(8, window.innerWidth - 408);
  const maxTop = Math.max(8, window.innerHeight - 320);
  return {
    left: Math.min(Math.max(8, x + 12), maxLeft),
    top: Math.min(Math.max(8, y + 12), maxTop)
  };
}

export default function CdrPreviewDialog({
  open,
  anchor = null,
  previewUrl,
  previewError,
  pending = false
}) {
  if (!open || !anchor) return null;
  if (!pending && !previewUrl && !previewError) return null;

  const { left, top } = clampAnchor(anchor);

  return (
    <Box
      sx={{
        position: 'fixed',
        left,
        top,
        zIndex: (theme) => theme.zIndex.modal + 2,
        pointerEvents: 'none',
        maxWidth: 400
      }}
    >
      <Paper elevation={8} sx={{ p: 0.5, bgcolor: 'background.paper', overflow: 'hidden' }}>
        {pending ? (
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 1.25,
              width: 220,
              minHeight: 140,
              px: 1.5,
              py: 2
            }}
          >
            <CircularProgress size={28} />
            <Typography variant="body2" color="text.secondary" textAlign="center">
              {USER_ACTION_MESSAGES.previewLoading}
            </Typography>
          </Box>
        ) : previewError ? (
          <Box sx={{ width: 260, px: 1.5, py: 1.5 }}>
            <Typography
              variant="body2"
              color="error"
              sx={{ whiteSpace: 'pre-line' }}
            >
              {previewError}
            </Typography>
          </Box>
        ) : (
          <Box
            component="img"
            src={previewUrl}
            alt=""
            sx={{
              display: 'block',
              maxWidth: '100%',
              maxHeight: 280
            }}
          />
        )}
      </Paper>
    </Box>
  );
}
