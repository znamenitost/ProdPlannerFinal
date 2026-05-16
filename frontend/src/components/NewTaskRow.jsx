import {
  TableRow,
  TableCell,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Box,
  Chip,
  IconButton,
  Tooltip
} from '@mui/material';
import { Save, Cancel, AutoAwesome, PeopleAlt } from '@mui/icons-material';
import { WORK_TIME_OPTIONS, combineDateTime } from '../utils/dateTimeHelpers';

const DEFAULT_TIME = '15:00';

export default function NewTaskRow({
  newRow,
  setNewRow,
  taskTypes,
  employees,
  onSave,
  onCancel,
  onOpenSharedModal
}) {
  const currentDate = newRow.deadline ? new Date(newRow.deadline).toISOString().slice(0, 10) : '';
  const currentTime = newRow.deadline ? new Date(newRow.deadline).toISOString().slice(11, 16) : DEFAULT_TIME;
  const isShared = newRow.isSharedTask && (newRow.assigneeParts?.length ?? 0) >= 2;

  const handleDateChange = (e) => {
    setNewRow({ ...newRow, deadline: combineDateTime(e.target.value, DEFAULT_TIME) });
  };

  const handleTimeChange = (e) => {
    setNewRow({ ...newRow, deadline: combineDateTime(currentDate, e.target.value) });
  };

  return (
    <TableRow sx={{ bgcolor: '#fef3c7' }}>
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

      <TableCell>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            size="small"
            type="date"
            value={currentDate}
            onChange={handleDateChange}
            sx={{ width: 130 }}
          />
          <Select
            size="small"
            value={currentTime}
            onChange={handleTimeChange}
            sx={{ width: 85 }}
          >
            {WORK_TIME_OPTIONS.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
          </Select>
        </Box>
      </TableCell>

      <TableCell>
        <TextField
          type="number"
          size="small"
          value={newRow.estimateHours === '' || newRow.estimateHours == null ? '' : newRow.estimateHours}
          onChange={(e) => {
            const v = e.target.value;
            setNewRow({
              ...newRow,
              estimateHours: v === '' ? '' : parseFloat(v) || 0
            });
          }}
          disabled={isShared}
          placeholder={isShared ? '' : 'ч'}
          slotProps={{ htmlInput: { step: 0.5, min: 0 } }}
          sx={{ width: 80 }}
        />
      </TableCell>

      <TableCell>
        <FormControl size="small" fullWidth disabled={isShared}>
          <InputLabel>Типы работ</InputLabel>
          <Select
            multiple
            value={newRow.types || []}
            label="Типы работ"
            onChange={(e) => setNewRow({ ...newRow, types: e.target.value })}
            renderValue={(selected) => selected.join(', ')}
          >
            {taskTypes.map((type) => <MenuItem key={type} value={type}>{type}</MenuItem>)}
          </Select>
        </FormControl>
      </TableCell>

      <TableCell>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <FormControl size="small" sx={{ flex: 1 }} disabled={isShared}>
            <InputLabel id="new-task-employee-label">Сотрудник</InputLabel>
            <Select
              labelId="new-task-employee-label"
              value={newRow.employeeName ?? ''}
              label="Сотрудник"
              displayEmpty
              onChange={(e) => setNewRow({ ...newRow, employeeName: e.target.value })}
            >
              {employees.map((e) => (
                <MenuItem key={e} value={e}>
                  {e}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Tooltip title={isShared ? 'Общая задача — изменить назначения' : 'Сделать общей задачей'} arrow>
            <IconButton size="small" onClick={onOpenSharedModal} sx={{ flexShrink: 0 }}>
              <PeopleAlt fontSize="small" sx={{ color: isShared ? '#8b5cf6' : '#94a3b8' }} />
            </IconButton>
          </Tooltip>
        </Box>
      </TableCell>

      <TableCell>
        <Chip
          label={isShared ? `Общая · ${newRow.assigneeParts.length}` : 'Новая'}
          size="small"
          color={isShared ? 'secondary' : 'warning'}
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
