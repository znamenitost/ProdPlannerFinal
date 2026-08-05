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
import TaskPriorityChip from './taskTable/TaskPriorityChip';
import FussTaskChip from './taskTable/FussTaskChip';
import MaxSubscribeChip from './taskTable/MaxSubscribeChip';
import TaskAdminActionStacks from './TaskAdminActionStacks';
import EmployeeStatusButtons from './EmployeeStatusButtons';
import TaskPlannedProgressFooter from './taskTable/TaskPlannedProgressFooter';
import { taskTableColumnCount } from '../utils/taskTableColumns';
import { childRowSx, highlightedTaskRowSx } from '../theme/surfaces';
import { isFinishedStatusText, SUPPLY_MODE_INTERNAL } from '../constants/taskStatuses';
import { getSharedGroupAccentColor, getSharedGroupStripeRowSx } from '../utils/taskBorderColor';
import { getSplitSupplyMode } from '../utils/throughApproval';
import { getPriorityMarkViewerEmployeeName } from '../utils/taskPriorityMark';
import { isSameEmployeeName } from '../utils/employeeNameMatch';
import { canPrintOrderLabel } from '../utils/printLabelPrompt';

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
  onTogglePriority,
  pendingLifecycleTaskId = null,
  onEdit,
  onDelete,
  onCopyOrderLink,
  onPrintOrderLabel,
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
  cdrPreviewBuilding = false,
  maxSubscribed = false,
  maxCanSubscribe = false,
  onMaxSubscribeToggle,
  forceCommentTooltipTaskId = null,
  onForceCommentTooltipClose,
  actionsColumnSx = COL_ACTIONS
}) {
  const supplyMode = getSplitSupplyMode(task, sharedGroupParentTask);
  const isSequentialChild = supplyMode === SUPPLY_MODE_INTERNAL;
  const sequenceOrder = task.sequenceOrder ?? 0;
  const overdue = task.deadline && !isFinishedStatusText(task.statusText) && new Date(task.deadline) < new Date();

  let isMine = false;
  if (currentUser?.role === 'Admin' && selectedEmployeeForHighlight) {
    isMine = isSameEmployeeName(task.employeeName, selectedEmployeeForHighlight) && !isFinishedStatusText(task.statusText);
  } else if (currentUser?.role !== 'Admin') {
    isMine = isSameEmployeeName(task.employeeName, currentUser?.fullName) && !isFinishedStatusText(task.statusText);
  }

  const canUserManage = () => {
    if (!currentUser) return false;
    if (currentUser.role === 'Admin') return true;
    return isSameEmployeeName(task.employeeName, currentUser.fullName) && !isFinishedStatusText(task.statusText);
  };

  const priorityMarkViewer = getPriorityMarkViewerEmployeeName(currentUser);

  const getRowStyle = (theme) => {
    let style = {
      ...childRowSx,
      position: 'relative',
      '&:hover': { bgcolor: 'action.hover' }
    };

    // Group band first; mine / overdue may override bgcolor.
    if (sharedGroupParentTask) {
      style = {
        ...style,
        ...getSharedGroupStripeRowSx(theme, {
          isFirst: false,
          isLast: isLastInSharedGroup,
          role: 'child'
        })
      };
    }

    if (highlightMyTasks) {
      if (isMine) {
        style = { ...style, ...highlightedTaskRowSx(theme) };
      } else {
        style = {
          ...style,
          opacity: 0.65,
          '&:hover': { ...(style['&:hover'] || {}), opacity: 0.85 }
        };
      }
    } else if (overdue) {
      style = {
        ...style,
        bgcolor: alpha(theme.palette.error.main, 0.06)
      };
    }

    return style;
  };

  const showLifecycleMenu = canUserManage() && canChangeStatus;
  // Дочерний split обычно не печатаем; если canPrint — меню ⋯ всё равно доступно любому сотруднику.
  const printLabelHandler = !task.isFuss ? onPrintOrderLabel : undefined;
  const showPrintMenu = Boolean(printLabelHandler) && canPrintOrderLabel(task) && canChangeStatus;
  const showActionButtons = showLifecycleMenu || showPrintMenu;
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
              sx={(theme) => ({
                position: 'absolute',
                left: 12,
                top: 0,
                width: 14,
                height: '50%',
                borderLeft: '2px solid',
                borderBottom: '2px solid',
                borderColor: sharedGroupParentTask
                  ? getSharedGroupAccentColor(theme)
                  : theme.palette.grey[300],
                borderBottomLeftRadius: '6px'
              })}
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
        <TaskCommentCell
          task={task}
          onOpenComment={onOpenComment}
          iconButtonColor="primary"
          forceTooltipOpen={forceCommentTooltipTaskId === task.id}
          onForceTooltipClose={onForceCommentTooltipClose}
        />
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
          isFuss={task.isFuss}
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
          <TaskStatusCell statusText={task.statusText} task={task} />
          <ThroughApprovalChip task={task} />
          <FussTaskChip task={task} />
          <TaskPriorityChip task={task} viewerEmployeeName={priorityMarkViewer} />
          {isAdmin && <MaxSubscribeChip subscribed={maxSubscribed} />}
        </Box>
      </TableCell>

      <TableCell sx={columnCellSx('actions', columnVisibility, showHoursTypeColumns, actionsColumnSx)}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, alignItems: 'center', justifyContent: 'center' }}>
          {isAdmin && onEdit && onDelete && (
            <TaskAdminActionStacks
              task={task}
              pending={pendingLifecycleTaskId === task.id}
              lifecycleBusy={lifecycleBusy}
              onEdit={() => onEdit(task.id)}
              onDelete={() => onDelete(task.id)}
              onCopyOrderLink={onCopyOrderLink}
              onPrintOrderLabel={onPrintOrderLabel}
              onIntervals={() => onOpenIntervals(task)}
              onStart={onStart}
              onPause={onPause}
              onResume={onResume}
              onComplete={onComplete}
              onSetStatus={onSetStatus}
              onTogglePriority={onTogglePriority}
              showEdit={false}
              maxSubscribed={maxSubscribed}
              maxCanSubscribe={maxCanSubscribe}
              onMaxSubscribeToggle={onMaxSubscribeToggle}
            />
          )}
          {showActionButtons && (
            <EmployeeStatusButtons
              task={task}
              pending={pendingLifecycleTaskId === task.id}
              lifecycleBusy={lifecycleBusy}
              onStart={showLifecycleMenu ? onStart : undefined}
              onPause={showLifecycleMenu ? onPause : undefined}
              onResume={showLifecycleMenu ? onResume : undefined}
              onComplete={showLifecycleMenu ? onComplete : undefined}
              onSetStatus={showLifecycleMenu && !task.isFuss ? onSetStatus : null}
              onTogglePriority={showLifecycleMenu ? onTogglePriority : undefined}
              onPrintOrderLabel={printLabelHandler}
            />
          )}
        </Box>
      </TableCell>
    </TableRow>
    <TaskPlannedProgressFooter
      task={task}
      colSpan={tableColSpan}
      enabled={showPlannedProgress}
      actionsColumnSx={actionsColumnSx}
    />
    </>
  );
}

export default memo(ChildTaskRow, areChildRowPropsEqual);
