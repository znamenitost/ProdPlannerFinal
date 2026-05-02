import { TableRow, TableCell, TextField, Select, MenuItem, FormControl, InputLabel, Box, Chip, IconButton, Tooltip, Button } from '@mui/material';
import { Save, Cancel } from '@mui/icons-material';

// Рабочие часы: 10:00 – 19:00 с шагом 30 минут
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

export default function NewTaskRow({ newRow, setNewRow, taskTypes, employees, onSave, onCancel }) {
  const currentDate = newRow.deadline ? new Date(newRow.deadline).toISOString().slice(0, 10) : '';
  const currentTime = newRow.deadline ? new Date(newRow.deadline).toISOString().slice(11, 16) : DEFAULT_TIME;
  
  return (
    <TableRow sx={{ bgcolor: '#fef3c7' }}>
      <TableCell>✨</TableCell>
      <TableCell><TextField size="small" placeholder="Имя файла" value={newRow.fileName} onChange={(e) => setNewRow({ ...newRow, fileName: e.target.value })} fullWidth /></TableCell>
      <TableCell><TextField size="small" placeholder="Комментарий" value={newRow.comment} onChange={(e) => setNewRow({ ...newRow, comment: e.target.value })} fullWidth /></TableCell>
      <TableCell>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField size="small" type="date" value={currentDate} onChange={(e) => setNewRow({ ...newRow, deadline: `${e.target.value}T${currentTime}` })} sx={{ width: 130 }} />
          <Select size="small" value={currentTime} onChange={(e) => setNewRow({ ...newRow, deadline: `${currentDate}T${e.target.value}` })} sx={{ width: 85 }}>
            {WORK_TIME_OPTIONS.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
          </Select>
        </Box>
      </TableCell>
      <TableCell><TextField type="number" size="small" value={newRow.estimateHours} onChange={(e) => setNewRow({ ...newRow, estimateHours: parseFloat(e.target.value) })} sx={{ width: 80 }} /></TableCell>
      <TableCell>
        <FormControl size="small" fullWidth>
          <InputLabel>Типы работ</InputLabel>
          <Select multiple value={newRow.types || []} label="Типы работ" onChange={(e) => setNewRow({ ...newRow, types: e.target.value })} renderValue={(selected) => selected.join(', ')}>
            {taskTypes.map((type) => <MenuItem key={type} value={type}>{type}</MenuItem>)}
          </Select>
        </FormControl>
      </TableCell>
      <TableCell>
        <FormControl size="small" fullWidth>
          <Select value={newRow.employeeName} onChange={(e) => setNewRow({ ...newRow, employeeName: e.target.value })}>
            {employees.map(e => <MenuItem key={e} value={e}>{e}</MenuItem>)}
          </Select>
        </FormControl>
      </TableCell>
      <TableCell><Chip label="Новая" size="small" color="warning" /></TableCell>
      <TableCell>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <IconButton size="small" color="primary" onClick={onSave}><Save fontSize="small" /></IconButton>
          <IconButton size="small" color="error" onClick={onCancel}><Cancel fontSize="small" /></IconButton>
        </Box>
      </TableCell>
    </TableRow>
  );
}