import { memo } from 'react';
import { TableRow, TableCell, Box, Typography, Chip } from '@mui/material';
import { areChildRowPropsEqual } from '../utils/taskTableRowMemo';
import { alpha } from '@mui/material/styles';
import { Person } from '@mui/icons-material';
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
  COL_ACTIONS
} from '../utils/taskTableStyles';
import TaskCommentCell from './taskTable/TaskCommentCell';
import TaskDeadlineCell from './taskTable/TaskDeadlineCell';
import TaskHoursCell from './taskTable/TaskHoursCell';
import TaskTypeCell from './taskTable/TaskTypeCell';
import TaskStatusCell from './taskTable/TaskStatusCell';
import EmployeeStatusButtons from './EmployeeStatusButtons';
import { childRowSx } from '../theme/surfaces';

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
  const overdue = task.deadline && task.statusText !== 'Готово' && new Date(task.deadline) < new Date();

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
    if (overdue) {
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
          <Box sx={{ ...ICON_SLOT_EXPAND, height: 34, position: 'relative' }}>
            <Box
              sx={{
                position: 'absolute',
                left: 12,
                top: 0,
                width: 14,
                height: '50%',
                borderLeft: '2px solid',
                borderBottom: '2px solid',
                borderColor: 'grey.300',
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
        <TaskCommentCell task={task} onOpenComment={onOpenComment} iconButtonColor="primary" />
      </TableCell>

      <TableCell sx={COL_DEADLINE}>
        <TaskDeadlineCell deadline={task.deadline} statusText={task.statusText} />
      </TableCell>

      <TableCell align="center" sx={hoursColumnSx(showHoursTypeColumns)}>
        <TaskHoursCell estimateHours={task.estimateHours} />
      </TableCell>

      <TableCell sx={typeColumnSx(showHoursTypeColumns)}>
        <TaskTypeCell type={task.type} />
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
        <TaskStatusCell statusText={task.statusText} />
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
