import { Fragment, memo } from 'react';
import { areParentRowPropsEqual } from '../utils/taskTableRowMemo';
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
import ChildTaskRow from './ChildTaskRow';
import TaskAdminActionStacks from './TaskAdminActionStacks';
import EmployeeStatusButtons from './EmployeeStatusButtons';
import LazyTooltip from './common/LazyTooltip';
import TaskPlannedProgressFooter from './taskTable/TaskPlannedProgressFooter';
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

function ParentTaskRow({
  task,
  childrenTasks,
  isExpanded,
  onToggleExpand,
  onOpenFile,
  onStart,
  onPause,
  onResume,
  onComplete,
  onSetStatus,
  pendingLifecycleTaskId = null,
  lifecycleBusy = false,
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
  textLimit: limit = 23
}) {
  const hasChildren = task.isSplitTask || (childrenTasks && childrenTasks.length > 0);

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

  const canUserManage = () => {
    if (!currentUser) return false;
    if (currentUser.role === 'Admin') return true;
    if (!hasChildren) {
      return task.employeeName === currentUser.fullName && task.statusText !== 'Готово';
    }
    return false;
  };

  const getRowStyle = (theme) => {
    const overdue =
      task.deadline && task.statusText !== 'Готово' && new Date(task.deadline) < new Date();
    const base = {
      borderLeft: 'none',
      '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04) }
    };
    if (highlightMyTasks && isMine) {
      return { ...base, ...highlightedTaskRowSx(theme) };
    }
    if (highlightMyTasks && !isMine) {
      return {
        ...base,
        opacity: 0.65,
        '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.04), opacity: 0.85 }
      };
    }
    if (overdue) {
      return { ...base, ...overdueTaskRowSx(theme) };
    }
    return base;
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
      <TableRow sx={(theme) => getRowStyle(theme)}>
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

            {task.isSplitTask && (
              <Box sx={ICON_SLOT_GROUPS}>
                <Groups fontSize="small" sx={sharedTaskIconSx} />
              </Box>
            )}

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
          {needsTooltip(task.fileName, limit) ? (
            <LazyTooltip title={task.fileName} arrow>
              <Typography variant="body2" sx={cellDisplayTextSx}>
                {truncateText(task.fileName, limit)}
              </Typography>
            </LazyTooltip>
          ) : (
            <Typography variant="body2" sx={cellDisplayTextSx}>
              {task.fileName || '—'}
            </Typography>
          )}
        </TableCell>

        <TableCell sx={columnCellSx('comment', columnVisibility, showHoursTypeColumns, COL_COMMENT)}>
          <TaskCommentCell task={task} onOpenComment={onOpenComment} />
        </TableCell>

        <TableCell sx={columnCellSx('deadline', columnVisibility, showHoursTypeColumns, COL_DEADLINE)}>
          <TaskDeadlineCell deadline={task.deadline} statusText={task.statusText} />
        </TableCell>

        <TableCell align="center" sx={hoursColumnSx(columnVisibility, showHoursTypeColumns)}>
          <TaskHoursCell estimateHours={task.estimateHours} />
        </TableCell>

        <TableCell sx={typeColumnSx(columnVisibility, showHoursTypeColumns)}>
          <TaskTypeCell type={task.type} />
        </TableCell>

        <TableCell sx={columnCellSx('employee', columnVisibility, showHoursTypeColumns, COL_EMPLOYEE)}>
          <Chip icon={<Person sx={{ fontSize: 14 }} />} label={employeeDisplay} size="small" variant="outlined" sx={{ fontSize: '0.75rem', whiteSpace: 'nowrap', height: 'auto', '& .MuiChip-label': { whiteSpace: 'nowrap' } }} />
        </TableCell>

        <TableCell sx={columnCellSx('status', columnVisibility, showHoursTypeColumns, COL_STATUS)}>
          <TaskStatusCell
            statusText={task.statusText}
            label={hasChildren ? displayStatus : undefined}
          />
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
                onIntervals={() => onOpenIntervals(task)}
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
        hideForSplitParent={hasChildren}
      />

      {hasChildren && isExpanded && (childrenTasks || []).map((child) => (
        <ChildTaskRow
          key={child.id}
          task={child}
          onOpenFile={onOpenFile}
          onStart={onStart}
          onPause={onPause}
          onResume={onResume}
          onComplete={onComplete}
          onSetStatus={onSetStatus}
          pendingLifecycleTaskId={pendingLifecycleTaskId}
          lifecycleBusy={lifecycleBusy}
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
        />
      ))}
    </Fragment>
  );
}

export default memo(ParentTaskRow, areParentRowPropsEqual);