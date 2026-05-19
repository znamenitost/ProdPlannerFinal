import { TableRow, TableCell, Box, IconButton, Tooltip, Typography, Chip } from '@mui/material';
import { Person, Comment as CommentIcon } from '@mui/icons-material';
import {
  truncate,
  getStatusColor,
  getStatusIcon,
  isOverdue,
  isTaskBelongsToUser
} from '../utils/taskHelpers';
import EmployeeStatusButtons from './EmployeeStatusButtons';
import { COL_ACTIONS } from '../utils/taskTableStyles';

export default function ChildTaskRow({
  task,
  onOpenFile,
  onStart,
  onPause,
  onResume,
  onComplete,
  onOpenComment,
  canChangeStatus,
  currentUser,
  highlightMyTasks,
  selectedEmployeeForHighlight
}) {
  const overdue = isOverdue(task.deadline, task.statusText);
  const displayStatusIcon = getStatusIcon(task.statusText);
  const displayStatusColor = getStatusColor(task.statusText);

  let isMine = false;
  if (currentUser?.role === 'Admin' && selectedEmployeeForHighlight) {
    isMine = task.employeeName === selectedEmployeeForHighlight && task.statusText !== 'Готово';
  } else if (currentUser?.role !== 'Admin') {
    isMine = task.employeeName === currentUser?.fullName && task.statusText !== 'Готово';
  }

  const canUserManage = () => {
    if (!currentUser) return false;
    if (currentUser.role === 'Admin') return true;
    return task.employeeName === currentUser.fullName && task.statusText !== 'Готово';
  };

  const getRowStyle = () => {
    let style = {
      '&:hover': { bgcolor: '#f8fafc' },
      position: 'relative'
    };
    let bgColor = overdue && task.statusText !== 'Готово' ? '#fef2f2' : 'inherit';
    if (highlightMyTasks) {
      if (isMine) {
        bgColor = '#e6f7ff';
        style.boxShadow = 'inset 0 0 0 2px #1890ff';
        style.borderRadius = '4px';
      } else {
        style.opacity = '0.65';
        style['&:hover'] = { bgcolor: '#f8fafc', opacity: '0.85' };
      }
    }
    return { ...style, bgcolor: bgColor };
  };

  const showActionButtons = canUserManage() && canChangeStatus;

  return (
    <TableRow sx={getRowStyle()}>
      <TableCell sx={{ width: '3%', p: 0, position: 'relative' }}>
        <Box
          sx={{
            position: 'absolute',
            left: '16px',
            top: '-8px',
            width: '24px',
            height: 'calc(100% + 8px)',
            '&::before': {
              content: '""',
              position: 'absolute',
              left: 0,
              top: 0,
              width: '16px',
              height: '50%',
              borderLeft: '2px solid #cbd5e1',
              borderBottom: '2px solid #cbd5e1',
              borderBottomLeftRadius: '8px',
            }
          }}
        />
      </TableCell>
      
      <TableCell sx={{ width: '15%' }} />
      <TableCell sx={{ width: '10%' }} />
      
      <TableCell sx={{ width: '20%' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Tooltip title={task.comment || 'Нет комментария'} arrow placement="top"
            slotProps={{ tooltip: { sx: { bgcolor: '#1e293b', fontSize: '12px', padding: '8px 15px', maxWidth: '400px', borderRadius: 2 } } }}
          >
            <Typography variant="body2" sx={{
              color: 'text.secondary',
              fontSize: '0.8rem',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              wordBreak: 'break-word',
              maxWidth: '100%',
              cursor: 'default'
            }}>
              {truncate(task.comment || '—', 25)}
            </Typography>
          </Tooltip>
          <IconButton size="small" onClick={() => onOpenComment(task)} sx={{ p: 0.5, flexShrink: 0 }}>
            <CommentIcon fontSize="small" sx={{ fontSize: 14, color: '#7c9ebf' }} />
          </IconButton>
        </Box>
      </TableCell>
      
      <TableCell sx={{ width: '10%', display: 'none' }} />
      
      <TableCell align="center" sx={{ width: '6%' }}>
        <Typography variant="body2" sx={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
          {task.estimateHours.toFixed(1)} ч
        </Typography>
      </TableCell>
      
      <TableCell sx={{ width: '8%' }}>
        <Tooltip title={task.type} arrow>
          <Chip label={truncate(task.type, 20)} size="small" variant="outlined" sx={{ fontSize: '0.7rem', maxWidth: '100%' }} />
        </Tooltip>
      </TableCell>
      
      <TableCell sx={{ width: '8%' }}>
        <Chip icon={<Person sx={{ fontSize: 14 }} />} label={task.employeeName} size="small" variant="outlined" sx={{ fontSize: '0.7rem', whiteSpace: 'nowrap' }} />
      </TableCell>
      
      <TableCell sx={{ width: '8%' }}>
        <Chip icon={displayStatusIcon} label={task.statusText || "Назначена"} size="small" sx={{ bgcolor: displayStatusColor, color: 'white', fontSize: '0.7rem', whiteSpace: 'nowrap' }} />
      </TableCell>
      
      <TableCell sx={COL_ACTIONS}>
        {showActionButtons ? (
          <EmployeeStatusButtons
            task={task}
            onStart={onStart}
            onPause={onPause}
            onResume={onResume}
            onComplete={onComplete}
          />
        ) : null}
      </TableCell>
    </TableRow>
  );
}