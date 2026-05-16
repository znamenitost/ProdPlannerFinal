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

function partsToApi(parts) {
  return parts.map(p => ({
    childTaskId: p.childTaskId || null,
    employeeName: p.employeeName,
    taskType: p.taskTypes.join(', '),
    allocatedHours: parseFloat(p.hours)
  }));
}

function parseTypeToArray(type) {
  if (!type) return [];
  return type.split(',').map(s => s.trim()).filter(Boolean);
}

export function childrenToModalParts(children, employees, taskTypes) {
  if (!children?.length) return null;
  return children.map(c => ({
    childTaskId: c.id,
    employeeName: c.employeeName || employees[0],
    taskTypes: parseTypeToArray(c.type).length ? parseTypeToArray(c.type) : [taskTypes[0]],
    hours: c.estimateHours ?? 0
  }));
}

export function apiPartsToModalParts(parts, employees, taskTypes) {
  if (!parts?.length) return null;
  return parts.map(p => ({
    employeeName: p.employeeName,
    taskTypes: parseTypeToArray(p.taskType).length ? parseTypeToArray(p.taskType) : [taskTypes[0]],
    hours: p.allocatedHours ?? 0
  }));
}

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
  const parentHours = task?.estimateHours;
  const hasParentHours = parentHours !== '' && parentHours != null && !Number.isNaN(Number(parentHours)) && Number(parentHours) > 0;
  const totalHours = hasParentHours ? Number(parentHours) : 0;

  const isDraft = mode === 'draft';
  const isEdit = mode === 'edit';

  useEffect(() => {
    if (!open) return;

    const defaultPart = { employeeName: employees[0], taskTypes: [taskTypes[0]], hours: 0 };

    if (initialParts?.length) {
      setParts(initialParts.map(p => ({
        childTaskId: p.childTaskId,
        employeeName: p.employeeName,
        taskTypes: p.taskTypes?.length ? p.taskTypes : [taskTypes[0]],
        hours: p.hours ?? 0
      })));
    } else if (isDraft) {
      const secondEmployee = employees[1] ?? employees[0];
      setParts([
        { ...defaultPart, hours: 0 },
        { employeeName: secondEmployee, taskTypes: [taskTypes[0]], hours: 0 }
      ]);
    } else {
      setParts([defaultPart]);
    }
    setError('');
  }, [open, task, initialParts, mode, employees, taskTypes, totalHours, isDraft]);

  const revalidateHours = (newParts) => {
    const sum = newParts.reduce((acc, p) => acc + (parseFloat(p.hours) || 0), 0);
    if (isEdit) {
      setError(sum > 0 ? '' : 'Укажите часы для назначений');
      return;
    }
    if (isDraft) {
      if (newParts.length < 2) {
        setError('Добавьте минимум двух сотрудников');
      } else if (sum <= 0) {
        setError('Укажите часы для каждого сотрудника');
      } else {
        setError('');
      }
      return;
    }
    if (sum > totalHours) {
      setError(`Сумма часов (${sum.toFixed(1)}) превышает выделенное время (${totalHours})`);
    } else if (Math.abs(sum - totalHours) < 0.01) {
      setError('');
    } else {
      setError(`Осталось распределить ${(totalHours - sum).toFixed(1)} ч`);
    }
  };

  const addPart = () => {
    const next = [...parts, { employeeName: employees[0], taskTypes: [taskTypes[0]], hours: 0 }];
    setParts(next);
    revalidateHours(next);
  };

  const removePart = (index) => {
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
    if (isDraft && parts.length < 2) {
      setError('Добавьте минимум двух сотрудников для общей задачи');
      return false;
    }
    if (!isEdit && !isDraft && parts.length < 2) {
      setError('Добавьте минимум двух сотрудников для общей задачи');
      return false;
    }
    if (!isEdit && !isDraft && Math.abs(sum - totalHours) > 0.01) {
      setError(`Сумма часов должна равняться ${totalHours} ч`);
      return false;
    }
    if (isDraft && sum <= 0) {
      setError('Укажите часы для каждого сотрудника');
      return false;
    }
    if (isEdit && sum <= 0) {
      setError('Укажите часы для назначений');
      return false;
    }
    return true;
  };

  const partsSum = parts.reduce((acc, p) => acc + (parseFloat(p.hours) || 0), 0);
  const displayTotalHours = isEdit || isDraft ? partsSum : totalHours;

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

      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err.message);
    }
  };

  const taskLabel = task?.fileName || task?.folderPath || '';
  const title = isDraft
    ? 'Общая задача — назначения'
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
            ? `Итого: ${displayTotalHours.toFixed(1)} ч — подставится в поле «Часы» задачи`
            : isEdit
              ? `Всего часов по назначениям: ${displayTotalHours.toFixed(1)} ч (обновится у задачи)`
              : `Всего часов: ${displayTotalHours} ч`}
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
