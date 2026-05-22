import {
  TableRow,
  TableCell,
  TextField,
  Box,
  Chip,
  IconButton,
  Tooltip,
  Typography
} from '@mui/material';
import { Save, Cancel, AutoAwesome, PeopleAlt } from '@mui/icons-material';
import DeadlineDateTimePicker, { DEADLINE_COLUMN_SX } from './DeadlineDateTimePicker';
import { draftRowSx } from '../theme/surfaces';

export default function NewTaskRow({
  newRow,
  setNewRow,
  onSave,
  onCancel,
  onOpenAssigneeModal
}) {
  const isShared = newRow.isSharedTask && (newRow.assigneeParts?.length ?? 0) >= 2;
  const hasAssignees = isShared || Boolean(newRow.employeeName);
  const hoursDisplay =
    newRow.estimateHours !== '' && newRow.estimateHours != null && !Number.isNaN(Number(newRow.estimateHours))
      ? `${Number(newRow.estimateHours).toFixed(1)} ч`
      : '—';

  const assigneeLabel = () => {
    if (isShared) return `Общая · ${newRow.assigneeParts.length}`;
    if (newRow.employeeName) return newRow.employeeName;
    return 'Участники';
  };

  return (
    <TableRow sx={draftRowSx}>
      <TableCell>
        <AutoAwesome color="warning" fontSize="small" />
      </TableCell>

      <TableCell>
        <TextField
          size="small"
          placeholder="Путь к папке"
          value={newRow.folderPath || ''}
          onChange={(e) => setNewRow({ ...newRow, folderPath: e.target.value })}
          fullWidth
        />
      </TableCell>

      <TableCell>
        <TextField
          size="small"
          placeholder="Имя файла"
          value={newRow.fileName || ''}
          onChange={(e) => setNewRow({ ...newRow, fileName: e.target.value })}
          fullWidth
        />
      </TableCell>

      <TableCell>
        <TextField
          size="small"
          placeholder="Комментарий"
          value={newRow.comment}
          onChange={(e) => setNewRow({ ...newRow, comment: e.target.value })}
          fullWidth
        />
      </TableCell>

      <TableCell sx={DEADLINE_COLUMN_SX}>
        <DeadlineDateTimePicker
          value={newRow.deadline}
          onChange={(deadline) => setNewRow({ ...newRow, deadline })}
          hideLabel
        />
      </TableCell>

      <TableCell align="center">
        <Typography variant="body2" sx={{ fontSize: '0.8rem', color: hasAssignees ? 'text.primary' : 'text.disabled' }}>
          {hoursDisplay}
        </Typography>
      </TableCell>

      <TableCell>
        <Typography variant="body2" sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
          {isShared ? '—' : (newRow.types?.length ? newRow.types.join(', ') : '—')}
        </Typography>
      </TableCell>

      <TableCell>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
          <Tooltip
            title={hasAssignees ? (isShared ? 'Изменить назначения' : 'Изменить сотрудника и часы') : 'Назначить сотрудников'}
            arrow
          >
            <IconButton size="small" onClick={onOpenAssigneeModal}>
              <PeopleAlt fontSize="small" color={hasAssignees ? (isShared ? 'secondary' : 'action') : 'disabled'} />
            </IconButton>
          </Tooltip>
          <Typography variant="caption" sx={{ color: hasAssignees ? 'text.primary' : 'text.disabled', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {assigneeLabel()}
          </Typography>
        </Box>
      </TableCell>

      <TableCell>
        <Chip
          label={hasAssignees ? (isShared ? 'Общая' : 'Новая') : 'Черновик'}
          size="small"
          color={isShared ? 'secondary' : hasAssignees ? 'warning' : 'default'}
          variant={isShared ? 'outlined' : 'filled'}
        />
      </TableCell>

      <TableCell>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton size="small" color="primary" onClick={onSave}>
            <Save fontSize="small" />
          </IconButton>
          <IconButton size="small" color="error" onClick={onCancel}>
            <Cancel fontSize="small" />
          </IconButton>
        </Box>
      </TableCell>
    </TableRow>
  );
}
