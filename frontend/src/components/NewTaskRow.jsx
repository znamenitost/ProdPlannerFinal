import { useState, useEffect, useCallback } from 'react';
import {
  TableRow,
  TableCell,
  TextField,
  Box,
  Chip,
  IconButton,
  Typography,
  CircularProgress
} from '@mui/material';
import { Save, Cancel, AutoAwesome, PeopleAlt } from '@mui/icons-material';
import DeadlineDateTimePicker, { DEADLINE_COLUMN_SX } from './DeadlineDateTimePicker';
import { draftRowSx } from '../theme/surfaces';
import { TASK_EXECUTION_SEQUENTIAL } from '../constants/taskStatuses';
import {
  COL_ICON,
  COL_TASK,
  COL_FILE,
  COL_COMMENT,
  COL_EMPLOYEE,
  COL_STATUS,
  COL_ACTIONS_DUAL,
  TASK_TABLE_TEXT_FIELD_PROPS
} from '../utils/taskTableStyles';
import { columnCellSx, hoursColumnSx, typeColumnSx } from '../utils/taskTableColumns';

/**
 * Локальный draft для текстовых полей: keystroke не поднимает state в TaskTable
 * (иначе memo строк бесполезен и таблица перерисовывается на каждый символ).
 * Назначения из модалки приходят через newRow и мержатся в draft.
 */
export default function NewTaskRow({
  newRow,
  onSave,
  onCancel,
  onOpenAssigneeModal,
  showHoursTypeColumns = true,
  columnVisibility,
  saving = false
}) {
  const [draft, setDraft] = useState(newRow);

  useEffect(() => {
    setDraft((prev) => ({
      ...prev,
      assigneeParts: newRow.assigneeParts,
      isSharedTask: newRow.isSharedTask,
      estimateHours: newRow.estimateHours,
      employeeName: newRow.employeeName,
      types: newRow.types,
      taskExecutionMode: newRow.taskExecutionMode,
      requiresTestBeforeProduction: newRow.requiresTestBeforeProduction,
      testEstimateHours: newRow.testEstimateHours,
      productionEstimateHours: newRow.productionEstimateHours
    }));
  }, [
    newRow.assigneeParts,
    newRow.isSharedTask,
    newRow.estimateHours,
    newRow.employeeName,
    newRow.types,
    newRow.taskExecutionMode,
    newRow.requiresTestBeforeProduction,
    newRow.testEstimateHours,
    newRow.productionEstimateHours
  ]);

  const handleFieldChange = useCallback((field, value) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  }, []);

  const isShared = draft.isSharedTask && (draft.assigneeParts?.length ?? 0) >= 2;
  const isSequential = draft.taskExecutionMode === TASK_EXECUTION_SEQUENTIAL;
  const hasAssignees = isShared || Boolean(draft.employeeName);
  const hoursDisplay =
    draft.estimateHours !== '' && draft.estimateHours != null && !Number.isNaN(Number(draft.estimateHours))
      ? `${Number(draft.estimateHours).toFixed(1)} ч`
      : '—';

  const assigneeLabel = () => {
    if (isShared) {
      return isSequential
        ? `Последов. · ${draft.assigneeParts.length} эт.`
        : `Общая · ${draft.assigneeParts.length}`;
    }
    if (draft.employeeName) return draft.employeeName;
    return 'Участники';
  };

  return (
    <TableRow sx={draftRowSx}>
      <TableCell sx={COL_ICON}>
        <AutoAwesome color="warning" fontSize="small" />
      </TableCell>

      <TableCell sx={columnCellSx('task', columnVisibility, showHoursTypeColumns, COL_TASK)}>
        <TextField
          {...TASK_TABLE_TEXT_FIELD_PROPS}
          placeholder="Путь к папке"
          value={draft.folderPath || ''}
          onChange={(e) => handleFieldChange('folderPath', e.target.value)}
          disabled={saving}
        />
      </TableCell>

      <TableCell sx={columnCellSx('file', columnVisibility, showHoursTypeColumns, COL_FILE)}>
        <TextField
          {...TASK_TABLE_TEXT_FIELD_PROPS}
          placeholder="Имя файла"
          value={draft.fileName || ''}
          onChange={(e) => handleFieldChange('fileName', e.target.value)}
          disabled={saving}
        />
      </TableCell>

      <TableCell sx={columnCellSx('comment', columnVisibility, showHoursTypeColumns, COL_COMMENT)}>
        <TextField
          {...TASK_TABLE_TEXT_FIELD_PROPS}
          placeholder="Комментарий"
          value={draft.comment}
          onChange={(e) => handleFieldChange('comment', e.target.value)}
          disabled={saving}
        />
      </TableCell>

      <TableCell sx={columnCellSx('deadline', columnVisibility, showHoursTypeColumns, DEADLINE_COLUMN_SX)}>
        <DeadlineDateTimePicker
          value={draft.deadline}
          onChange={(deadline) => handleFieldChange('deadline', deadline)}
          hideLabel
          disabled={saving}
        />
      </TableCell>

      <TableCell align="center" sx={hoursColumnSx(columnVisibility, showHoursTypeColumns)}>
        <Typography variant="body2" sx={{ fontSize: '0.8rem', color: hasAssignees ? 'text.primary' : 'text.disabled' }}>
          {hoursDisplay}
        </Typography>
      </TableCell>

      <TableCell sx={typeColumnSx(columnVisibility, showHoursTypeColumns)}>
        <Typography variant="body2" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
          {isShared ? '—' : (draft.types?.length ? draft.types.join(', ') : '—')}
        </Typography>
      </TableCell>

      <TableCell sx={columnCellSx('employee', columnVisibility, showHoursTypeColumns, COL_EMPLOYEE)}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
          <IconButton
            size="small"
            onClick={() => onOpenAssigneeModal(draft)}
            disabled={saving}
            aria-label="Назначить сотрудников"
          >
            <PeopleAlt fontSize="small" color={hasAssignees ? (isShared ? 'secondary' : 'action') : 'disabled'} />
          </IconButton>
          <Typography variant="caption" sx={{ color: hasAssignees ? 'text.primary' : 'text.disabled', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {assigneeLabel()}
          </Typography>
        </Box>
      </TableCell>

      <TableCell sx={columnCellSx('status', columnVisibility, showHoursTypeColumns, COL_STATUS)}>
        <Chip
          label={
            hasAssignees
              ? isShared
                ? isSequential
                  ? 'Последов.'
                  : 'Общая'
                : 'Новая'
              : 'Черновик'
          }
          size="small"
          color={isShared ? (isSequential ? 'info' : 'secondary') : hasAssignees ? 'warning' : 'default'}
          variant={isShared ? 'outlined' : 'filled'}
        />
      </TableCell>

      <TableCell sx={columnCellSx('actions', columnVisibility, showHoursTypeColumns, COL_ACTIONS_DUAL)}>
        <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', justifyContent: 'center' }}>
          <IconButton
            size="small"
            color="primary"
            onClick={() => onSave(draft)}
            disabled={saving}
            aria-label={saving ? 'Сохраняем задачу' : 'Сохранить'}
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
