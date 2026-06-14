import { Box, CircularProgress, Paper, Typography } from '@mui/material';
import { Image } from '@mui/icons-material';

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
  taskTitle = '',
  previewUrl,
  previewInfo = '',
  previewPath = '',
  previewError = '',
  pending = false
}) {
  if (!open || !anchor) return null;

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
      <Paper elevation={8} sx={{ p: 1.5, bgcolor: 'background.paper' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 0.5 }}>
          <Image color="primary" sx={{ fontSize: 18 }} />
          <Typography variant="subtitle2" component="span">
            Превью .cdr
          </Typography>
        </Box>
        {taskTitle ? (
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 0.5 }}>
            {taskTitle}
          </Typography>
        ) : null}
        {previewPath ? (
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
            {previewPath}
          </Typography>
        ) : null}
        {pending ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress size={28} />
          </Box>
        ) : previewError ? (
          <Typography variant="body2" color="error" sx={{ whiteSpace: 'pre-wrap' }}>
            {previewError}
          </Typography>
        ) : previewUrl ? (
          <Box>
            {previewInfo ? (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mb: 0.5, whiteSpace: 'pre-wrap' }}
              >
                {previewInfo}
              </Typography>
            ) : null}
            <Box
              component="img"
              src={previewUrl}
              alt="CDR preview"
              sx={{
                display: 'block',
                maxWidth: '100%',
                maxHeight: 280,
                border: 1,
                borderColor: 'divider',
                borderRadius: 1
              }}
            />
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Превью не найдено
          </Typography>
        )}
      </Paper>
    </Box>
  );
}
