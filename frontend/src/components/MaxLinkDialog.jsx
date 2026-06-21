import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box
} from '@mui/material';

export default function MaxLinkDialog({ open, token, onClose }) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Привязка MAX</DialogTitle>
      <DialogContent>
        {token ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-line' }}>
              {token.instruction}
            </Typography>
            <Typography
              variant="h5"
              component="p"
              sx={{ fontFamily: 'monospace', letterSpacing: '0.08em', userSelect: 'all' }}
            >
              /link {token.code}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Код действует до {new Date(token.expiresAt).toLocaleString('ru-RU')}.
            </Typography>
          </Box>
        ) : (
          <Typography variant="body2" color="text.secondary">
            Получение кода…
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Закрыть</Button>
      </DialogActions>
    </Dialog>
  );
}
