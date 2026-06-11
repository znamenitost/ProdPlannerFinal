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
  IconButton,
  Typography,
  Alert,
  Divider,
  Paper,
  Checkbox,
  Switch,
  FormControlLabel,
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

function partTotalHours(part) {
  if (part.throughTest) {
    return (parseFloat(part.testHours) || 0) + (parseFloat(part.productionHours) || 0);
  }
  return parseFloat(part.hours) || 0;
}

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
  const hasThroughTestPart = parts.some((p) => p.throughTest);

  useEffect(() => {
    if (!open) return;

    setExecutionMode(taskExecutionMode || TASK_EXECUTION_PARALLEL);

    const defaultPart = {
      employeeName: employees[0],
      taskTypes: [],
      hours: 0,
      throughTest: false,
      testHours: 0,
      productionHours: 0,
    };

    if (initialParts?.length) {
      setParts(initialParts.map(p => ({
        childTaskId: p.childTaskId,
        employeeName: p.employeeName,
        taskTypes: p.taskTypes?.length ? p.taskTypes : [],
        hours: p.hours ?? 0,
        statusText: p.statusText || '',
        started: p.started ?? false,
        throughTest: p.throughTest ?? false,
        testHours: p.testHours ?? 0,
        productionHours: p.productionHours ?? 0,
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
    const sum = newParts.reduce((acc, p) => acc + partTotalHours(p), 0);
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

  const createBlankPart = () => ({
    employeeName: employees[0],
    taskTypes: [],
    hours: 0,
    throughTest: false,
    testHours: 0,
    productionHours: 0,
  });

  const addPart = () => {
    const next = [...parts, createBlankPart()];
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

  const toggleThroughTest = (index) => {
    const part = parts[index];
    const next = [...parts];
    const enabled = !part.throughTest;
    next[index] = {
      ...part,
      throughTest: enabled,
      testHours: enabled ? (part.testHours || part.hours || 0) : 0,
      productionHours: enabled ? (part.productionHours || 0) : 0,
      hours: enabled ? 0 : (part.testHours + part.productionHours) || part.hours,
    };
    setParts(next);
    revalidateHours(next);
  };

  const updatePart = (index, field, value) => {
    const next = [...parts];
    next[index] = { ...next[index], [field]: value };
    setParts(next);
    revalidateHours(next);
  };

  const validateParts = () => {
    for (const part of parts) {
      if (!part.employeeName || part.taskTypes.length === 0) {
        setError('Заполните сотрудника и тип работы');
        return false;
      }
      if (part.throughTest) {
        const testH = parseFloat(part.testHours);
        const prodH = parseFloat(part.productionHours);
        if (!(testH >= 0.5) || !(prodH >= 0.5)) {
          setError('Укажите часы теста и основной части (от 0.5)');
          return false;
        }
      } else if (!(parseFloat(part.hours) > 0)) {
        setError('Заполните все поля для каждой части');
        return false;
      }
    }
    if (isDraft && isSequential && parts.length < 2) {
      setError('Для последовательной задачи добавьте минимум 2 этапа');
      return false;
    }
    if (isDraft && parts.length < 1) {
      setError('Добавьте сотрудника');
      return false;
    }
    const sum = parts.reduce((acc, p) => acc + partTotalHours(p), 0);
    if (isFreeHoursMode && sum <= 0) {
      setError('Укажите часы для каждого сотрудника');
      return false;
    }
    return true;
  };

  const displayTotalHours = parts.reduce((acc, p) => acc + partTotalHours(p), 0);

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
      scroll="paper"
      sx={{
        '& .MuiDialog-paper': {
          width: 'fit-content',
          maxWidth: 'calc(100vw - 32px)',
          minWidth: { xs: 'min(100%, 320px)', sm: 480 },
          m: 2,
          px: { xs: 0.5, sm: 1 }
        }
      }}
    >
      <DialogTitle sx={{ px: { xs: 2, sm: 3 }, pt: 2.5, pb: 1.5 }}>
        {title}
        {taskLabel && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {taskLabel}
          </Typography>
        )}
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {hasThroughTestPart
            ? `Есть назначения через тест · ${displayTotalHours.toFixed(1)} ч`
            : isDraft
              ? parts.length >= 2
                ? isSequential
                  ? `Последовательная · ${displayTotalHours.toFixed(1)} ч · ${parts.length} этапов`
                  : `Общая задача · ${displayTotalHours.toFixed(1)} ч (сумма по сотрудникам)`
                : `Обычная задача · ${displayTotalHours.toFixed(1)} ч`
              : parts.length === 1
                ? `Обычная задача · ${displayTotalHours.toFixed(1)} ч`
                : isSequential
                  ? `Последовательная · ${displayTotalHours.toFixed(1)} ч · ${parts.length} этапов`
                  : `Общая задача · ${displayTotalHours.toFixed(1)} ч (сумма по сотрудникам)`}
        </Typography>
      </DialogTitle>
      <Divider />

      <DialogContent sx={{ px: { xs: 2, sm: 3 }, py: 2.5, overflowX: 'auto' }}>
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
          </Box>
        )}

        <Stack spacing={2}>
          {parts.map((part, idx) => (
            <Paper key={idx} variant="outlined" sx={{ p: 1.5, display: 'inline-block', maxWidth: '100%' }}>
              {isSequential && parts.length > 1 && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                  Этап {idx + 1}
                </Typography>
              )}
              <Stack
                direction="row"
                spacing={1.25}
                sx={{
                  alignItems: 'center',
                  flexWrap: 'nowrap',
                  width: 'max-content',
                  maxWidth: 'none',
                  pr: 0.5
                }}
              >
                <FormControl size="small" sx={{ width: 132, flexShrink: 0, maxWidth: '100%' }}>
                  <InputLabel>Сотрудник</InputLabel>
                  <Select
                    autoWidth
                    value={part.employeeName}
                    label="Сотрудник"
                    onChange={(e) => updatePart(idx, 'employeeName', e.target.value)}
                  >
                    {employees.map(emp => (
                      <MenuItem key={emp} value={emp}>{emp}</MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControlLabel
                  control={
                    isDraft ? (
                      <Switch
                        size="small"
                        checked={Boolean(part.throughTest)}
                        onChange={() => toggleThroughTest(idx)}
                      />
                    ) : (
                      <Checkbox
                        size="small"
                        checked={Boolean(part.throughTest)}
                        onChange={() => toggleThroughTest(idx)}
                      />
                    )
                  }
                  label="Через тест"
                  sx={{
                    m: 0,
                    flexShrink: 0,
                    alignItems: 'center',
                    '& .MuiSwitch-root': { my: 0 },
                    '& .MuiCheckbox-root': { p: 0.5 }
                  }}
                />

                <FormControl size="small" sx={{ width: 190, flexShrink: 0, maxWidth: '100%' }}>
                  <InputLabel>Тип работы</InputLabel>
                  <Select
                    multiple
                    value={part.taskTypes}
                    label="Тип работы"
                    onChange={(e) => updatePart(idx, 'taskTypes', e.target.value)}
                    input={<OutlinedInput label="Тип работы" />}
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

                {part.throughTest ? (
                  <>
                    <EstimateHoursInput
                      placeholder="Тест"
                      value={part.testHours}
                      onChange={(hours) => updatePart(idx, 'testHours', hours)}
                      sx={{ flexShrink: 0 }}
                    />
                    <EstimateHoursInput
                      placeholder="Основн."
                      value={part.productionHours}
                      onChange={(hours) => updatePart(idx, 'productionHours', hours)}
                      sx={{ flexShrink: 0 }}
                    />
                  </>
                ) : (
                  <EstimateHoursInput
                    value={part.hours}
                    onChange={(hours) => updatePart(idx, 'hours', hours)}
                    sx={{ flexShrink: 0 }}
                  />
                )}

                {parts.length > 1 && (
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => removePart(idx)}
                    sx={{ flexShrink: 0 }}
                  >
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

      <DialogActions sx={{ px: { xs: 2, sm: 3 }, pb: 2 }}>
        <Button onClick={onClose} disabled={submitting}>Отмена</Button>
        <Button onClick={handleSubmit} variant="contained" color="primary" disabled={submitting}>
          {submitLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
