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
import EstimateHoursInput from './EstimateHoursInput';
import { partsToApi } from '../utils/splitTaskUtils';

export default function SplitTaskModal({
  open,
  mode = 'split',
  task,
  initialParts,
  employees,
  taskTypes,
  onClose,
  onSuccess,
  onDraftApply
}) {
  const [parts, setParts] = useState([]);
  const [error, setError] = useState('');
  const [removeWarning, setRemoveWarning] = useState('');

  const isDraft = mode === 'draft';
  const isEdit = mode === 'edit';
  const isFreeHoursMode = isDraft || isEdit || mode === 'split';

  useEffect(() => {
    if (!open) return;

    const defaultPart = { employeeName: employees[0], taskTypes: [taskTypes[0]], hours: 0 };

    if (initialParts?.length) {
      setParts(initialParts.map(p => ({
        childTaskId: p.childTaskId,
        employeeName: p.employeeName,
        taskTypes: p.taskTypes?.length ? p.taskTypes : [taskTypes[0]],
        hours: p.hours ?? 0,
        statusText: p.statusText || '',
        started: p.started ?? false
      })));
    } else if (isDraft) {
      setParts([{ ...defaultPart, hours: 0 }]);
    } else {
      setParts([defaultPart]);
    }
    setError('');
    setRemoveWarning('');
  }, [open, task, initialParts, mode, employees, taskTypes, isDraft]);

  const revalidateHours = (newParts) => {
    const sum = newParts.reduce((acc, p) => acc + (parseFloat(p.hours) || 0), 0);
    if (isFreeHoursMode) {
      if (newParts.length < 1) {
        setError('Добавьте сотрудника');
      } else if (sum <= 0) {
        setError('Укажите часы для каждого сотрудника');
      } else {
        setError('');
      }
      return;
    }
    setError('');
  };

  const addPart = () => {
    const next = [...parts, { employeeName: employees[0], taskTypes: [taskTypes[0]], hours: 0 }];
    setParts(next);
    revalidateHours(next);
  };

  const removePart = (index) => {
    if (isEdit && parts.length <= 1) {
      setError('Должен остаться хотя бы один сотрудник. Сохраните — задача станет обычной.');
      return;
    }
    const removed = parts[index];
    if (isEdit && removed?.started && removed?.childTaskId) {
      setRemoveWarning(
        `Сотрудник ${removed.employeeName} уже начал работу — при сохранении его подзадача будет завершена.`
      );
    }
    const next = parts.filter((_, i) => i !== index);
    setParts(next);
    revalidateHours(next);
  };

  const updatePart = (index, field, value) => {
    const next = [...parts];
    next[index][field] = value;
    setParts(next);
    revalidateHours(next);
  };

  const validateParts = () => {
    const sum = parts.reduce((acc, p) => acc + (parseFloat(p.hours) || 0), 0);
    if (parts.some(p => !p.employeeName || p.taskTypes.length === 0 || !(parseFloat(p.hours) > 0))) {
      setError('Заполните все поля для каждой части');
      return false;
    }
    if (isDraft && parts.length < 1) {
      setError('Добавьте сотрудника');
      return false;
    }
    if (isFreeHoursMode && sum <= 0) {
      setError('Укажите часы для каждого сотрудника');
      return false;
    }
    return true;
  };

  const partsSum = parts.reduce((acc, p) => acc + (parseFloat(p.hours) || 0), 0);
  const displayTotalHours = partsSum;

  const handleSubmit = async () => {
    if (!validateParts()) return;

    if (isDraft) {
      onDraftApply?.(partsToApi(parts), parts);
      onClose();
      return;
    }

    try {
      const body = { parentTaskId: task.id, parts: partsToApi(parts) };
      const url = isEdit ? `/api/tasks/split/${task.id}` : '/api/tasks/split';
      const response = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || data.error);

      onSuccess?.(data);
      onClose();
    } catch (err) {
      setError(err.message);
    }
  };

  const taskLabel = task?.fileName || task?.folderPath || '';
  const title = isDraft
    ? 'Назначения'
    : isEdit
      ? 'Редактирование назначений'
      : 'Разделение задачи';
  const submitLabel = isDraft ? 'Применить' : isEdit ? 'Сохранить' : 'Разделить';

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {title}
        {taskLabel && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {taskLabel}
          </Typography>
        )}
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {isDraft
            ? parts.length >= 2
              ? `Общая задача · ${displayTotalHours.toFixed(1)} ч (сумма по сотрудникам)`
              : `Обычная задача · ${displayTotalHours.toFixed(1)} ч`
            : parts.length === 1
              ? `Обычная задача · ${displayTotalHours.toFixed(1)} ч (попадёт в столбец «Часы»)`
              : `Общая задача · ${displayTotalHours.toFixed(1)} ч (сумма по сотрудникам)`}
        </Typography>
      </DialogTitle>

      <DialogContent>
        {(isEdit || mode === 'split') && (
          <Alert severity="info" sx={{ mb: 2 }}>
            Укажите нужное время для каждого сотрудника — ограничений по столбцу «Часы» нет.
            После сохранения в таблице отобразится сумма (или часы одного сотрудника).
            Один сотрудник — обычная задача, несколько — общая.
            Если убрать сотрудника, который уже начал подзадачу, она будет автоматически завершена.
          </Alert>
        )}
        {removeWarning && (
          <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setRemoveWarning('')}>
            {removeWarning}
          </Alert>
        )}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
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
                  {isEdit && part.started && (
                    <Typography variant="caption" color="warning.main" sx={{ mt: 0.5, display: 'block' }}>
                      {part.statusText || 'В работе'}
                    </Typography>
                  )}
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

                <EstimateHoursInput
                  value={part.hours}
                  onChange={(hours) => updatePart(idx, 'hours', hours)}
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

          <Button startIcon={<Add />} onClick={addPart} variant="outlined" size="small">
            Добавить сотрудника
          </Button>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Отмена</Button>
        <Button onClick={handleSubmit} variant="contained" color="primary">
          {submitLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
