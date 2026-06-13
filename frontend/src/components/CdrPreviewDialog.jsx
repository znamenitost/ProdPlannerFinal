import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Box, Typography, CircularProgress } from '@mui/material';
import { Close, Image } from '@mui/icons-material';

export default function CdrPreviewDialog({
  open,
  taskTitle = '',
  previewUrl,
  previewInfo = '',
  previewPath = '',
  pending = false,
  onClose
}) {
  return (
    <Dialog open={open} onClose={pending ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Image color="primary" fontSize="small" />
        Превью .cdr (dev)
      </DialogTitle>
      <DialogContent>
        {taskTitle ? (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {taskTitle}
          </Typography>
        ) : null}
        {previewPath ? (
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
            Источник: {previewPath}
          </Typography>
        ) : null}
        {pending ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={32} />
          </Box>
        ) : previewUrl ? (
          <Box>
            {previewInfo ? (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, whiteSpace: 'pre-wrap' }}>
                {previewInfo}
              </Typography>
            ) : null}
            <Box
              component="img"
              src={previewUrl}
              alt="CDR preview"
              sx={{ maxWidth: '100%', maxHeight: 480, border: 1, borderColor: 'divider', borderRadius: 1 }}
            />
          </Box>
        ) : (
          <Typography color="text.secondary">Превью не найдено</Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} startIcon={<Close />} disabled={pending}>
          Закрыть
        </Button>
      </DialogActions>
    </Dialog>
  );
}
