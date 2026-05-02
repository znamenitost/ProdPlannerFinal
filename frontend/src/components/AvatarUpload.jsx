import { useState, useRef, useEffect } from 'react';
import {
  Avatar,
  IconButton,
  Menu,
  MenuItem,
  CircularProgress,
  Snackbar,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  Box,
  Badge
} from '@mui/material';
import { PhotoCamera, Delete, CloudUpload } from '@mui/icons-material';

export default function AvatarUpload({ user, onAvatarUpdate }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const fileInputRef = useRef(null);

  // Очищаем anchorEl при размонтировании или изменении user
  useEffect(() => {
    return () => {
      setAnchorEl(null);
    };
  }, [user]);

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleFileSelect = () => {
    fileInputRef.current?.click();
    handleMenuClose();
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setSnackbar({ open: true, message: 'Пожалуйста, выберите изображение', severity: 'error' });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      setSnackbar({ open: true, message: 'Размер файла не должен превышать 2MB', severity: 'error' });
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await fetch('/api/auth/upload-avatar', {
        method: 'POST',
        body: formData,
        credentials: 'include'
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message);

      setSnackbar({ open: true, message: 'Аватар успешно загружен!', severity: 'success' });
      if (onAvatarUpdate) onAvatarUpdate(data.avatarUrl);
    } catch (err) {
      setSnackbar({ open: true, message: err.message || 'Ошибка загрузки', severity: 'error' });
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteAvatar = async () => {
    setConfirmDialogOpen(false);
    setLoading(true);

    try {
      const response = await fetch('/api/auth/avatar', {
        method: 'DELETE',
        credentials: 'include'
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message);

      setSnackbar({ open: true, message: 'Аватар удалён', severity: 'success' });
      if (onAvatarUpdate) onAvatarUpdate(null);
    } catch (err) {
      setSnackbar({ open: true, message: err.message || 'Ошибка удаления', severity: 'error' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Badge
        overlap="circular"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        badgeContent={
          <IconButton
            size="small"
            onClick={handleMenuOpen}
            sx={{
              bgcolor: 'white',
              boxShadow: 1,
              '&:hover': { bgcolor: '#f5f5f5' }
            }}
          >
            <PhotoCamera sx={{ fontSize: 16 }} />
          </IconButton>
        }
      >
        <Avatar
          src={user?.avatarUrl ? `http://localhost:5234${user.avatarUrl}` : undefined}
          sx={{ width: 40, height: 40, bgcolor: 'primary.main', cursor: 'pointer' }}
          onClick={handleMenuOpen}
        >
          {!user?.avatarUrl && (user?.fullName?.[0] || 'U')}
        </Avatar>
      </Badge>

      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={handleFileChange}
      />

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
      >
        <MenuItem onClick={handleFileSelect} disabled={loading}>
          <CloudUpload sx={{ mr: 1, fontSize: 20 }} />
          Загрузить фото
        </MenuItem>
        {user?.avatarUrl && (
          <MenuItem onClick={() => setConfirmDialogOpen(true)} disabled={loading} sx={{ color: '#dc2626' }}>
            <Delete sx={{ mr: 1, fontSize: 20 }} />
            Удалить фото
          </MenuItem>
        )}
      </Menu>

      <Dialog open={confirmDialogOpen} onClose={() => setConfirmDialogOpen(false)}>
        <DialogTitle>Удалить аватар?</DialogTitle>
        <DialogContent>
          <Typography>Вы уверены, что хотите удалить свой аватар?</Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirmDialogOpen(false)}>Отмена</Button>
          <Button onClick={handleDeleteAvatar} color="error" variant="contained">
            Удалить
          </Button>
        </DialogActions>
      </Dialog>

      {loading && (
        <Box sx={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 9999 }}>
          <CircularProgress />
        </Box>
      )}

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar({ ...snackbar, open: false })}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
}