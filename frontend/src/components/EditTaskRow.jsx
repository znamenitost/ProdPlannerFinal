// ./frontend/src/components/EditTaskRow.jsx
import { useState, useEffect, useRef } from 'react';
import { TableRow, TableCell, TextField, Select, MenuItem, IconButton, Tooltip, Box } from '@mui/material';
import { Save, Cancel } from '@mui/icons-material';
import { WORK_TIME_OPTIONS, parseDateTime, combineDateTime } from '../utils/dateTimeHelpers';

export default function EditTaskRow({ task, onUpdate, onCancel, taskTypes, employees }) {
  // Инициализируем состояние только один раз при монтировании или при изменении id задачи
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
    statusText: task.statusText || ''
  }));

  // Если открыли редактирование другой задачи (id изменился), обновляем локальное состояние
  const prevIdRef = useRef(task.id);
  useEffect(() => {
    if (task.id !== prevIdRef.current) {
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
        statusText: task.statusText || ''
      });
      prevIdRef.current = task.id;
    }
  }, [task.id, task]);

  const handleFieldChange = (field, value) => {
    setLocalTask(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    onUpdate(localTask);
  };

  // Преобразуем дедлайн для отображения
  let date = '', time = '10:00';
  if (localTask.deadline) {
    const parsed = parseDateTime(localTask.deadline);
    date = parsed.date;
    time = parsed.time;
  }

  return (
    <TableRow sx={{ bgcolor: '#fef3c7' }}>
      <TableCell sx={{ width: '3%' }}>✏️</TableCell>

      <TableCell sx={{ width: '15%' }}>
        <TextField
          size="small"
          value={localTask.folderPath}
          onChange={(e) => handleFieldChange('folderPath', e.target.value)}
          fullWidth
          placeholder="Путь к папке"
        />
      </TableCell>

      <TableCell sx={{ width: '10%' }}>
        <TextField
          size="small"
          value={localTask.fileName}
          onChange={(e) => handleFieldChange('fileName', e.target.value)}
          fullWidth
          placeholder="Имя файла"
        />
      </TableCell>

      <TableCell sx={{ width: '20%' }}>
        <TextField
          size="small"
          value={localTask.comment}
          onChange={(e) => handleFieldChange('comment', e.target.value)}
          fullWidth
        />
      </TableCell>

      <TableCell sx={{ width: '10%' }}>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            size="small"
            type="date"
            value={date}
            onChange={(e) => handleFieldChange('deadline', combineDateTime(e.target.value, time))}
            sx={{ width: 130 }}
          />
          <Select
            size="small"
            value={time}
            onChange={(e) => handleFieldChange('deadline', combineDateTime(date, e.target.value))}
            sx={{ width: 85 }}
          >
            {WORK_TIME_OPTIONS.map(t => <MenuItem key={t} value={t}>{t}</MenuItem>)}
          </Select>
        </Box>
      </TableCell>

      <TableCell align="center" sx={{ width: '6%' }}>
        <TextField
          size="small"
          type="number"
          value={localTask.estimateHours}
          onChange={(e) => handleFieldChange('estimateHours', parseFloat(e.target.value) || 0)}
          slotProps={{ htmlInput: { step: 0.5, min: 0 } }}
          sx={{ width: 80 }}
        />
      </TableCell>

      <TableCell sx={{ width: '8%' }}>
        <Select
          size="small"
          multiple
          value={localTask.type ? localTask.type.split(', ') : []}
          onChange={(e) => handleFieldChange('type', e.target.value.join(', '))}
          renderValue={(selected) => selected.join(', ')}
          fullWidth
        >
          {taskTypes.map((type) => <MenuItem key={type} value={type}>{type}</MenuItem>)}
        </Select>
      </TableCell>

      <TableCell sx={{ width: '8%' }}>
        <Select
          size="small"
          value={localTask.employeeName}
          onChange={(e) => handleFieldChange('employeeName', e.target.value)}
          fullWidth
        >
          {employees.map(emp => <MenuItem key={emp} value={emp}>{emp}</MenuItem>)}
        </Select>
      </TableCell>

      <TableCell sx={{ width: '8%' }}>
        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{localTask.statusText || 'Назначена'}</span>
      </TableCell>

      <TableCell sx={{ width: '12%' }}>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <Tooltip title="Сохранить">
            <IconButton size="small" color="primary" onClick={handleSave}>
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