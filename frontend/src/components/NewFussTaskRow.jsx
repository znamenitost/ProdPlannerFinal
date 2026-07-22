import {
  TableRow,
  TableCell,
  TextField,
  Box,
  Chip,
  IconButton
} from '@mui/material';
import { Save, Cancel, AutoAwesome } from '@mui/icons-material';
import { DEADLINE_COLUMN_SX } from './DeadlineDateTimePicker';
import { draftRowSx } from '../theme/surfaces';
import {
  COL_ICON,
  COL_TASK,
  COL_FILE,
  COL_COMMENT,
  COL_EMPLOYEE,
  COL_STATUS,
  COL_ACTIONS,
  TASK_TABLE_TEXT_FIELD_PROPS
} from '../utils/taskTableStyles';
import { columnCellSx, hoursColumnSx, typeColumnSx } from '../utils/taskTableColumns';
import { STATUS_FUSS } from '../constants/taskStatuses';

export default function NewFussTaskRow({
  newRow,
  setNewRow,
  onSave,
  onCancel,
  employeeName,
  showHoursTypeColumns = true,
  columnVisibility
}) {
  return (
    <TableRow sx={draftRowSx}>
      <TableCell sx={COL_ICON}>
        <AutoAwesome color="info" fontSize="small" />
      </TableCell>

      <TableCell sx={columnCellSx('task', columnVisibility, showHoursTypeColumns, COL_TASK)}>
        —
      </TableCell>

      <TableCell sx={columnCellSx('file', columnVisibility, showHoursTypeColumns, COL_FILE)}>
        —
      </TableCell>

      <TableCell sx={columnCellSx('comment', columnVisibility, showHoursTypeColumns, COL_COMMENT)}>
        <TextField
          {...TASK_TABLE_TEXT_FIELD_PROPS}
          placeholder="Комментарий задачи *"
          value={newRow.comment}
          onChange={(e) => setNewRow({ ...newRow, comment: e.target.value })}
          autoFocus
          required
        />
      </TableCell>

      <TableCell sx={columnCellSx('deadline', columnVisibility, showHoursTypeColumns, DEADLINE_COLUMN_SX)}>
        —
      </TableCell>

      <TableCell align="center" sx={hoursColumnSx(columnVisibility, showHoursTypeColumns)}>
        —
      </TableCell>

      <TableCell sx={typeColumnSx(columnVisibility, showHoursTypeColumns)}>
        {STATUS_FUSS}
      </TableCell>

      <TableCell sx={columnCellSx('employee', columnVisibility, showHoursTypeColumns, COL_EMPLOYEE)}>
        {employeeName || '—'}
      </TableCell>

      <TableCell sx={columnCellSx('status', columnVisibility, showHoursTypeColumns, COL_STATUS)}>
        <Chip label={STATUS_FUSS} size="small" color="info" variant="filled" />
      </TableCell>

      <TableCell sx={columnCellSx('actions', columnVisibility, showHoursTypeColumns, COL_ACTIONS)}>
        <Box sx={{ display: 'flex', gap: 1 }}>
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
