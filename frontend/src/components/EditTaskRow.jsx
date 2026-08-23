import { useState, useEffect } from 'react';
import { TableRow, TableCell, TextField, IconButton, Box, Typography, CircularProgress } from '@mui/material';
import { Save, Cancel, Edit, PeopleAlt } from '@mui/icons-material';
import DeadlineDateTimePicker, { DEADLINE_COLUMN_SX } from './DeadlineDateTimePicker';
import { draftRowSx } from '../theme/surfaces';
import { COL_ACTIONS_DUAL, TASK_TABLE_TEXT_FIELD_PROPS, withTaskTableTextFieldSx } from '../utils/taskTableStyles';
import { columnCellSx } from '../utils/taskTableColumns';
import { COLLAPSED_COLUMN_SX } from '../utils/taskTableColumns';
export default function EditTaskRow({
  task,
  onUpdate,
  onCancel,
  onOpenAssigneeModal,
  showHoursTypeColumns = true,
  columnVisibility,
  cdrPreviewBuilding = false,
  saving = false
}) {
  const isShared = task.isSplitTask;

  const [localTask, setLocalTask] = useState(() => ({
    id: task.id,
    folderPath: task.folderPath || '',
    fileName: task.fileName || '',
    comment: task.comment || '',
    deadline: task.deadline,
    estimateHours: task.estimateHours || 0,
    type: task.type || '',
    employeeName: task.employeeName || '',
    parentRowNumber: task.parentRowNumber,
    statusText: task.statusText || '',
    updatedAt: task.updatedAt,
    isSplitTask: task.isSplitTask,
    requiresTestBeforeProduction: task.requiresTestBeforeProduction ?? false,
    testEstimateHours: task.testEstimateHours ?? 0,
    productionEstimateHours: task.productionEstimateHours ?? 0
  }));

  // Новая сессия редактирования — полная синхронизация с props.
  useEffect(() => {
    setLocalTask({
      id: task.id,
      folderPath: task.folderPath || '',
      fileName: task.fileName || '',
      comment: task.comment || '',
      deadline: task.deadline,
      estimateHours: task.estimateHours || 0,
      type: task.type || '',
      employeeName: task.employeeName || '',
      parentRowNumber: task.parentRowNumber,
      statusText: task.statusText || '',
      updatedAt: task.updatedAt,
      isSplitTask: task.isSplitTask,
      requiresTestBeforeProduction: task.requiresTestBeforeProduction ?? false,
      testEstimateHours: task.testEstimateHours ?? 0,
      productionEstimateHours: task.productionEstimateHours ?? 0
    });
  }, [task.id]);

  // Hub / refetch обновляет updatedAt для OCC, не затирая черновик полей формы.
  useEffect(() => {
    setLocalTask((prev) => (
      prev.id === task.id && prev.updatedAt !== task.updatedAt
        ? { ...prev, updatedAt: task.updatedAt }
        : prev
    ));
  }, [task.id, task.updatedAt]);

  // Назначения из модалки (employee/hours/type) приходят через props задачи.
  useEffect(() => {
    setLocalTask((prev) => {
      if (prev.id !== task.id) return prev;
      return {
        ...prev,
        estimateHours: task.estimateHours || 0,
        type: task.type || '',
        employeeName: task.employeeName || '',
        isSplitTask: task.isSplitTask,
        requiresTestBeforeProduction: task.requiresTestBeforeProduction ?? false,
        testEstimateHours: task.testEstimateHours ?? 0,
        productionEstimateHours: task.productionEstimateHours ?? 0
      };
    });
  }, [
    task.id,
    task.estimateHours,
    task.type,
    task.employeeName,
    task.isSplitTask,
    task.requiresTestBeforeProduction,
    task.testEstimateHours,
    task.productionEstimateHours
  ]);

  const handleFieldChange = (field, value) => {
    setLocalTask(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    onUpdate(localTask);
  };

  return (
    <TableRow sx={draftRowSx}>
      <TableCell sx={{ width: '3%' }}>
        <Edit color="warning" fontSize="small" />
      </TableCell>

      <TableCell sx={columnCellSx('task', columnVisibility, showHoursTypeColumns, { width: '15%' })}>
        <TextField
          {...TASK_TABLE_TEXT_FIELD_PROPS}
          value={localTask.folderPath}
          onChange={(e) => handleFieldChange('folderPath', e.target.value)}
          placeholder="Путь к папке"
          disabled={saving}
        />
      </TableCell>

      <TableCell sx={columnCellSx('file', columnVisibility, showHoursTypeColumns, { width: '10%' })}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          {cdrPreviewBuilding ? (
            <CircularProgress
              size={12}
              thickness={6}
              aria-label="Построение превью"
              sx={{ flexShrink: 0 }}
            />
          ) : null}
          <TextField
            {...TASK_TABLE_TEXT_FIELD_PROPS}
            value={localTask.fileName}
            onChange={(e) => handleFieldChange('fileName', e.target.value)}
            placeholder="Имя файла"
            disabled={saving}
            sx={withTaskTableTextFieldSx({ flex: 1, minWidth: 0 })}
          />
        </Box>
      </TableCell>

      <TableCell sx={columnCellSx('comment', columnVisibility, showHoursTypeColumns, { width: '12%' })}>
        <TextField
          {...TASK_TABLE_TEXT_FIELD_PROPS}
          value={localTask.comment}
          onChange={(e) => handleFieldChange('comment', e.target.value)}
          disabled={saving}
        />
      </TableCell>

      <TableCell sx={columnCellSx('deadline', columnVisibility, showHoursTypeColumns, DEADLINE_COLUMN_SX)}>
        <DeadlineDateTimePicker
          value={localTask.deadline}
          onChange={(deadline) => handleFieldChange('deadline', deadline)}
          hideLabel
          disabled={saving}
        />
      </TableCell>

      <TableCell sx={COLLAPSED_COLUMN_SX} />
      <TableCell sx={COLLAPSED_COLUMN_SX} />

      <TableCell sx={columnCellSx('employee', columnVisibility, showHoursTypeColumns, { width: '8%' })}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
          <IconButton
            size="small"
            onClick={() => onOpenAssigneeModal(localTask)}
            disabled={saving}
            aria-label="Назначить сотрудников"
            sx={{ flexShrink: 0 }}
          >
            <PeopleAlt fontSize="small" color={isShared ? 'secondary' : 'action'} />
          </IconButton>
          <Typography variant="caption" sx={{ maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {isShared ? 'Общая' : (localTask.employeeName || '—')}
          </Typography>
        </Box>
      </TableCell>

      <TableCell sx={COLLAPSED_COLUMN_SX} />

      <TableCell sx={columnCellSx('actions', columnVisibility, showHoursTypeColumns, COL_ACTIONS_DUAL)}>
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', justifyContent: 'center' }}>
          <IconButton
            size="small"
            color="primary"
            onClick={handleSave}
            disabled={saving}
            aria-label={saving ? 'Сохраняем изменения' : 'Сохранить'}
            aria-busy={saving}
          >
            {saving ? <CircularProgress size={16} color="inherit" /> : <Save fontSize="small" />}
          </IconButton>
          <IconButton size="small" color="error" onClick={onCancel} disabled={saving} aria-label="Отмена">
            <Cancel fontSize="small" />
          </IconButton>
        </Box>
      </TableCell>
    </TableRow>
  );
}
