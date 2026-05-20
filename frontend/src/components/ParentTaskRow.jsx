import { Fragment } from 'react';
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
  Comment as CommentIcon
} from '@mui/icons-material';
import {
  getStatusColor,
  getStatusIcon,
  getParentEmployeeDisplay,
  isOverdue,
  getLastPathSegment
} from '../utils/taskHelpers';
import ChildTaskRow from './ChildTaskRow';
import TaskAdminActionsMenu from './TaskAdminActionsMenu';
import EmployeeStatusButtons from './EmployeeStatusButtons';
import { hoursColumnSx, typeColumnSx } from '../utils/taskTableColumns';
import {
  COL_ICON,
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

export default function ParentTaskRow({
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
  const overdue = isOverdue(task.deadline, task.statusText);
  const hasChildren = task.isSplitTask || (childrenTasks && childrenTasks.length > 0);

  let displayStatus = task.statusText || "Назначена";
  let displayStatusIcon = getStatusIcon(displayStatus);
  let displayStatusColor = getStatusColor(displayStatus);

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
    let bgColor = overdue && task.statusText !== 'Готово' ? '#fef2f2' : 'inherit';
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'nowrap' }}>
            {hasChildren && (
              <IconButton size="small" onClick={() => onToggleExpand(task.id)}>
                {isExpanded ? <ExpandMore fontSize="small" /> : <ChevronRight fontSize="small" />}
              </IconButton>
            )}
            {!hasChildren && <Box sx={{ width: 28 }} />}

            <Tooltip title={`Открыть файл: ${fullFilePath}`} arrow>
              <IconButton size="small" onClick={() => onOpenFile(task)} sx={{ color: '#7c9ebf' }}>
                <FolderOpen fontSize="small" />
              </IconButton>
            </Tooltip>
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
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'nowrap' }}>
            <Tooltip title={task.comment || 'Нет комментария'} arrow placement="top"
              slotProps={{ tooltip: { sx: { bgcolor: '#1e293b', fontSize: '12px', padding: '8px 15px', maxWidth: '400px', borderRadius: 2 } } }}
            >
              <Typography variant="body2" sx={{ color: 'text.secondary', ...commentDisplaySx, cursor: 'default' }}>
                {formatCommentForDisplay(task.comment)}
              </Typography>
            </Tooltip>
            <IconButton size="small" onClick={() => onOpenComment(task)} sx={{ p: 0.5, flexShrink: 0 }}>
              <CommentIcon fontSize="small" sx={{ fontSize: 14, color: '#7c9ebf' }} />
            </IconButton>
          </Box>
        </TableCell>

        <TableCell sx={COL_DEADLINE}>
          <Typography variant="body2" sx={{ color: overdue ? '#dc2626' : 'inherit', ...cellDisplayTextSx }}>
            {new Date(task.deadline).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })}
            {' '}
            {new Date(task.deadline).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
          </Typography>
        </TableCell>

        <TableCell align="center" sx={hoursColumnSx(showHoursTypeColumns)}>
          <Typography variant="body2" sx={cellDisplayTextSx}>
            {task.estimateHours?.toFixed(1) || '0.0'} ч
          </Typography>
        </TableCell>

        <TableCell sx={typeColumnSx(showHoursTypeColumns)}>
          <Tooltip title={task.type} arrow>
            <Chip label={task.type || '—'} size="small" variant="outlined" sx={{ fontSize: '0.75rem', whiteSpace: 'nowrap', height: 'auto', '& .MuiChip-label': { whiteSpace: 'nowrap' } }} />
          </Tooltip>
        </TableCell>

        <TableCell sx={COL_EMPLOYEE}>
          <Chip icon={<Person sx={{ fontSize: 14 }} />} label={employeeDisplay} size="small" variant="outlined" sx={{ fontSize: '0.75rem', whiteSpace: 'nowrap', height: 'auto', '& .MuiChip-label': { whiteSpace: 'nowrap' } }} />
        </TableCell>

        <TableCell sx={COL_STATUS}>
          {hasChildren ? (
            <Chip icon={displayStatusIcon} label={displayStatus} size="small" sx={{ bgcolor: displayStatusColor, color: 'white', fontSize: '0.7rem', whiteSpace: 'nowrap' }} />
          ) : (
            <Chip icon={displayStatusIcon} label={task.statusText || "Назначена"} size="small" sx={{ bgcolor: displayStatusColor, color: 'white', fontSize: '0.7rem', whiteSpace: 'nowrap' }} />
          )}
        </TableCell>

        <TableCell sx={COL_ACTIONS}>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'nowrap', alignItems: 'center', justifyContent: 'flex-start' }}>
            {canEdit && canDelete && (
              <TaskAdminActionsMenu
                onEdit={() => onEdit(task)}
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