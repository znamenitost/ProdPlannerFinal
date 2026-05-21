import { memo } from 'react';
import { TableRow, TableCell, Box, IconButton, Tooltip, Typography, Chip } from '@mui/material';
import { areChildRowPropsEqual } from '../utils/taskTableRowMemo';
import { alpha } from '@mui/material/styles';
import { Person, Comment as CommentIcon } from '@mui/icons-material';
import {
  getStatusColor,
  getStatusIcon,
  isOverdue
} from '../utils/taskHelpers';
import { hoursColumnSx, typeColumnSx } from '../utils/taskTableColumns';
import {
  COL_ICON,
  ICON_SLOT_EXPAND,
  ICON_SLOT_FILE,
  COL_TASK,
  COL_FILE,
  COL_COMMENT,
  COL_DEADLINE,
  COL_EMPLOYEE,
  COL_STATUS,
  COL_ACTIONS,
  cellDisplayTextSx
} from '../utils/taskTableStyles';
import { formatCommentForDisplay, commentDisplaySx } from '../utils/commentLimits';
import EmployeeStatusButtons from './EmployeeStatusButtons';
import { childRowSx } from '../theme/surfaces';

function formatDeadline(deadline) {
  if (!deadline) return '—';
  const d = new Date(deadline);
  return `${d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
}

function ChildTaskRow({
  task,
  onOpenFile,
  onStart,
  onPause,
  onResume,
  onComplete,
  pendingLifecycleTaskId = null,
  onOpenComment,
  canChangeStatus,
  currentUser,
  highlightMyTasks,
  selectedEmployeeForHighlight,
  showHoursTypeColumns = true
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
      ...childRowSx,
      '&:hover': { bgcolor: 'action.hover' }
    };
    let bgColor;
    if (overdue && task.statusText !== 'Готово') {
      bgColor = (t) => alpha(t.palette.error.main, 0.06);
    }
    if (highlightMyTasks) {
      if (isMine) {
        bgColor = 'info.light';
        style.boxShadow = (t) => `inset 0 0 0 2px ${t.palette.info.main}`;
        style.borderRadius = 1;
      } else {
        style.opacity = 0.65;
        style['&:hover'] = { opacity: 0.85 };
      }
    }
    return bgColor ? { ...style, bgcolor: bgColor } : style;
  };

  const showActionButtons = canUserManage() && canChangeStatus;

  return (
    <TableRow sx={getRowStyle()}>
      <TableCell sx={COL_ICON}>
        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'nowrap' }}>
          <Box
            sx={{
              ...ICON_SLOT_EXPAND,
              height: 34,
              position: 'relative'
            }}
          >
            <Box
              sx={{
                position: 'absolute',
                left: 12,
                top: 0,
                width: 14,
                height: '50%',
                borderLeft: '2px solid #cbd5e1',
                borderBottom: '2px solid #cbd5e1',
                borderBottomLeftRadius: '6px'
              }}
            />
          </Box>
          <Box sx={{ ...ICON_SLOT_FILE, height: 34 }} />
        </Box>
      </TableCell>

      <TableCell sx={COL_TASK} />
      <TableCell sx={COL_FILE} />

      <TableCell sx={COL_COMMENT}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'nowrap' }}>
          <Tooltip
            title={task.comment || 'Нет комментария'}
            arrow
            placement="top"
            slotProps={{
              tooltip: {
                sx: {
                  bgcolor: '#1e293b',
                  fontSize: '12px',
                  padding: '8px 15px',
                  maxWidth: '400px',
                  borderRadius: 2
                }
              }
            }}
          >
            <Typography variant="body2" sx={{ color: 'text.secondary', ...commentDisplaySx, cursor: 'default' }}>
              {formatCommentForDisplay(task.comment)}
            </Typography>
          </Tooltip>
          <IconButton size="small" color="primary" onClick={() => onOpenComment(task)} sx={{ p: 0.5, flexShrink: 0 }}>
            <CommentIcon fontSize="small" sx={{ fontSize: 14 }} />
          </IconButton>
        </Box>
      </TableCell>

      <TableCell sx={COL_DEADLINE}>
        <Typography
          variant="body2"
          sx={{ color: overdue ? '#dc2626' : 'inherit', ...cellDisplayTextSx }}
        >
          {formatDeadline(task.deadline)}
        </Typography>
      </TableCell>

      <TableCell align="center" sx={hoursColumnSx(showHoursTypeColumns)}>
        <Typography variant="body2" sx={cellDisplayTextSx}>
          {task.estimateHours.toFixed(1)} ч
        </Typography>
      </TableCell>

      <TableCell sx={typeColumnSx(showHoursTypeColumns)}>
        <Tooltip title={task.type} arrow>
          <Chip
            label={task.type || '—'}
            size="small"
            variant="outlined"
            sx={{
              fontSize: '0.75rem',
              whiteSpace: 'nowrap',
              height: 'auto',
              '& .MuiChip-label': { whiteSpace: 'nowrap' }
            }}
          />
        </Tooltip>
      </TableCell>

      <TableCell sx={COL_EMPLOYEE}>
        <Chip
          icon={<Person sx={{ fontSize: 14 }} />}
          label={task.employeeName}
          size="small"
          variant="outlined"
          sx={{
            fontSize: '0.75rem',
            whiteSpace: 'nowrap',
            height: 'auto',
            '& .MuiChip-label': { whiteSpace: 'nowrap' }
          }}
        />
      </TableCell>

      <TableCell sx={COL_STATUS}>
        <Chip
          icon={displayStatusIcon}
          label={task.statusText || 'Назначена'}
          size="small"
          sx={{
            bgcolor: displayStatusColor,
            color: 'white',
            fontSize: '0.7rem',
            whiteSpace: 'nowrap'
          }}
        />
      </TableCell>

      <TableCell sx={COL_ACTIONS}>
        {showActionButtons && (
          <EmployeeStatusButtons
            task={task}
            pending={pendingLifecycleTaskId === task.id}
            onStart={onStart}
            onPause={onPause}
            onResume={onResume}
            onComplete={onComplete}
          />
        )}
      </TableCell>
    </TableRow>
  );
}

export default memo(ChildTaskRow, areChildRowPropsEqual);
