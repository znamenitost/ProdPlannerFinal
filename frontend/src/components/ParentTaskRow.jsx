import { Fragment, memo, useMemo } from 'react';
import { areParentRowPropsEqual } from '../utils/taskTableRowMemo';
import { getCdrPreviewRowHandlers } from '../utils/cdrPreviewRowHandlers';
import {
  TableRow,
  TableCell,
  Box,
  IconButton,
  Typography,
  Chip
} from '@mui/material';
import {
  FolderOpen,
  ExpandMore,
  ChevronRight,
  Person,
  Groups
} from '@mui/icons-material';
import { getParentEmployeeDisplay, getLastPathSegment } from '../utils/taskHelpers';
import TaskCommentCell from './taskTable/TaskCommentCell';
import TaskDeadlineCell from './taskTable/TaskDeadlineCell';
import TaskHoursCell from './taskTable/TaskHoursCell';
import TaskTypeCell from './taskTable/TaskTypeCell';
import TaskStatusCell from './taskTable/TaskStatusCell';
import PickupIssueButton from './taskTable/PickupIssueButton';
import ThroughApprovalChip from './taskTable/ThroughApprovalChip';
import TaskPriorityChip from './taskTable/TaskPriorityChip';
import IssuedWithoutReadyChip from './taskTable/IssuedWithoutReadyChip';
import FussTaskChip from './taskTable/FussTaskChip';
import MaxSubscribeChip from './taskTable/MaxSubscribeChip';
import ChildTaskRow from './ChildTaskRow';
import TaskAdminActionStacks from './TaskAdminActionStacks';
import EmployeeStatusButtons from './EmployeeStatusButtons';
import TableTruncatedTooltip from './taskTable/TableTruncatedTooltip';
import LazyTooltip from './common/LazyTooltip';
import TaskPlannedProgressFooter from './taskTable/TaskPlannedProgressFooter';
import TaskFileNameCell from './taskTable/TaskFileNameCell';
import { getFussTaskTitle } from './TaskTitleTwoLines';
import { taskTableColumnCount } from '../utils/taskTableColumns';
import { columnCellSx, hoursColumnSx, typeColumnSx } from '../utils/taskTableColumns';
import { alpha } from '@mui/material/styles';
import { highlightedTaskRowSx, overdueTaskRowSx } from '../theme/surfaces';
import { isFinishedStatusText } from '../constants/taskStatuses';
import {
  COL_ICON,
  ICON_SLOT_EXPAND,
  ICON_SLOT_GROUPS,
  ICON_SLOT_FILE,
  COL_TASK,
  COL_FILE,
  COL_COMMENT,
  COL_DEADLINE,
  COL_EMPLOYEE,
  COL_STATUS,
  COL_ACTIONS,
  cellDisplayTextSx,
  truncateText,
  needsTooltip
} from '../utils/taskTableStyles';
import { SUPPLY_MODE_INTERNAL } from '../constants/taskStatuses';
import { getSharedGroupStripeRowSx } from '../utils/taskBorderColor';
import { getPriorityMarkViewerEmployeeName } from '../utils/taskPriorityMark';
import { isSameEmployeeName } from '../utils/employeeNameMatch';

function ParentTaskRow({
  task,
  childrenTasks,
  isExpanded,
  onToggleExpand,
  onOpenFile,
  onOpenFolder,
  onShowCdrPreview,
  cdrPreviewSourceTask = task,
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
  canEdit,
  canDelete,
  canChangeStatus,
  currentUser,
  highlightMyTasks,
  selectedEmployeeForHighlight,
  showHoursTypeColumns = true,
  columnVisibility,
  textLimit: limit = 23,
  showPlannedProgress = false,
  isCdrPreviewBuilding = () => false,
  /** Переопределение индикатора сборки превью для самой строки (promote single child). */
  cdrPreviewBuilding = null,
  maxSubscribedTaskIds = [],
  maxCanSubscribe = false,
  onMaxSubscribeToggle,
  forceCommentTooltipTaskId = null,
  onForceCommentTooltipClose,
  actionsColumnSx = COL_ACTIONS,
  pickupMode = false,
  onIssueOrder,
  issuingPickup = false,
  pickupHighlighted = false
}) {
  const maxSubscribedSet = useMemo(
    () => new Set((maxSubscribedTaskIds || []).map(Number)),
    [maxSubscribedTaskIds]
  );
  const hasChildren = task.isSplitTask || (childrenTasks && childrenTasks.length > 0);
  const lifecycleBusy = pendingLifecycleTaskId != null;

  const displayStatus = task.statusText || 'Назначена';

  const hasActiveSubtaskForEmployee = (employeeName) => {
    if (!employeeName) return false;

    if (Array.isArray(childrenTasks) && childrenTasks.length > 0) {
      return childrenTasks.some(
        (child) => isSameEmployeeName(child.employeeName, employeeName) && !isFinishedStatusText(child.statusText)
      );
    }

    const splitEmployees = String(task.splitEmployeeNames || '')
      .split('/')
      .map((name) => name.trim())
      .filter(Boolean);
    return splitEmployees.some((name) => isSameEmployeeName(name, employeeName));
  };

  // ========== ПОДСВЕТКА ДЛЯ АДМИНИСТРАТОРА И СОТРУДНИКА ==========
  let isMine = false;

  if (highlightMyTasks) {
    if (currentUser?.role === 'Admin' && selectedEmployeeForHighlight) {
      if (hasChildren) {
        isMine = !isExpanded && hasActiveSubtaskForEmployee(selectedEmployeeForHighlight);
      } else {
        isMine = isSameEmployeeName(task.employeeName, selectedEmployeeForHighlight) && !isFinishedStatusText(task.statusText);
      }
    }
    else if (currentUser?.role !== 'Admin') {
      if (hasChildren) {
        isMine = !isExpanded && hasActiveSubtaskForEmployee(currentUser?.fullName);
      } else {
        isMine = isSameEmployeeName(task.employeeName, currentUser?.fullName) && !isFinishedStatusText(task.statusText);
      }
    }
  }

  const employeeDisplay = getParentEmployeeDisplay(task, childrenTasks);

  const fullFilePath = `${task.folderPath || ''}/${task.fileName || ''}`.replace(/\/\//g, '/');
  const shortFolderPath = getLastPathSegment(task.folderPath);
  const taskColumnLabel = task.isFuss
    ? getFussTaskTitle(task)
    : pickupMode
      ? (task.customerName || shortFolderPath || task.folderPath || '—')
      : (shortFolderPath || task.folderPath || '—');
  const taskColumnFullText = task.isFuss
    ? taskColumnLabel
    : pickupMode && task.customerName
      ? `${task.customerName} (${task.folderPath || ''})`
      : (task.folderPath || '');
  const cdrPreviewRowHandlers = getCdrPreviewRowHandlers({
    task,
    previewTask: cdrPreviewSourceTask,
    onShowCdrPreview,
  });

  const canUserManage = () => {
    if (!currentUser) return false;
    if (currentUser.role === 'Admin') return true;
    if (!hasChildren) {
      return isSameEmployeeName(task.employeeName, currentUser.fullName) && !isFinishedStatusText(task.statusText);
    }
    return false;
  };

  const childCount = childrenTasks?.length ?? 0;
  const priorityMarkViewer = getPriorityMarkViewerEmployeeName(currentUser);
  const showSharedGroupStripe = hasChildren && isExpanded;
  const sharedGroupExpanded = showSharedGroupStripe && childCount > 0;

  const getRowStyle = (theme) => {
    const overdue =
      task.deadline && !isFinishedStatusText(task.statusText) && new Date(task.deadline) < new Date();
    let style = {
      borderLeft: 'none',
      '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) }
    };

    if (pickupHighlighted) {
      style = {
        ...style,
        outline: '2px solid',
        outlineColor: 'success.main',
        outlineOffset: -2,
        bgcolor: alpha(theme.palette.success.main, 0.08)
      };
    }

    // Group band first; mine / overdue highlights may override bgcolor.
    if (showSharedGroupStripe) {
      style = {
        ...style,
        ...getSharedGroupStripeRowSx(theme, {
          isFirst: true,
          isLast: !sharedGroupExpanded,
          role: 'parent'
        })
      };
    }

    if (highlightMyTasks && isMine) {
      style = { ...style, ...highlightedTaskRowSx(theme) };
    } else if (highlightMyTasks && !isMine) {
      style = {
        ...style,
        opacity: 0.65,
        '&:hover': {
          ...(style['&:hover'] || {}),
          bgcolor: alpha(theme.palette.primary.main, 0.04),
          opacity: 0.85
        }
      };
    } else if (overdue) {
      style = { ...style, ...overdueTaskRowSx(theme) };
    }

    return style;
  };

  const showActionButtons = canUserManage() && canChangeStatus && !hasChildren;
  const tableColSpan = taskTableColumnCount(columnVisibility, showHoursTypeColumns);
  const sharedTaskIconSx = {
    color: (theme) => task.supplyMode === SUPPLY_MODE_INTERNAL
      ? theme.palette.info.main
      : theme.palette.success.main
  };

  return (
    <Fragment>
      <TableRow
        sx={(theme) => getRowStyle(theme)}
        {...cdrPreviewRowHandlers}
      >
        {/* Первая ячейка: управление раскрытием + индикатор сплит-задачи + кнопка открытия файла.
            В режиме выдачи производственная навигация по строке не нужна. */}
        <TableCell sx={COL_ICON}>
          <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'nowrap', width: '100%' }}>
            <Box sx={ICON_SLOT_EXPAND}>
              {!pickupMode && hasChildren ? (
                <IconButton
                  size="small"
                  variant="soft"
                  color="primary"
                  onClick={() => onToggleExpand(task.id)}
                  aria-label={isExpanded ? 'Свернуть подзадачи' : 'Развернуть подзадачи'}
                  sx={{ p: 0.5 }}
                >
                  {isExpanded ? <ExpandMore fontSize="small" /> : <ChevronRight fontSize="small" />}
                </IconButton>
              ) : null}
            </Box>

            <Box sx={ICON_SLOT_GROUPS}>
              {task.isSplitTask ? (
                <LazyTooltip title="Общая задача" arrow>
                  <Groups fontSize="small" sx={sharedTaskIconSx} />
                </LazyTooltip>
              ) : null}
            </Box>

            <Box sx={ICON_SLOT_FILE}>
              {!pickupMode && (
                <LazyTooltip
                  title={`Открыть файл: ${fullFilePath}. ПКМ — открыть папку в проводнике`}
                  arrow
                >
                  <IconButton
                    size="small"
                    color="primary"
                    onClick={() => onOpenFile(task)}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      onOpenFolder?.(task);
                    }}
                    aria-label={`Открыть файл: ${fullFilePath}. Правая кнопка — открыть папку`}
                    sx={{ p: 0.5 }}
                  >
                    <FolderOpen fontSize="small" />
                  </IconButton>
                </LazyTooltip>
              )}
            </Box>
          </Box>
        </TableCell>

        <TableCell sx={columnCellSx('task', columnVisibility, showHoursTypeColumns, COL_TASK)}>
          <TableTruncatedTooltip fullText={taskColumnFullText} limit={limit}>
            <Typography
              variant="body2"
              sx={{
                fontWeight: showSharedGroupStripe ? 700 : 600,
                ...cellDisplayTextSx
              }}
            >
              {needsTooltip(taskColumnLabel, limit)
                ? truncateText(taskColumnLabel, limit)
                : taskColumnLabel}
            </Typography>
          </TableTruncatedTooltip>
        </TableCell>

        <TableCell sx={columnCellSx('file', columnVisibility, showHoursTypeColumns, COL_FILE)}>
          <TaskFileNameCell
            fileName={task.isFuss ? '' : task.fileName}
            task={task}
            textLimit={limit}
            previewBuilding={
              cdrPreviewBuilding != null
                ? Boolean(cdrPreviewBuilding)
                : isCdrPreviewBuilding(task.id)
            }
          />
        </TableCell>

        <TableCell sx={columnCellSx('comment', columnVisibility, showHoursTypeColumns, COL_COMMENT)}>
          <TaskCommentCell
            task={task}
            onOpenComment={onOpenComment}
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
          {pickupMode ? (
            <Chip
              label={task.pickupCode || '—'}
              size="small"
              color={task.pickupCode ? 'primary' : 'default'}
              variant={task.pickupCode ? 'filled' : 'outlined'}
              sx={{
                fontSize: '0.85rem',
                fontWeight: 700,
                letterSpacing: '0.08em',
                whiteSpace: 'nowrap'
              }}
            />
          ) : (
            <TaskTypeCell type={task.type} />
          )}
        </TableCell>

        <TableCell sx={columnCellSx('employee', columnVisibility, showHoursTypeColumns, COL_EMPLOYEE)}>
          <Chip icon={<Person sx={{ fontSize: 14 }} />} label={employeeDisplay} size="small" variant="outlined" sx={{ fontSize: '0.75rem', whiteSpace: 'nowrap', height: 'auto', '& .MuiChip-label': { whiteSpace: 'nowrap' } }} />
        </TableCell>

        <TableCell sx={columnCellSx('status', columnVisibility, showHoursTypeColumns, COL_STATUS)}>
          {pickupMode ? (
            <PickupIssueButton
              task={task}
              issuing={issuingPickup}
              onIssue={onIssueOrder}
            />
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'nowrap' }}>
              <TaskStatusCell
                statusText={task.statusText}
                label={hasChildren ? displayStatus : undefined}
                task={task}
              />
              <ThroughApprovalChip task={task} childrenTasks={childrenTasks} />
              <FussTaskChip task={task} />
              <TaskPriorityChip
                task={task}
                childrenTasks={childrenTasks}
                viewerEmployeeName={priorityMarkViewer}
              />
              <IssuedWithoutReadyChip task={task} />
              {canEdit && <MaxSubscribeChip subscribed={maxSubscribedSet.has(task.id)} />}
            </Box>
          )}
        </TableCell>

        <TableCell sx={columnCellSx('actions', columnVisibility, showHoursTypeColumns, actionsColumnSx)}>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center' }}>
            {!pickupMode && canEdit && canDelete && (
              <TaskAdminActionStacks
                task={task}
                pending={pendingLifecycleTaskId === task.id}
                lifecycleBusy={lifecycleBusy}
                onEdit={task.isFuss ? undefined : () => onEdit(task.id)}
                onDelete={() => onDelete(task.id)}
                onCopyOrderLink={task.isFuss ? undefined : onCopyOrderLink}
                onPrintOrderLabel={task.isFuss ? undefined : onPrintOrderLabel}
                onIntervals={hasChildren || task.isFuss ? undefined : () => onOpenIntervals(task)}
                onStart={onStart}
                onPause={onPause}
                onResume={onResume}
                onComplete={onComplete}
                onSetStatus={hasChildren || task.isFuss ? null : onSetStatus}
                onTogglePriority={hasChildren || task.isFuss ? null : onTogglePriority}
                showWorkflow={!hasChildren}
                maxSubscribed={maxSubscribedSet.has(task.id)}
                maxCanSubscribe={maxCanSubscribe}
                onMaxSubscribeToggle={onMaxSubscribeToggle}
              />
            )}
            {!pickupMode && showActionButtons && (
              <EmployeeStatusButtons
                task={task}
                pending={pendingLifecycleTaskId === task.id}
                lifecycleBusy={lifecycleBusy}
                onStart={onStart}
                onPause={onPause}
                onResume={onResume}
                onComplete={onComplete}
                onSetStatus={task.isFuss ? null : onSetStatus}
                onTogglePriority={onTogglePriority}
              />
            )}
          </Box>
        </TableCell>
      </TableRow>

      {!pickupMode && (
        <TaskPlannedProgressFooter
          task={task}
          colSpan={tableColSpan}
          enabled={showPlannedProgress}
          color={hasChildren ? 'primary' : 'success'}
          actionsColumnSx={actionsColumnSx}
        />
      )}

      {!pickupMode && hasChildren && isExpanded && (childrenTasks || []).map((child, index) => (
        <ChildTaskRow
          key={child.id}
          task={child}
          sharedGroupParentTask={task}
          isLastInSharedGroup={index === childCount - 1}
          onOpenFile={onOpenFile}
          onShowCdrPreview={onShowCdrPreview}
          onStart={onStart}
          onPause={onPause}
          onResume={onResume}
          onComplete={onComplete}
          onSetStatus={onSetStatus}
          onTogglePriority={onTogglePriority}
          pendingLifecycleTaskId={pendingLifecycleTaskId}
          onEdit={onEdit}
          onDelete={onDelete}
          onCopyOrderLink={onCopyOrderLink}
          onPrintOrderLabel={onPrintOrderLabel}
          onOpenComment={onOpenComment}
          onOpenIntervals={onOpenIntervals}
          isAdmin={canEdit}
          canChangeStatus={canChangeStatus}
          currentUser={currentUser}
          highlightMyTasks={highlightMyTasks}
          selectedEmployeeForHighlight={selectedEmployeeForHighlight}
          showHoursTypeColumns={showHoursTypeColumns}
          columnVisibility={columnVisibility}
          textLimit={limit}
          showPlannedProgress={showPlannedProgress}
          cdrPreviewBuilding={isCdrPreviewBuilding(child.id)}
          maxSubscribed={maxSubscribedSet.has(child.id)}
          maxCanSubscribe={maxCanSubscribe}
          onMaxSubscribeToggle={onMaxSubscribeToggle}
          forceCommentTooltipTaskId={forceCommentTooltipTaskId}
          onForceCommentTooltipClose={onForceCommentTooltipClose}
          actionsColumnSx={actionsColumnSx}
        />
      ))}
    </Fragment>
  );
}

export default memo(ParentTaskRow, areParentRowPropsEqual);