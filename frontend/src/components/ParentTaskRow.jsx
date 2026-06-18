import { Fragment, memo } from 'react';
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
import ThroughApprovalChip from './taskTable/ThroughApprovalChip';
import ChildTaskRow from './ChildTaskRow';
import TaskAdminActionStacks from './TaskAdminActionStacks';
import EmployeeStatusButtons from './EmployeeStatusButtons';
import LazyTooltip from './common/LazyTooltip';
import TaskPlannedProgressFooter from './taskTable/TaskPlannedProgressFooter';
import TaskFileNameCell from './taskTable/TaskFileNameCell';
import { taskTableColumnCount } from '../utils/taskTableColumns';
import { columnCellSx, hoursColumnSx, typeColumnSx } from '../utils/taskTableColumns';
import { alpha } from '@mui/material/styles';
import { highlightedTaskRowSx, overdueTaskRowSx } from '../theme/surfaces';
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

function ParentTaskRow({
  task,
  childrenTasks,
  isExpanded,
  onToggleExpand,
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
  canEdit,
  canDelete,
  canChangeStatus,
  currentUser,
  highlightMyTasks,
  selectedEmployeeForHighlight,
  showHoursTypeColumns = true,
  columnVisibility,
  textLimit: limit = 23,
  showPlannedProgress = false
}) {
  const hasChildren = task.isSplitTask || (childrenTasks && childrenTasks.length > 0);
  const lifecycleBusy = pendingLifecycleTaskId != null;

  const displayStatus = task.statusText || 'Назначена';

  // ========== ПОДСВЕТКА ДЛЯ АДМИНИСТРАТОРА И СОТРУДНИКА ==========
  let isMine = false;

  if (highlightMyTasks) {
    if (currentUser?.role === 'Admin' && selectedEmployeeForHighlight) {
      if (hasChildren) {
        isMine = !isExpanded && task.hasCurrentUserSubtask === true;
      } else {
        isMine = task.employeeName === selectedEmployeeForHighlight && task.statusText !== 'Готово';
      }
    }
    else if (currentUser?.role !== 'Admin') {
      if (hasChildren) {
        isMine = !isExpanded && task.hasCurrentUserSubtask === true;
      } else {
        isMine = task.employeeName === currentUser?.fullName && task.statusText !== 'Готово';
      }
    }
  }

  const employeeDisplay = getParentEmployeeDisplay(task, childrenTasks);

  const fullFilePath = `${task.folderPath || ''}/${task.fileName || ''}`.replace(/\/\//g, '/');
  const shortFolderPath = getLastPathSegment(task.folderPath);
  const cdrPreviewRowHandlers = getCdrPreviewRowHandlers({
    task,
    onShowCdrPreview,
  });

  const canUserManage = () => {
    if (!currentUser) return false;
    if (currentUser.role === 'Admin') return true;
    if (!hasChildren) {
      return task.employeeName === currentUser.fullName && task.statusText !== 'Готово';
    }
    return false;
  };

  const childCount = childrenTasks?.length ?? 0;
  const showSharedGroupStripe = hasChildren && isExpanded;
  const sharedGroupExpanded = showSharedGroupStripe && childCount > 0;

  const getRowStyle = (theme) => {
    const overdue =
      task.deadline && task.statusText !== 'Готово' && new Date(task.deadline) < new Date();
    const base = {
      borderLeft: 'none',
      '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) }
    };
    let style = base;
    if (highlightMyTasks && isMine) {
      style = { ...base, ...highlightedTaskRowSx(theme) };
    } else if (highlightMyTasks && !isMine) {
      style = {
        ...base,
        opacity: 0.65,
        '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04), opacity: 0.85 }
      };
    } else if (overdue) {
      style = { ...base, ...overdueTaskRowSx(theme) };
    }

    if (showSharedGroupStripe) {
      style = {
        ...style,
        ...getSharedGroupStripeRowSx(theme, task, {
          isFirst: true,
          isLast: !sharedGroupExpanded
        })
      };
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
        {/* Первая ячейка: управление раскрытием + индикатор сплит-задачи + кнопка открытия файла */}
        <TableCell sx={COL_ICON}>
          <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'nowrap', width: '100%' }}>
            <Box sx={ICON_SLOT_EXPAND}>
              {hasChildren ? (
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
              <LazyTooltip title={`Открыть файл: ${fullFilePath}`} arrow>
                <IconButton
                  size="small"
                  color="primary"
                  onClick={() => onOpenFile(task)}
                  aria-label={`Открыть файл: ${fullFilePath}`}
                  sx={{ p: 0.5 }}
                >
                  <FolderOpen fontSize="small" />
                </IconButton>
              </LazyTooltip>
            </Box>
          </Box>
        </TableCell>

        <TableCell sx={columnCellSx('task', columnVisibility, showHoursTypeColumns, COL_TASK)}>
          {needsTooltip(shortFolderPath || task.folderPath, limit) ? (
            <LazyTooltip title={task.folderPath || ''} arrow>
              <Typography variant="body2" sx={{ fontWeight: 600, ...cellDisplayTextSx }}>
                {truncateText(shortFolderPath || task.folderPath, limit)}
              </Typography>
            </LazyTooltip>
          ) : (
            <Typography variant="body2" sx={{ fontWeight: 600, ...cellDisplayTextSx }}>
              {shortFolderPath || task.folderPath || '—'}
            </Typography>
          )}
        </TableCell>

        <TableCell sx={columnCellSx('file', columnVisibility, showHoursTypeColumns, COL_FILE)}>
          <TaskFileNameCell fileName={task.fileName} task={task} textLimit={limit} />
        </TableCell>

        <TableCell sx={columnCellSx('comment', columnVisibility, showHoursTypeColumns, COL_COMMENT)}>
          <TaskCommentCell task={task} onOpenComment={onOpenComment} />
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
          <Chip icon={<Person sx={{ fontSize: 14 }} />} label={employeeDisplay} size="small" variant="outlined" sx={{ fontSize: '0.75rem', whiteSpace: 'nowrap', height: 'auto', '& .MuiChip-label': { whiteSpace: 'nowrap' } }} />
        </TableCell>

        <TableCell sx={columnCellSx('status', columnVisibility, showHoursTypeColumns, COL_STATUS)}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'nowrap' }}>
            <TaskStatusCell
              statusText={task.statusText}
              label={hasChildren ? displayStatus : undefined}
            />
            <ThroughApprovalChip task={task} childrenTasks={childrenTasks} />
          </Box>
        </TableCell>

        <TableCell sx={columnCellSx('actions', columnVisibility, showHoursTypeColumns, COL_ACTIONS)}>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-start' }}>
            {canEdit && canDelete && (
              <TaskAdminActionStacks
                task={task}
                pending={pendingLifecycleTaskId === task.id}
                lifecycleBusy={lifecycleBusy}
                onEdit={() => onEdit(task.id)}
                onDelete={() => onDelete(task.id)}
                onIntervals={hasChildren ? undefined : () => onOpenIntervals(task)}
                onStart={onStart}
                onPause={onPause}
                onResume={onResume}
                onComplete={onComplete}
                onSetStatus={hasChildren ? null : onSetStatus}
                showWorkflow={!hasChildren}
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
        color={hasChildren ? 'primary' : 'success'}
      />

      {hasChildren && isExpanded && (childrenTasks || []).map((child, index) => (
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
          pendingLifecycleTaskId={pendingLifecycleTaskId}
          onEdit={onEdit}
          onDelete={onDelete}
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
        />
      ))}
    </Fragment>
  );
}

export default memo(ParentTaskRow, areParentRowPropsEqual);