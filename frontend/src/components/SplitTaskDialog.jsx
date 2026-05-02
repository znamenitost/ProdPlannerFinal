import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Stack, Select, MenuItem, TextField, IconButton, Typography, Alert } from '@mui/material';
import { Add, Remove } from '@mui/icons-material';
import { useState } from 'react';
import { splitTask } from '../services/api';

const SPLIT_TYPES = ['резка', 'УФ печать']; // можно вынести в отдельный API, но для теста хватит
const EMPLOYEES = ['Дима', 'Яромир', 'Павел'];

export default function SplitTaskDialog({ open, task, onClose, onSplit }) {
  const [blocks, setBlocks] = useState([
    { employeeName: EMPLOYEES[0], type: SPLIT_TYPES[0], hours: 0 }
  ]);
  const [error, setError] = useState('');

  const addBlock = () => setBlocks([...blocks, { employeeName: EMPLOYEES[0], type: SPLIT_TYPES[0], hours: 0 }]);
  const removeBlock = (idx) => setBlocks(blocks.filter((_, i) => i !== idx));
  const updateBlock = (idx, field, value) => {
    const newBlocks = [...blocks];
    newBlocks[idx][field] = value;
    setBlocks(newBlocks);
  };

  const totalHours = blocks.reduce((sum, b) => sum + (b.hours || 0), 0);
  const isValid = Math.abs(totalHours - (task?.estimateHours || 0)) < 0.01 && blocks.every(b => b.hours > 0 && b.employeeName && b.type);

  const handleSubmit = async () => {
    setError('');
    try {
      await splitTask(task.id, blocks);
      onSplit();
      onClose();
    } catch (err) {
      setError(err.message || 'Ошибка разбиения задачи');
    }
  };

  if (!task) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Разбить задачу: {task.title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {blocks.map((block, idx) => (
            <Stack key={idx} direction="row" spacing={1} alignItems="center">
              <Select
                size="small"
                value={block.employeeName}
                onChange={(e) => updateBlock(idx, 'employeeName', e.target.value)}
                sx={{ width: 120 }}
              >
                {EMPLOYEES.map(emp => <MenuItem key={emp} value={emp}>{emp}</MenuItem>)}
              </Select>
              <Select
                size="small"
                value={block.type}
                onChange={(e) => updateBlock(idx, 'type', e.target.value)}
                sx={{ width: 120 }}
              >
                {SPLIT_TYPES.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </Select>
              <TextField
                size="small"
                type="number"
                label="Часы"
                value={block.hours}
                onChange={(e) => updateBlock(idx, 'hours', parseFloat(e.target.value) || 0)}
                sx={{ width: 100 }}
                inputProps={{ step: 0.5, min: 0 }}
              />
              {blocks.length > 1 && (
                <IconButton size="small" onClick={() => removeBlock(idx)}><Remove /></IconButton>
              )}
            </Stack>
          ))}
          <Button startIcon={<Add />} onClick={addBlock}>Добавить блок</Button>
          <Typography variant="body2" color={Math.abs(totalHours - task.estimateHours) < 0.01 ? 'green' : 'error'}>
            Сумма часов: {totalHours.toFixed(1)} / {task.estimateHours}
          </Typography>
          {error && <Alert severity="error">{error}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Отмена</Button>
        <Button variant="contained" onClick={handleSubmit} disabled={!isValid}>Разбить</Button>
      </DialogActions>
    </Dialog>
  );
}