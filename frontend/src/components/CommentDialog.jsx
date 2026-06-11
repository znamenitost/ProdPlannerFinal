// ./frontend/src/components/CommentDialog.jsx
import { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField } from '@mui/material';
import { Comment, Save, Close } from '@mui/icons-material';

export default function CommentDialog({ open, comment, pending = false, onSave, onClose }) {
  const [value, setValue] = useState(comment || '');

  useEffect(() => {
    if (open) {
      setValue(comment || '');
    }
  }, [open, comment]);

  const handleSave = () => {
    if (pending) return;
    onSave(value);
  };

  return (
    <Dialog open={open} onClose={pending ? undefined : onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Comment color="primary" fontSize="small" />
        Редактирование комментария
      </DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          margin="dense"
          label="Комментарий"
          fullWidth
          multiline
          rows={3}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} startIcon={<Close />} disabled={pending}>Отмена</Button>
        <Button onClick={handleSave} variant="contained" startIcon={<Save />} disabled={pending}>
          Сохранить
        </Button>
      </DialogActions>
    </Dialog>
  );
}