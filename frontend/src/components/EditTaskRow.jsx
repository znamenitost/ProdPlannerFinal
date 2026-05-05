import { TableRow, TableCell, TextField, Select, MenuItem, IconButton, Tooltip, Box } from '@mui/material';
import { Save, Cancel } from '@mui/icons-material';

const WORK_TIME_OPTIONS = [];
for (let h = 10; h <= 19; h++) {
  for (let m of [0, 30]) {
    if (h === 19 && m === 30) continue;
    const hour = h.toString().padStart(2, '0');
    const minute = m.toString().padStart(2, '0');
    WORK_TIME_OPTIONS.push(`${hour}:${minute}`);
  }
}
const DEFAULT_TIME = '15:00';

const parseDateTime = (dateTimeStr) => {
  if (!dateTimeStr) return { date: '', time: DEFAULT_TIME };
  const date = new Date(dateTimeStr);
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return { date: `${year}-${month}-${day}`, time: `${hours}:${minutes}` };
};

const combineDateTime = (date, time) => {
  if (!date) return '';
  return `${date}T${time}`;
};

export default function EditTaskRow({ task, onUpdate, onCancel, onFieldChange, taskTypes, employees }) {
  const { date, time } = parseDateTime(task.deadline);

  return (
    <TableRow sx={{ bgcolor: '#fef3c7' }}>
      <TableCell sx={{ width: 60 }}>✏️</TableCell>

      {/* Задача (путь к папке) */}
      <TableCell>
        <TextField
          size="small"
          value={task.folderPath || ''}
          onChange={(e) => onFieldChange(task, 'folderPath', e.target.value)}
          fullWidth
          placeholder="Путь к папке"
        />
      </TableCell>

      {/* Файл (имя файла) */}
      <TableCell>
        <TextField
          size="small"
          value={task.fileName || ''}
          onChange={(e) => onFieldChange(task, 'fileName', e.target.value)}
          fullWidth
          placeholder="Имя файла"
        />
      </TableCell>

      <TableCell>
        <TextField
          size="small"
          value={task.comment || ''}
          onChange={(e) => onFieldChange(task, 'comment', e.target.value)}
          fullWidth
        />
      </TableCell>

      <TableCell sx={{ width: 230 }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            size="small"
            type="date"
            value={date}
            onChange={(e) => onFieldChange(task, 'deadline', combineDateTime(e.target.value, time))}
            sx={{ width: 130 }}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <Select
            size="small"
            value={time}
            onChange={(e) => onFieldChange(task, 'deadline', combineDateTime(date, e.target.value))}
            sx={{ width: 85 }}
          >
            {WORK_TIME_OPTIONS.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
          </Select>
        </Box>
      </TableCell>

      <TableCell sx={{ width: 80 }}>
        <TextField
          size="small"
          type="number"
          value={task.estimateHours || 0}
          onChange={(e) => onFieldChange(task, 'estimateHours', parseFloat(e.target.value) || 0)}
          slotProps={{ htmlInput: { step: 0.5, min: 0 } }}
          sx={{ width: 80 }}
        />
      </TableCell>

      <TableCell sx={{ width: 160 }}>
        <Select
          size="small"
          multiple
          value={task.type ? task.type.split(', ') : []}
          onChange={(e) => onFieldChange(task, 'type', e.target.value.join(', '))}
          renderValue={(selected) => selected.join(', ')}
          fullWidth
        >
          {taskTypes.map((type) => <MenuItem key={type} value={type}>{type}</MenuItem>)}
        </Select>
      </TableCell>

      <TableCell sx={{ width: 120 }}>
        <Select
          size="small"
          value={task.employeeName || ''}
          onChange={(e) => onFieldChange(task, 'employeeName', e.target.value)}
          fullWidth
        >
          {employees.map(emp => <MenuItem key={emp} value={emp}>{emp}</MenuItem>)}
        </Select>
      </TableCell>

      <TableCell sx={{ width: 120 }}>
        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{task.statusText || 'Назначена'}</span>
      </TableCell>

      <TableCell>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="Сохранить">
            <IconButton size="small" color="primary" onClick={() => onUpdate(task)}>
              <Save fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Отмена">
            <IconButton size="small" color="error" onClick={onCancel}>
              <Cancel fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </TableCell>
    </TableRow>
  );
}