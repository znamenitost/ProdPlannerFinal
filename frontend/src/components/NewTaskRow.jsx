import {
  TableRow,
  TableCell,
  TextField,
  Box,
  Chip,
  IconButton,
  Typography
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
export default function NewTaskRow({
  newRow,
  setNewRow,
  onSave,
  onCancel,
  onOpenAssigneeModal,
  showHoursTypeColumns = true,
  columnVisibility
}) {
  const isShared = newRow.isSharedTask && (newRow.assigneeParts?.length ?? 0) >= 2;
  const isSequential = newRow.taskExecutionMode === TASK_EXECUTION_SEQUENTIAL;
  const hasAssignees = isShared || Boolean(newRow.employeeName);
  const hoursDisplay =
    newRow.estimateHours !== '' && newRow.estimateHours != null && !Number.isNaN(Number(newRow.estimateHours))
      ? `${Number(newRow.estimateHours).toFixed(1)} ч`
      : '—';

  const assigneeLabel = () => {
    if (isShared) {
      return isSequential
        ? `Последов. · ${newRow.assigneeParts.length} эт.`
        : `Общая · ${newRow.assigneeParts.length}`;
    }
    if (newRow.employeeName) return newRow.employeeName;
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
          value={newRow.folderPath || ''}
          onChange={(e) => setNewRow({ ...newRow, folderPath: e.target.value })}
        />
      </TableCell>

      <TableCell sx={columnCellSx('file', columnVisibility, showHoursTypeColumns, COL_FILE)}>
        <TextField
          {...TASK_TABLE_TEXT_FIELD_PROPS}
          placeholder="Имя файла"
          value={newRow.fileName || ''}
          onChange={(e) => setNewRow({ ...newRow, fileName: e.target.value })}
        />
      </TableCell>

      <TableCell sx={columnCellSx('comment', columnVisibility, showHoursTypeColumns, COL_COMMENT)}>
        <TextField
          {...TASK_TABLE_TEXT_FIELD_PROPS}
          placeholder="Комментарий"
          value={newRow.comment}
          onChange={(e) => setNewRow({ ...newRow, comment: e.target.value })}
        />
      </TableCell>

      <TableCell sx={columnCellSx('deadline', columnVisibility, showHoursTypeColumns, DEADLINE_COLUMN_SX)}>
        <DeadlineDateTimePicker
          value={newRow.deadline}
          onChange={(deadline) => setNewRow({ ...newRow, deadline })}
          hideLabel
        />
      </TableCell>

      <TableCell align="center" sx={hoursColumnSx(columnVisibility, showHoursTypeColumns)}>
        <Typography variant="body2" sx={{ fontSize: '0.8rem', color: hasAssignees ? 'text.primary' : 'text.disabled' }}>
          {hoursDisplay}
        </Typography>
      </TableCell>

      <TableCell sx={typeColumnSx(columnVisibility, showHoursTypeColumns)}>
        <Typography variant="body2" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
          {isShared ? '—' : (newRow.types?.length ? newRow.types.join(', ') : '—')}
        </Typography>
      </TableCell>

      <TableCell sx={columnCellSx('employee', columnVisibility, showHoursTypeColumns, COL_EMPLOYEE)}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
          <IconButton size="small" onClick={onOpenAssigneeModal} aria-label="Назначить сотрудников">
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
          <IconButton size="small" color="primary" onClick={onSave} aria-label="Сохранить">
            <Save fontSize="small" />
          </IconButton>
          <IconButton size="small" color="error" onClick={onCancel} aria-label="Отмена">
            <Cancel fontSize="small" />
          </IconButton>
        </Box>
      </TableCell>
    </TableRow>
  );
}
