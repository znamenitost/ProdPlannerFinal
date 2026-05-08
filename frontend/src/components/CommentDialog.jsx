// ./frontend/src/components/CommentDialog.jsx
import { useState, useEffect } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField } from '@mui/material';

export default function CommentDialog({ open, comment, onSave, onClose }) {
  const [value, setValue] = useState(comment || '');

  useEffect(() => {
    if (open) {
      setValue(comment || '');
    }
  }, [open, comment]);

  const handleSave = () => {
    onSave(value);
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Редактирование комментария</DialogTitle>
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
        <Button onClick={onClose}>Отмена</Button>
        <Button onClick={handleSave} variant="contained">Сохранить</Button>
      </DialogActions>
    </Dialog>
  );
}