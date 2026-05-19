import { useState, useEffect } from 'react';
import { TableRow, TableCell, TextField, IconButton, Tooltip, Box, Typography } from '@mui/material';
import { Save, Cancel, Edit, PeopleAlt } from '@mui/icons-material';
import DeadlineDateTimePicker, { DEADLINE_COLUMN_SX } from './DeadlineDateTimePicker';

export default function EditTaskRow({
  task,
  onUpdate,
  onCancel,
  onOpenAssigneeModal
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
    isSplitTask: task.isSplitTask
  }));

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
      isSplitTask: task.isSplitTask
    });
  }, [task.id, task.estimateHours, task.isSplitTask, task.type, task.employeeName, task.deadline, task.folderPath, task.fileName, task.comment, task.statusText]);

  const handleFieldChange = (field, value) => {
    setLocalTask(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = () => {
    onUpdate(localTask);
  };

  return (
    <TableRow sx={{ bgcolor: '#fef3c7' }}>
      <TableCell sx={{ width: '3%' }}>
        <Edit color="warning" fontSize="small" />
      </TableCell>

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

      <TableCell sx={DEADLINE_COLUMN_SX}>
        <DeadlineDateTimePicker
          value={localTask.deadline}
          onChange={(deadline) => handleFieldChange('deadline', deadline)}
          hideLabel
        />
      </TableCell>

      <TableCell align="center" sx={{ width: '6%' }}>
        <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
          {localTask.estimateHours?.toFixed(1) || '0.0'} ч
        </Typography>
      </TableCell>

      <TableCell sx={{ width: '8%' }}>
        <Typography variant="body2" sx={{ fontSize: '0.75rem', color: 'text.secondary', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {isShared ? '—' : (localTask.type || '—')}
        </Typography>
      </TableCell>

      <TableCell sx={{ width: '8%' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
          <Tooltip title={isShared ? 'Изменить назначения' : 'Изменить сотрудника и часы'} arrow>
            <IconButton
              size="small"
              onClick={() => onOpenAssigneeModal(localTask)}
              sx={{ flexShrink: 0 }}
            >
              <PeopleAlt fontSize="small" sx={{ color: isShared ? '#8b5cf6' : '#64748b' }} />
            </IconButton>
          </Tooltip>
          <Typography variant="caption" sx={{ maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {isShared ? 'Общая' : (localTask.employeeName || '—')}
          </Typography>
        </Box>
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
