import { useState, useEffect } from 'react';
import { TableRow, TableCell, TextField, IconButton, Box, Typography } from '@mui/material';
import { Save, Cancel, Edit, PeopleAlt } from '@mui/icons-material';
import DeadlineDateTimePicker, { DEADLINE_COLUMN_SX } from './DeadlineDateTimePicker';
import { draftRowSx } from '../theme/surfaces';
import { TASK_TABLE_TEXT_FIELD_PROPS } from '../utils/taskTableStyles';
import { columnCellSx } from '../utils/taskTableColumns';
import { COLLAPSED_COLUMN_SX } from '../utils/taskTableColumns';

export default function EditTaskRow({
  task,
  onUpdate,
  onCancel,
  onOpenAssigneeModal,
  showHoursTypeColumns = true,
  columnVisibility
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
    <TableRow sx={draftRowSx}>
      <TableCell sx={{ width: '3%' }}>
        <Edit color="warning" fontSize="small" />
      </TableCell>

      <TableCell sx={columnCellSx('task', columnVisibility, showHoursTypeColumns, { width: '15%' })}>
        <TextField
          {...TASK_TABLE_TEXT_FIELD_PROPS}
          value={localTask.folderPath}
          onChange={(e) => handleFieldChange('folderPath', e.target.value)}
          placeholder="Путь к папке"
        />
      </TableCell>

      <TableCell sx={columnCellSx('file', columnVisibility, showHoursTypeColumns, { width: '10%' })}>
        <TextField
          {...TASK_TABLE_TEXT_FIELD_PROPS}
          value={localTask.fileName}
          onChange={(e) => handleFieldChange('fileName', e.target.value)}
          placeholder="Имя файла"
        />
      </TableCell>

      <TableCell sx={columnCellSx('comment', columnVisibility, showHoursTypeColumns, { width: '12%' })}>
        <TextField
          {...TASK_TABLE_TEXT_FIELD_PROPS}
          value={localTask.comment}
          onChange={(e) => handleFieldChange('comment', e.target.value)}
        />
      </TableCell>

      <TableCell sx={columnCellSx('deadline', columnVisibility, showHoursTypeColumns, DEADLINE_COLUMN_SX)}>
        <DeadlineDateTimePicker
          value={localTask.deadline}
          onChange={(deadline) => handleFieldChange('deadline', deadline)}
          hideLabel
        />
      </TableCell>

      <TableCell sx={COLLAPSED_COLUMN_SX} />
      <TableCell sx={COLLAPSED_COLUMN_SX} />

      <TableCell sx={columnCellSx('employee', columnVisibility, showHoursTypeColumns, { width: '8%' })}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0.5 }}>
          <IconButton
            size="small"
            onClick={() => onOpenAssigneeModal(localTask)}
            aria-label="Назначить сотрудников"
            sx={{ flexShrink: 0 }}
          >
            <PeopleAlt fontSize="small" color={isShared ? 'secondary' : 'action'} />
          </IconButton>
          <Typography variant="caption" sx={{ maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {isShared ? 'Общая' : (localTask.employeeName || '—')}
          </Typography>
        </Box>
      </TableCell>

      <TableCell sx={COLLAPSED_COLUMN_SX} />

      <TableCell sx={columnCellSx('actions', columnVisibility, showHoursTypeColumns, { width: '12%' })}>
        <Box sx={{ display: 'flex', gap: 0.5 }}>
          <IconButton size="small" color="primary" onClick={handleSave} aria-label="Сохранить">
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
