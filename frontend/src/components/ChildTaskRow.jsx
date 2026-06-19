import { memo } from 'react';
import { TableRow, TableCell, Box, Typography, Chip, CircularProgress } from '@mui/material';
import { areChildRowPropsEqual } from '../utils/taskTableRowMemo';
import { getCdrPreviewRowHandlers } from '../utils/cdrPreviewRowHandlers';
import { alpha } from '@mui/material/styles';
import { Person } from '@mui/icons-material';
import { columnCellSx, hoursColumnSx, typeColumnSx } from '../utils/taskTableColumns';
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
import ThroughApprovalChip from './taskTable/ThroughApprovalChip';
import TaskAdminActionStacks from './TaskAdminActionStacks';
import EmployeeStatusButtons from './EmployeeStatusButtons';
import TaskPlannedProgressFooter from './taskTable/TaskPlannedProgressFooter';
import { taskTableColumnCount } from '../utils/taskTableColumns';
import { childRowSx, highlightedTaskRowSx } from '../theme/surfaces';
import { SUPPLY_MODE_INTERNAL } from '../constants/taskStatuses';
import { getSharedGroupStripeRowSx } from '../utils/taskBorderColor';
import { getSplitSupplyMode } from '../utils/throughApproval';

function ChildTaskRow({
  task,
  sharedGroupParentTask = null,
  isLastInSharedGroup = false,
  onOpenFile,
  onShowCdrPreview,
  onStart,
  onPause,
  onResume,
  onComplete,
  onSetStatus,
  pendingLifecycleTaskId = null,
  onEdit,
  onDelete,
  onOpenComment,
  onOpenIntervals,
  isAdmin = false,
  canChangeStatus,
  currentUser,
  highlightMyTasks,
  selectedEmployeeForHighlight,
  showHoursTypeColumns = true,
  columnVisibility,
  textLimit,
  showPlannedProgress = false,
  cdrPreviewBuilding = false
}) {
  const supplyMode = getSplitSupplyMode(task, sharedGroupParentTask);
  const isSequentialChild = supplyMode === SUPPLY_MODE_INTERNAL;
  const sequenceOrder = task.sequenceOrder ?? 0;
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

  const getRowStyle = (theme) => {
    let style = {
      ...childRowSx,
      position: 'relative',
      '&:hover': { bgcolor: 'action.hover' }
    };
    let bgColor;
    if (overdue) {
      bgColor = (t) => alpha(t.palette.error.main, 0.06);
    }
    if (highlightMyTasks) {
      if (isMine) {
        style = { ...style, ...highlightedTaskRowSx(theme) };
      } else {
        style.opacity = 0.65;
        style['&:hover'] = { opacity: 0.85 };
      }
    }
    if (sharedGroupParentTask) {
      style = {
        ...style,
        ...getSharedGroupStripeRowSx(theme, sharedGroupParentTask, {
          isFirst: false,
          isLast: isLastInSharedGroup
        })
      };
    }

    return bgColor ? { ...style, bgcolor: bgColor } : style;
  };

  const showActionButtons = canUserManage() && canChangeStatus;
  const lifecycleBusy = pendingLifecycleTaskId != null;
  const tableColSpan = taskTableColumnCount(columnVisibility, showHoursTypeColumns);
  const cdrPreviewRowHandlers = getCdrPreviewRowHandlers({
    task,
    onShowCdrPreview,
  });

  return (
    <>
    <TableRow sx={(theme) => getRowStyle(theme)} {...cdrPreviewRowHandlers}>
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
          {isSequentialChild && sequenceOrder > 0 ? (
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}
            >
              Этап {sequenceOrder}
            </Typography>
          ) : (
            <Box sx={{ ...ICON_SLOT_FILE, height: 34 }} />
          )}
        </Box>
      </TableCell>

      <TableCell sx={columnCellSx('task', columnVisibility, showHoursTypeColumns, COL_TASK)} />
      <TableCell sx={columnCellSx('file', columnVisibility, showHoursTypeColumns, COL_FILE)}>
        {cdrPreviewBuilding ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CircularProgress
              size={12}
              thickness={6}
              aria-label="Построение превью"
            />
          </Box>
        ) : null}
      </TableCell>

      <TableCell sx={columnCellSx('comment', columnVisibility, showHoursTypeColumns, COL_COMMENT)}>
        <TaskCommentCell task={task} onOpenComment={onOpenComment} iconButtonColor="primary" />
      </TableCell>

      <TableCell sx={columnCellSx('deadline', columnVisibility, showHoursTypeColumns, COL_DEADLINE)}>
        <TaskDeadlineCell deadline={task.deadline} statusText={task.statusText} />
      </TableCell>

      <TableCell align="center" sx={hoursColumnSx(columnVisibility, showHoursTypeColumns)}>
        <TaskHoursCell
          estimateHours={task.estimateHours}
          requiresTestBeforeProduction={task.requiresTestBeforeProduction}
          testEstimateHours={task.testEstimateHours}
          productionEstimateHours={task.productionEstimateHours}
        />
      </TableCell>

      <TableCell sx={typeColumnSx(columnVisibility, showHoursTypeColumns)}>
        <TaskTypeCell type={task.type} />
      </TableCell>

      <TableCell sx={columnCellSx('employee', columnVisibility, showHoursTypeColumns, COL_EMPLOYEE)}>
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

      <TableCell sx={columnCellSx('status', columnVisibility, showHoursTypeColumns, COL_STATUS)}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'nowrap' }}>
          <TaskStatusCell statusText={task.statusText} />
          <ThroughApprovalChip task={task} />
        </Box>
      </TableCell>

      <TableCell sx={columnCellSx('actions', columnVisibility, showHoursTypeColumns, COL_ACTIONS)}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
          {isAdmin && onEdit && onDelete && (
            <TaskAdminActionStacks
              task={task}
              pending={pendingLifecycleTaskId === task.id}
              lifecycleBusy={lifecycleBusy}
              onEdit={() => onEdit(task.id)}
              onDelete={() => onDelete(task.id)}
              onIntervals={() => onOpenIntervals(task)}
              onStart={onStart}
              onPause={onPause}
              onResume={onResume}
              onComplete={onComplete}
              onSetStatus={onSetStatus}
              showEdit={false}
            />
          )}
          {showActionButtons && (
            <EmployeeStatusButtons
            task={task}
            pending={pendingLifecycleTaskId === task.id}
            lifecycleBusy={lifecycleBusy}
            onStart={onStart}
            onPause={onPause}
            onResume={onResume}
            onComplete={onComplete}
            onSetStatus={onSetStatus}
          />
          )}
        </Box>
      </TableCell>
    </TableRow>
    <TaskPlannedProgressFooter
      task={task}
      colSpan={tableColSpan}
      enabled={showPlannedProgress}
    />
    </>
  );
}

export default memo(ChildTaskRow, areChildRowPropsEqual);
