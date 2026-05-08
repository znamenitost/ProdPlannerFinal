// ./frontend/src/components/NewTaskRow.jsx
import { TableRow, TableCell, TextField, Select, MenuItem, FormControl, InputLabel, Box, Chip, IconButton, Tooltip, Button } from '@mui/material';
import { Save, Cancel } from '@mui/icons-material';
import { WORK_TIME_OPTIONS, DEFAULT_TIME, parseDateTime, combineDateTime } from '../utils/dateTimeHelpers';

export default function NewTaskRow({ newRow, setNewRow, taskTypes, employees, onSave, onCancel }) {
  const currentDate = newRow.deadline ? new Date(newRow.deadline).toISOString().slice(0, 10) : '';
  const currentTime = newRow.deadline ? new Date(newRow.deadline).toISOString().slice(11, 16) : DEFAULT_TIME;

  return (
    <TableRow sx={{ bgcolor: '#fef3c7' }}>
      <TableCell>✨</TableCell>
      
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
            onChange={(e) => setNewRow({ ...newRow, deadline: combineDateTime(e.target.value, currentTime) })}
            sx={{ width: 130 }}
          />
          <Select
            size="small"
            value={currentTime}
            onChange={(e) => setNewRow({ ...newRow, deadline: combineDateTime(currentDate, e.target.value) })}
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
          value={newRow.estimateHours}
          onChange={(e) => setNewRow({ ...newRow, estimateHours: parseFloat(e.target.value) })}
          sx={{ width: 80 }}
        />
      </TableCell>
      
      <TableCell>
        <FormControl size="small" fullWidth>
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
        <FormControl size="small" fullWidth>
          <Select
            value={newRow.employeeName}
            onChange={(e) => setNewRow({ ...newRow, employeeName: e.target.value })}
          >
            {employees.map(e => <MenuItem key={e} value={e}>{e}</MenuItem>)}
          </Select>
        </FormControl>
      </TableCell>
      
      <TableCell>
        <Chip label="Новая" size="small" color="warning" />
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