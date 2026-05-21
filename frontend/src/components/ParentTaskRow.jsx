import { Fragment, memo } from 'react';
import { areParentRowPropsEqual } from '../utils/taskTableRowMemo';
import {
  TableRow,
  TableCell,
  Box,
  IconButton,
  Tooltip,
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
import TaskAdminActionsMenu from './TaskAdminActionsMenu';
import EmployeeStatusButtons from './EmployeeStatusButtons';
import { hoursColumnSx, typeColumnSx } from '../utils/taskTableColumns';
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
  cellDisplayTextSx
} from '../utils/taskTableStyles';

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
  pendingLifecycleTaskId = null,
  onEdit,
  onDelete,
  onOpenComment,
  canEdit,
  canDelete,
  canChangeStatus,
  currentUser,
  highlightMyTasks,
  selectedEmployeeForHighlight,
  showHoursTypeColumns = true
}) {
  const hasChildren = task.isSplitTask || (childrenTasks && childrenTasks.length > 0);

  const displayStatus = task.statusText || 'Назначена';

  // ========== ПОДСВЕТКА ДЛЯ АДМИНИСТРАТОРА И СОТРУДНИКА ==========
  let isMine = false;

  if (highlightMyTasks) {
    if (currentUser?.role === 'Admin' && selectedEmployeeForHighlight) {
      if (hasChildren) {
        isMine = task.hasCurrentUserSubtask === true;
      } else {
        isMine = task.employeeName === selectedEmployeeForHighlight && task.statusText !== 'Готово';
      }
    }
    else if (currentUser?.role !== 'Admin') {
      if (hasChildren) {
        isMine = task.hasCurrentUserSubtask === true;
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

  const getRowStyle = () => {
    let style = {
      '&:hover': { bgcolor: '#f8fafc' },
      borderLeft: 'none'
    };
    const overdue = task.deadline && task.statusText !== 'Готово' && new Date(task.deadline) < new Date();
    let bgColor = overdue ? '#fef2f2' : 'inherit';
    if (highlightMyTasks && isMine) {
      bgColor = '#e6f7ff';
      style.boxShadow = 'inset 0 0 0 2px #1890ff';
      style.borderRadius = '4px';
    } else if (highlightMyTasks && !isMine) {
      style.opacity = '0.65';
      style['&:hover'] = { bgcolor: '#f8fafc', opacity: '0.85' };
    }
    return { ...style, bgcolor: bgColor };
  };

  const showActionButtons = canUserManage() && canChangeStatus && !hasChildren;

  return (
    <Fragment>
      <TableRow sx={getRowStyle()}>
        {/* Первая ячейка: управление раскрытием + индикатор сплит-задачи + кнопка открытия файла */}
        <TableCell sx={COL_ICON}>
          <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'nowrap', width: '100%' }}>
            <Box sx={ICON_SLOT_EXPAND}>
              {hasChildren ? (
                <IconButton size="small" onClick={() => onToggleExpand(task.id)} sx={{ p: 0.5 }}>
                  {isExpanded ? <ExpandMore fontSize="small" /> : <ChevronRight fontSize="small" />}
                </IconButton>
              ) : null}
            </Box>

            {task.isSplitTask && (
              <Box sx={ICON_SLOT_GROUPS}>
                <Tooltip title="Общая задача" arrow>
                  <Groups fontSize="small" sx={{ color: '#6366f1' }} />
                </Tooltip>
              </Box>
            )}

            <Box sx={ICON_SLOT_FILE}>
              <Tooltip title={`Открыть файл: ${fullFilePath}`} arrow>
                <IconButton size="small" onClick={() => onOpenFile(task)} sx={{ color: '#7c9ebf', p: 0.5 }}>
                  <FolderOpen fontSize="small" />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
        </TableCell>

        <TableCell sx={COL_TASK}>
          <Tooltip title={task.folderPath || ''} arrow>
            <Typography variant="body2" sx={{ fontWeight: 600, ...cellDisplayTextSx }}>
              {shortFolderPath || task.folderPath || '—'}
            </Typography>
          </Tooltip>
        </TableCell>

        <TableCell sx={COL_FILE}>
          <Tooltip title={task.fileName || ''} arrow>
            <Typography variant="body2" sx={cellDisplayTextSx}>
              {task.fileName || '—'}
            </Typography>
          </Tooltip>
        </TableCell>

        <TableCell sx={COL_COMMENT}>
          <TaskCommentCell task={task} onOpenComment={onOpenComment} />
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
          <Chip icon={<Person sx={{ fontSize: 14 }} />} label={employeeDisplay} size="small" variant="outlined" sx={{ fontSize: '0.75rem', whiteSpace: 'nowrap', height: 'auto', '& .MuiChip-label': { whiteSpace: 'nowrap' } }} />
        </TableCell>

        <TableCell sx={COL_STATUS}>
          <TaskStatusCell
            statusText={task.statusText}
            label={hasChildren ? displayStatus : undefined}
          />
        </TableCell>

        <TableCell sx={COL_ACTIONS}>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'nowrap', alignItems: 'center', justifyContent: 'flex-start' }}>
            {canEdit && canDelete && (
              <TaskAdminActionsMenu
                onEdit={() => onEdit(task.id)}
                onDelete={() => onDelete(task.id)}
              />
            )}
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
          </Box>
        </TableCell>
      </TableRow>

      {hasChildren && isExpanded && (childrenTasks || []).map((child) => (
        <ChildTaskRow
          key={child.id}
          task={child}
          onOpenFile={onOpenFile}
          onStart={onStart}
          onPause={onPause}
          onResume={onResume}
          onComplete={onComplete}
          pendingLifecycleTaskId={pendingLifecycleTaskId}
          onOpenComment={onOpenComment}
          canChangeStatus={canChangeStatus}
          currentUser={currentUser}
          highlightMyTasks={highlightMyTasks}
          selectedEmployeeForHighlight={selectedEmployeeForHighlight}
          showHoursTypeColumns={showHoursTypeColumns}
        />
      ))}
    </Fragment>
  );
}

export default memo(ParentTaskRow, areParentRowPropsEqual);