import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Stack,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  TextField,
  IconButton,
  Typography,
  Alert,
  Paper,
  Checkbox,
  ListItemText,
  OutlinedInput
} from '@mui/material';
import { Add, Delete } from '@mui/icons-material';

export default function SplitTaskModal({ open, task, onClose, onSuccess }) {
  const [parts, setParts] = useState([]);
  const [error, setError] = useState('');
  const [totalHours, setTotalHours] = useState(0);
  
  const employees = ['Дима', 'Яромир', 'Павел'];
  const taskTypes = ['Резка', 'УФ печать', 'Монтаж', 'Дизайн', 'Сборка', 'Упаковка'];

  useEffect(() => {
    if (task && open) {
      setParts([{ employeeName: employees[0], taskTypes: [taskTypes[0]], hours: 0 }]);
      setTotalHours(task.estimateHours);
      setError('');
    }
  }, [task, open]);

  const addPart = () => {
    setParts([...parts, { employeeName: employees[0], taskTypes: [taskTypes[0]], hours: 0 }]);
  };

  const removePart = (index) => {
    const newParts = parts.filter((_, i) => i !== index);
    setParts(newParts);
  };

  const updatePart = (index, field, value) => {
    const newParts = [...parts];
    newParts[index][field] = value;
    setParts(newParts);
    
    const sum = newParts.reduce((acc, p) => acc + (parseFloat(p.hours) || 0), 0);
    if (sum > totalHours) {
      setError(`Сумма часов (${sum}) превышает выделенное время (${totalHours})`);
    } else if (Math.abs(sum - totalHours) < 0.01) {
      setError('');
    } else {
      setError(`Осталось распределить ${(totalHours - sum).toFixed(1)} ч`);
    }
  };

  const handleSubmit = async () => {
    const sum = parts.reduce((acc, p) => acc + (parseFloat(p.hours) || 0), 0);
    if (Math.abs(sum - totalHours) > 0.01) {
      setError(`Сумма часов должна равняться ${totalHours} ч`);
      return;
    }
    
    if (parts.some(p => !p.employeeName || p.taskTypes.length === 0 || p.hours <= 0)) {
      setError('Заполните все поля для каждой части');
      return;
    }
    
    try {
      const response = await fetch('/api/tasks/split', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parentTaskId: task.id,
          parts: parts.map(p => ({
            employeeName: p.employeeName,
            taskType: p.taskTypes.join(', '),
            allocatedHours: parseFloat(p.hours)
          }))
        })
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.message);
      
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        Разделение задачи: {task?.title?.substring(0, 50)}...
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Всего часов: {totalHours} ч
        </Typography>
      </DialogTitle>
      
      <DialogContent>
        {error && (
          <Alert severity={error.includes('превышает') ? 'error' : 'info'} sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        <Stack spacing={2}>
          {parts.map((part, idx) => (
            <Paper key={idx} variant="outlined" sx={{ p: 2 }}>
              <Stack direction="row" spacing={2} sx={{ alignItems: 'flex-start', flexWrap: 'wrap' }}>
                <FormControl size="small" sx={{ minWidth: 120 }}>
                  <InputLabel>Сотрудник</InputLabel>
                  <Select
                    value={part.employeeName}
                    label="Сотрудник"
                    onChange={(e) => updatePart(idx, 'employeeName', e.target.value)}
                  >
                    {employees.map(emp => (
                      <MenuItem key={emp} value={emp}>{emp}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
                
                <FormControl size="small" sx={{ minWidth: 200, flex: 2 }}>
                  <InputLabel>Типы работ</InputLabel>
                  <Select
                    multiple
                    value={part.taskTypes}
                    label="Типы работ"
                    onChange={(e) => updatePart(idx, 'taskTypes', e.target.value)}
                    input={<OutlinedInput label="Типы работ" />}
                    renderValue={(selected) => selected.join(', ')}
                  >
                    {taskTypes.map((type) => (
                      <MenuItem key={type} value={type}>
                        <Checkbox checked={part.taskTypes.includes(type)} />
                        <ListItemText primary={type} />
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                
                <TextField
                  size="small"
                  type="number"
                  label="Часы"
                  value={part.hours}
                  onChange={(e) => updatePart(idx, 'hours', e.target.value)}
                  slotProps={{ htmlInput: { step: 0.5, min: 0 } }}
                  sx={{ width: 100 }}
                />
                
                {parts.length > 1 && (
                  <IconButton color="error" onClick={() => removePart(idx)}>
                    <Delete />
                  </IconButton>
                )}
              </Stack>
            </Paper>
          ))}
          
          <Button
            startIcon={<Add />}
            onClick={addPart}
            variant="outlined"
            size="small"
          >
            Добавить часть
          </Button>
        </Stack>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>Отмена</Button>
        <Button onClick={handleSubmit} variant="contained" color="primary">
          Разделить
        </Button>
      </DialogActions>
    </Dialog>
  );
}