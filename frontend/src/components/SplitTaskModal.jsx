import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
import { Add, Delete, FiberNew } from '@mui/icons-material';
import EstimateHoursInput from './EstimateHoursInput';
import { partsToApi } from '../utils/splitTaskUtils';
import {
  SUPPLY_MODE_COOPERATIVE,
  SUPPLY_MODE_INTERNAL,
  TASK_EXECUTION_PARALLEL,
  TASK_EXECUTION_SEQUENTIAL
} from '../constants/taskStatuses';
import useAuth from '../hooks/useAuth';
import useAutoAssignSettings from '../hooks/useAutoAssignSettings';
import { getAssignmentLoad } from '../services/api';
import { applyAutoAssignToParts, didExpandPartsByTypeSplit, isPartAutoAssignable, partTotalHours } from '../utils/autoAssignSplitParts';
import {
  getUncoveredTaskTypes,
  normalizeAutoAssignTypeRules
} from '../utils/autoAssignTypeRules';
import { AUTO_ASSIGN_EMPLOYEES } from '../hooks/taskTable/taskTableConstants';
import AutoAssignSettingsPopover from './AutoAssignSettingsPopover';

function isEmployeeLockedForPart(part, { autoAssignEnabled, canAutoAssign, isEdit }) {
  return autoAssignEnabled
    && canAutoAssign
    && isPartAutoAssignable(part, isEdit)
    && !part.employeeName;
}

function isTaskTypesLockedForPart(part, { autoAssignEnabled, canAutoAssign, isEdit }) {
  return autoAssignEnabled
    && canAutoAssign
    && isPartAutoAssignable(part, isEdit)
    && Boolean(part.employeeName);
}

function getAutoAssignConstraintWarning(parts, employees, typeRules, isEdit) {
  for (const part of parts) {
    if (!isPartAutoAssignable(part, isEdit)) continue;
    if (!part.taskTypes?.length) continue;
    const uncovered = getUncoveredTaskTypes(employees, part.taskTypes, typeRules);
    if (uncovered.length > 0) {
      return `Нет сотрудника для типов: ${uncovered.join(', ')}`;
    }
  }
  return '';
}

function buildInitialParts({ initialParts, isDraft, employees, clearAutoAssignEmployees }) {
  const defaultPart = {
    employeeName: clearAutoAssignEmployees ? '' : employees[0],
    taskTypes: [],
    hours: 0,
    throughTest: false,
    testHours: 0,
    productionHours: 0,
  };

  if (initialParts?.length) {
    return initialParts.map((p) => ({
      childTaskId: p.childTaskId,
      employeeName: p.employeeName ?? '',
      taskTypes: p.taskTypes?.length ? p.taskTypes : [],
      hours: p.hours ?? 0,
      statusText: p.statusText || '',
      started: p.started ?? false,
      throughTest: p.throughTest ?? false,
      testHours: p.testHours ?? 0,
      productionHours: p.productionHours ?? 0,
    }));
  }

  if (isDraft) {
    return [{ ...defaultPart, hours: 0 }];
  }

  return [defaultPart];
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
  const { user } = useAuth();
  const {
    autoAssignEnabled,
    setAutoAssignEnabled,
    typeRules,
    setTypeRules
  } = useAutoAssignSettings(user, AUTO_ASSIGN_EMPLOYEES, taskTypes);
  const [parts, setParts] = useState([]);
  const [executionMode, setExecutionMode] = useState(TASK_EXECUTION_PARALLEL);
  const [error, setError] = useState('');
  const [removeWarning, setRemoveWarning] = useState('');
  const [autoAssignWarning, setAutoAssignWarning] = useState('');
  const [loadSummary, setLoadSummary] = useState(null);
  const [openTaskTypesIndex, setOpenTaskTypesIndex] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const autoAssignPendingRef = useRef(false);
  const partsRef = useRef([]);

  partsRef.current = parts;

  const isDraft = mode === 'draft';
  const isEdit = mode === 'edit';
  const isFreeHoursMode = isDraft || isEdit || mode === 'split';
  const isSequential = executionMode === TASK_EXECUTION_SEQUENTIAL;
  const showExecutionModePicker = isDraft || (isEdit && parts.length >= 2);
  const hasThroughTestPart = parts.some((p) => p.throughTest);
  const canAutoAssign = AUTO_ASSIGN_EMPLOYEES.length >= 2;

  const runAutoAssign = useCallback(async (currentParts, rules = typeRules) => {
    const { taskCounts } = await getAssignmentLoad(AUTO_ASSIGN_EMPLOYEES);
    setLoadSummary(taskCounts);
    const assigned = applyAutoAssignToParts(currentParts, {
      employees: AUTO_ASSIGN_EMPLOYEES,
      baseTaskCounts: taskCounts,
      isEdit,
      typeRules: rules,
      splitMixedTaskTypes: true
    });
    if (didExpandPartsByTypeSplit(currentParts, assigned)) {
      setExecutionMode(TASK_EXECUTION_PARALLEL);
    }
    setAutoAssignWarning(getAutoAssignConstraintWarning(
      assigned,
      AUTO_ASSIGN_EMPLOYEES,
      rules,
      isEdit
    ));
    return assigned;
  }, [isEdit, typeRules]);

  const applyAutoAssign = useCallback(async (currentParts, rules = typeRules) => {
    if (!autoAssignEnabled || !canAutoAssign) return currentParts;
    return runAutoAssign(currentParts, rules);
  }, [autoAssignEnabled, canAutoAssign, runAutoAssign, typeRules]);

  const refreshLoadSummary = useCallback(async () => {
    try {
      const { taskCounts } = await getAssignmentLoad(AUTO_ASSIGN_EMPLOYEES);
      setLoadSummary(taskCounts);
    } catch {
      setLoadSummary(null);
    }
  }, []);

  const clearAutoAssignEmployees = useCallback((items) => (
    items.map((part) => (
      isPartAutoAssignable(part, isEdit)
        ? { ...part, employeeName: '' }
        : part
    ))
  ), [isEdit]);

  const revalidateHours = useCallback((newParts) => {
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
  }, [isFreeHoursMode]);

  const commitAutoAssign = useCallback(async (currentParts, rules = typeRules) => {
    try {
      const assigned = await applyAutoAssign(currentParts, rules);
      partsRef.current = assigned;
      setParts(assigned);
      revalidateHours(assigned);
      return assigned;
    } catch {
      setAutoAssignWarning('Не удалось обновить авто-выбор');
      return currentParts;
    }
  }, [applyAutoAssign, revalidateHours, typeRules]);

  useEffect(() => {
    if (!open) return;

    setExecutionMode(taskExecutionMode || TASK_EXECUTION_PARALLEL);

    const shouldClearEmployees = autoAssignEnabled && canAutoAssign && !initialParts?.length;
    const nextParts = buildInitialParts({
      initialParts,
      isDraft,
      employees,
      clearAutoAssignEmployees: shouldClearEmployees
    });
    partsRef.current = nextParts;
    setParts(nextParts);
    setError('');
    setRemoveWarning('');
    setAutoAssignWarning('');
    setLoadSummary(null);
    setOpenTaskTypesIndex(null);
    setSubmitting(false);
    submittingRef.current = false;

    if (autoAssignEnabled && canAutoAssign) {
      void refreshLoadSummary();
    }

    return undefined;
  }, [open, task, initialParts, mode, employees, taskTypes, isDraft, taskExecutionMode, autoAssignEnabled, canAutoAssign, isEdit, refreshLoadSummary]);

  const partLockContext = { autoAssignEnabled, canAutoAssign, isEdit };

  const employeeSelectOptions = useMemo(() => {
    const names = new Set(employees);
    for (const part of parts) {
      if (part.employeeName) names.add(part.employeeName);
    }
    return [...names];
  }, [employees, parts]);

  const createBlankPart = () => ({
    employeeName: autoAssignEnabled && canAutoAssign ? '' : employees[0],
    taskTypes: [],
    hours: 0,
    throughTest: false,
    testHours: 0,
    productionHours: 0,
  });

  const addPart = () => {
    const next = [...parts, createBlankPart()];
    partsRef.current = next;
    setParts(next);
    revalidateHours(next);
  };

  const handleAutoAssignChange = async (event) => {
    const checked = event.target.checked;
    setAutoAssignEnabled(checked);
    if (!checked) {
      setAutoAssignWarning('');
      return;
    }
    if (!canAutoAssign) return;

    const cleared = clearAutoAssignEmployees(partsRef.current);
    partsRef.current = cleared;
    setParts(cleared);
    setAutoAssignWarning('');
    void refreshLoadSummary();
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
    partsRef.current = next;
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
    partsRef.current = next;
    setParts(next);
    revalidateHours(next);
  };

  const updatePartTaskTypes = (index, value) => {
    const next = [...parts];
    next[index] = { ...next[index], taskTypes: value };
    partsRef.current = next;
    setParts(next);
    revalidateHours(next);
  };

  const handleTaskTypesMenuClose = useCallback((index) => {
    setOpenTaskTypesIndex(null);

    if (!autoAssignEnabled || !canAutoAssign || autoAssignPendingRef.current) return;

    const part = partsRef.current[index];
    if (!isEmployeeLockedForPart(part, { autoAssignEnabled, canAutoAssign, isEdit })) return;
    if (!part?.taskTypes?.length) return;

    autoAssignPendingRef.current = true;
    void commitAutoAssign(partsRef.current).finally(() => {
      autoAssignPendingRef.current = false;
    });
  }, [autoAssignEnabled, canAutoAssign, isEdit, commitAutoAssign]);

  const handleTypeRulesChange = (nextRules) => {
    setTypeRules(normalizeAutoAssignTypeRules(nextRules, AUTO_ASSIGN_EMPLOYEES, taskTypes));
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
        {autoAssignWarning && (
          <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setAutoAssignWarning('')}>
            {autoAssignWarning}
          </Alert>
        )}
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {canAutoAssign && (
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 0.75 }}>
              <FiberNew
                sx={{ fontSize: 30, flexShrink: 0, color: 'warning.main' }}
                aria-hidden
              />
              <FormControlLabel
                sx={{
                  m: 0,
                  alignItems: 'center',
                  '& .MuiCheckbox-root': { py: 0.5 }
                }}
                control={
                  <Checkbox
                    checked={autoAssignEnabled}
                    onChange={handleAutoAssignChange}
                  />
                }
                label="Авто-режим"
              />
              <AutoAssignSettingsPopover
                rules={typeRules}
                onRulesChange={handleTypeRulesChange}
                employees={AUTO_ASSIGN_EMPLOYEES}
                taskTypes={taskTypes}
              />
            </Box>
            {autoAssignEnabled && loadSummary && (
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                Активные задачи: {AUTO_ASSIGN_EMPLOYEES.map((emp) => `${emp}: ${loadSummary[emp] ?? 0}`).join(' · ')}
              </Typography>
            )}
          </Box>
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
          {parts.map((part, idx) => {
            const employeeLocked = isEmployeeLockedForPart(part, partLockContext);
            const taskTypesLocked = isTaskTypesLockedForPart(part, partLockContext);

            return (
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
                <FormControl
                  size="small"
                  sx={{ width: 132, flexShrink: 0, maxWidth: '100%' }}
                  disabled={employeeLocked}
                >
                  <InputLabel
                    id={`split-employee-label-${idx}`}
                    shrink={Boolean(part.employeeName)}
                  >
                    Сотрудник
                  </InputLabel>
                  <Select
                    labelId={`split-employee-label-${idx}`}
                    autoWidth
                    value={part.employeeName || ''}
                    label="Сотрудник"
                    disabled={employeeLocked}
                    renderValue={(selected) => selected || part.employeeName || ''}
                    onChange={(e) => updatePart(idx, 'employeeName', e.target.value)}
                  >
                    {employeeSelectOptions.map((emp) => (
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

                <FormControl
                  size="small"
                  sx={{ width: 190, flexShrink: 0, maxWidth: '100%' }}
                  disabled={taskTypesLocked}
                >
                  <InputLabel>Тип работы</InputLabel>
                  <Select
                    multiple
                    value={part.taskTypes}
                    label="Тип работы"
                    disabled={taskTypesLocked}
                    open={
                      employeeLocked
                        ? openTaskTypesIndex === idx
                        : undefined
                    }
                    onOpen={() => setOpenTaskTypesIndex(idx)}
                    onClose={() => handleTaskTypesMenuClose(idx)}
                    onChange={(e) => updatePartTaskTypes(idx, e.target.value)}
                    input={<OutlinedInput label="Тип работы" />}
                    renderValue={(selected) => selected.join(', ')}
                  >
                    {taskTypes.map((type) => (
                      <MenuItem key={type} value={type}>
                        <Checkbox checked={part.taskTypes.includes(type)} />
                        <ListItemText primary={type} />
                      </MenuItem>
                    ))}
                    {employeeLocked && (
                      <>
                        <Divider sx={{ my: 0.5 }} />
                        <Box
                          sx={{ px: 1.5, py: 1, display: 'flex', justifyContent: 'flex-end' }}
                          onMouseDown={(event) => event.stopPropagation()}
                          onClick={(event) => event.stopPropagation()}
                        >
                          <Button
                            size="small"
                            variant="contained"
                            disabled={!part.taskTypes?.length}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => handleTaskTypesMenuClose(idx)}
                          >
                            Назначить
                          </Button>
                        </Box>
                      </>
                    )}
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
            );
          })}

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
