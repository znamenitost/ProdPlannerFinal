import { useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  CircularProgress
} from '@mui/material';
import { Close, FolderOpen, Image } from '@mui/icons-material';

export default function CdrPreviewDialog({
  open,
  taskTitle = '',
  previewUrl,
  previewInfo = '',
  previewPath = '',
  previewError = '',
  needsPick = false,
  pending = false,
  onClose,
  onFilePicked
}) {
  const fileInputRef = useRef(null);
  const autoPickDoneRef = useRef(false);

  useEffect(() => {
    if (!open) {
      autoPickDoneRef.current = false;
      return;
    }
    if (!pending && needsPick && !previewUrl && !previewError && !autoPickDoneRef.current) {
      autoPickDoneRef.current = true;
      window.requestAnimationFrame(() => fileInputRef.current?.click());
    }
  }, [open, pending, needsPick, previewUrl, previewError]);

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !onFilePicked) return;
    await onFilePicked(file);
  };

  return (
    <Dialog open={open} onClose={pending ? undefined : onClose} maxWidth="md" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Image color="primary" fontSize="small" />
        Превью .cdr
      </DialogTitle>
      <DialogContent>
        {taskTitle ? (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {taskTitle}
          </Typography>
        ) : null}
        {previewPath ? (
          <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 2 }}>
            Файл: {previewPath}
          </Typography>
        ) : null}
        {pending ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
            <CircularProgress size={32} />
          </Box>
        ) : previewError ? (
          <Typography color="error" sx={{ whiteSpace: 'pre-wrap', mb: 2 }}>
            {previewError}
          </Typography>
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
        ) : needsPick ? (
          <Typography color="text.secondary">
            Выберите .cdr в диалоге (тот же файл, что открывается по иконке папки).
          </Typography>
        ) : (
          <Typography color="text.secondary">Превью не найдено</Typography>
        )}
      </DialogContent>
      <DialogActions>
        {needsPick && !pending && (
          <Button
            startIcon={<FolderOpen />}
            onClick={() => fileInputRef.current?.click()}
            disabled={pending}
          >
            Выбрать .cdr
          </Button>
        )}
        <Button onClick={onClose} startIcon={<Close />} disabled={pending}>
          Закрыть
        </Button>
      </DialogActions>
      <input
        ref={fileInputRef}
        type="file"
        hidden
        accept=".cdr"
        onChange={handleFileChange}
      />
    </Dialog>
  );
}
