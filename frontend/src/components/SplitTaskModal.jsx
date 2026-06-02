import { useState, useEffect, useRef } from 'react';
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
  Divider,
  Paper,
  Checkbox,
  ListItemText,
  OutlinedInput,
  Box,
  ToggleButtonGroup,
  ToggleButton
} from '@mui/material';
import { Add, Delete } from '@mui/icons-material';
import EstimateHoursInput from './EstimateHoursInput';
import { partsToApi } from '../utils/splitTaskUtils';
import {
  SUPPLY_MODE_COOPERATIVE,
  SUPPLY_MODE_INTERNAL,
  TASK_EXECUTION_PARALLEL,
  TASK_EXECUTION_SEQUENTIAL
} from '../constants/taskStatuses';

export default function SplitTaskModal({
  open,
  mode = 'split',
  task,
  initialParts,
  employees,
  taskTypes,
  taskExecutionMode = 'parallel',
  onClose,
  onSuccess,
  onDraftApply
}) {
  const [parts, setParts] = useState([]);
  const [executionMode, setExecutionMode] = useState(TASK_EXECUTION_PARALLEL);
  const [error, setError] = useState('');
  const [removeWarning, setRemoveWarning] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);

  const isDraft = mode === 'draft';
  const isEdit = mode === 'edit';
  const isFreeHoursMode = isDraft || isEdit || mode === 'split';
  const isSequential = executionMode === TASK_EXECUTION_SEQUENTIAL;
  const showExecutionModePicker = isDraft || (isEdit && parts.length >= 2);

  useEffect(() => {
    if (!open) return;

    setExecutionMode(taskExecutionMode || TASK_EXECUTION_PARALLEL);

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
    setSubmitting(false);
    submittingRef.current = false;
  }, [open, task, initialParts, mode, employees, taskTypes, isDraft, taskExecutionMode]);

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
    if (isDraft && isSequential && parts.length < 2) {
      setError('Для последовательной задачи добавьте минимум 2 этапа');
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
    if (submittingRef.current) return;
    if (!validateParts()) return;

    submittingRef.current = true;
    setSubmitting(true);

    const supplyMode = executionMode === TASK_EXECUTION_SEQUENTIAL
      ? SUPPLY_MODE_INTERNAL
      : SUPPLY_MODE_COOPERATIVE;

    if (isDraft) {
      onDraftApply?.(partsToApi(parts), parts, executionMode);
      onClose();
      submittingRef.current = false;
      setSubmitting(false);
      return;
    }

    try {
      const body = { parentTaskId: task.id, parts: partsToApi(parts), supplyMode };
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
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const taskLabel = task?.folderPath?.trim() || 'Новая задача';
  const title = isDraft
    ? 'Назначения'
    : isEdit
      ? 'Редактирование назначений'
      : 'Разделение задачи';
  const submitLabel = isDraft ? 'Применить' : isEdit ? 'Сохранить' : 'Разделить';

  return (
    <Dialog
      open={open}
      onClose={submitting ? undefined : onClose}
      maxWidth={false}
      sx={{
        '& .MuiDialog-paper': {
          width: { xs: 'calc(100vw - 32px)', sm: '560px !important' },
          maxWidth: { xs: 'calc(100vw - 32px)', sm: '560px !important' },
          margin: 2
        }
      }}
    >
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
              ? isSequential
                ? `Последовательная · ${displayTotalHours.toFixed(1)} ч · ${parts.length} этапов`
                : `Общая задача · ${displayTotalHours.toFixed(1)} ч (сумма по сотрудникам)`
              : `Обычная задача · ${displayTotalHours.toFixed(1)} ч`
            : parts.length === 1
              ? `Обычная задача · ${displayTotalHours.toFixed(1)} ч (попадёт в столбец «Часы»)`
              : isSequential
                ? `Последовательная · ${displayTotalHours.toFixed(1)} ч · ${parts.length} этапов`
                : `Общая задача · ${displayTotalHours.toFixed(1)} ч (сумма по сотрудникам)`}
        </Typography>
      </DialogTitle>
      <Divider />

      <DialogContent sx={{ px: 2.5 }}>
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

        {showExecutionModePicker && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Тип задачи
            </Typography>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={executionMode}
              onChange={(_e, value) => {
                if (value) setExecutionMode(value);
              }}
            >
              <ToggleButton value={TASK_EXECUTION_PARALLEL}>
                Параллельная
              </ToggleButton>
              <ToggleButton value={TASK_EXECUTION_SEQUENTIAL}>
                Последовательная
              </ToggleButton>
            </ToggleButtonGroup>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              {isSequential
                ? 'Этапы выполняются по очереди: следующий начинается после «Готово» предыдущего.'
                : 'Все этапы доступны сразу — как общая задача.'}
            </Typography>
          </Box>
        )}

        <Stack spacing={2}>
          {parts.map((part, idx) => (
            <Paper key={idx} variant="outlined" sx={{ p: 1.5 }}>
              {isSequential && parts.length > 1 && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  Этап {idx + 1}
                </Typography>
              )}
              <Stack
                direction="row"
                spacing={1}
                sx={{
                  alignItems: 'flex-start',
                  flexWrap: { xs: 'wrap', sm: 'nowrap' }
                }}
              >
                <FormControl size="small" sx={{ width: 132, flexShrink: 0, maxWidth: '100%' }}>
                  <InputLabel>Сотрудник</InputLabel>
                  <Select
                    autoWidth
                    value={part.employeeName}
                    label="Сотрудник"
                    onChange={(e) => updatePart(idx, 'employeeName', e.target.value)}
                    MenuProps={{
                      PaperProps: {
                        sx: {
                          minWidth: 132,
                          maxWidth: 240
                        }
                      }
                    }}
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

                <FormControl size="small" sx={{ width: 190, flexShrink: 0, maxWidth: '100%' }}>
                  <InputLabel>Типы работ</InputLabel>
                  <Select
                    multiple
                    value={part.taskTypes}
                    label="Типы работ"
                    onChange={(e) => updatePart(idx, 'taskTypes', e.target.value)}
                    input={<OutlinedInput label="Типы работ" />}
                    renderValue={(selected) => selected.join(', ')}
                    sx={{
                      '& .MuiSelect-select': {
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }
                    }}
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
                  sx={{ width: 104, flexShrink: 0 }}
                />

                {parts.length > 1 && (
                  <IconButton size="small" color="error" onClick={() => removePart(idx)} sx={{ mt: 0.5, flexShrink: 0 }}>
                    <Delete />
                  </IconButton>
                )}
              </Stack>
            </Paper>
          ))}

          <Button startIcon={<Add />} onClick={addPart} variant="outlined" size="small">
            {isSequential ? 'Добавить этап' : 'Добавить сотрудника'}
          </Button>
        </Stack>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={submitting}>Отмена</Button>
        <Button onClick={handleSubmit} variant="contained" color="primary" disabled={submitting}>
          {submitLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
