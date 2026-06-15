import { Box, CircularProgress, Paper } from '@mui/material';

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
  pending = false
}) {
  if (!open || !anchor) return null;
  if (!pending && !previewUrl) return null;

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
              justifyContent: 'center',
              alignItems: 'center',
              width: 200,
              height: 140
            }}
          >
            <CircularProgress size={28} />
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
