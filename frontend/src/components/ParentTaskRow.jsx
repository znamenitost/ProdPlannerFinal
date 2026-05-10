import { Fragment } from 'react';
import {
  TableRow,
  TableCell,
  Box,
  IconButton,
  Tooltip,
  Typography,
  Chip,
  Collapse
} from '@mui/material';
import {
  PlayArrow,
  Pause,
  CheckCircle,
  Edit,
  Delete,
  FolderOpen,
  ExpandMore,
  ChevronRight,
  CallSplit,
  Person,
  Comment as CommentIcon,
  PeopleAlt    // <-- добавлено для индикатора общей задачи
} from '@mui/icons-material';
import {
  truncate,
  getStatusColor,
  getStatusIcon,
  getUniqueEmployeesFromChildren,
  isOverdue,
  getLastPathSegment
} from '../utils/taskHelpers';
import ChildTaskRow from './ChildTaskRow';

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
  onEdit,
  onDelete,
  onSplit,
  onOpenComment,
  canEdit,
  canDelete,
  canSplit,
  canChangeStatus,
  currentUser,
  highlightMyTasks,
  selectedEmployeeForHighlight
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

  const employeeDisplay = (hasChildren && childrenTasks && childrenTasks.length > 0)
    ? getUniqueEmployeesFromChildren(childrenTasks)
    : task.employeeName;

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
        <TableCell sx={{ width: '3%' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'nowrap' }}>
            {hasChildren && (
              <IconButton size="small" onClick={() => onToggleExpand(task.id)}>
                {isExpanded ? <ExpandMore fontSize="small" /> : <ChevronRight fontSize="small" />}
              </IconButton>
            )}
            {!hasChildren && <Box sx={{ width: 28 }} />}
            
            {/* Индикатор: общая задача (сплит) */}
            {task.isSplitTask && (
              <Tooltip title="Общая задача (разделена между сотрудниками)" arrow>
                <PeopleAlt fontSize="small" sx={{ color: '#8b5cf6' }} />
              </Tooltip>
            )}
            
            <Tooltip title={`Открыть файл: ${fullFilePath}`} arrow>
              <IconButton size="small" onClick={() => onOpenFile(task)} sx={{ color: '#7c9ebf' }}>
                <FolderOpen fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
        </TableCell>

        <TableCell sx={{ width: '15%' }}>
          <Tooltip title={task.folderPath || ''} arrow>
            <Typography variant="body2" sx={{ fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {truncate(shortFolderPath, 50)}
            </Typography>
          </Tooltip>
        </TableCell>

        <TableCell sx={{ width: '10%' }}>
          <Tooltip title={task.fileName || ''} arrow>
            <Typography variant="body2" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {truncate(task.fileName || '', 50)}
            </Typography>
          </Tooltip>
        </TableCell>

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

        <TableCell sx={{ width: '10%' }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <Typography variant="body2" sx={{ color: overdue ? '#dc2626' : 'inherit', fontSize: '0.75rem', whiteSpace: 'nowrap' }}>
              {new Date(task.deadline).toLocaleDateString()}
            </Typography>
            <Typography variant="caption" sx={{ color: overdue ? '#dc2626' : 'text.secondary', fontSize: '0.7rem', whiteSpace: 'nowrap' }}>
              {new Date(task.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Typography>
          </Box>
        </TableCell>

        <TableCell align="center" sx={{ width: '6%' }}>
          <Typography variant="body2" sx={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
            {task.estimateHours?.toFixed(1) || '0.0'} ч
          </Typography>
        </TableCell>

        <TableCell sx={{ width: '8%' }}>
          <Tooltip title={task.type} arrow>
            <Chip label={truncate(task.type, 20)} size="small" variant="outlined" sx={{ fontSize: '0.7rem', maxWidth: '100%' }} />
          </Tooltip>
        </TableCell>

        <TableCell sx={{ width: '8%' }}>
          <Chip icon={<Person sx={{ fontSize: 14 }} />} label={employeeDisplay} size="small" variant="outlined" sx={{ fontSize: '0.7rem', whiteSpace: 'nowrap', maxWidth: '100%' }} />
        </TableCell>

        <TableCell sx={{ width: '8%' }}>
          {hasChildren ? (
            <Chip icon={displayStatusIcon} label={displayStatus} size="small" sx={{ bgcolor: displayStatusColor, color: 'white', fontSize: '0.7rem', whiteSpace: 'nowrap' }} />
          ) : (
            <Chip icon={displayStatusIcon} label={task.statusText || "Назначена"} size="small" sx={{ bgcolor: displayStatusColor, color: 'white', fontSize: '0.7rem', whiteSpace: 'nowrap' }} />
          )}
        </TableCell>

        <TableCell sx={{ width: (canEdit || canDelete || canSplit) ? '12%' : '10%' }}>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'nowrap', alignItems: 'center' }}>
            {canSplit && !hasChildren && task.statusText !== 'Готово' && (
              <Tooltip title="Разделить задачу">
                <IconButton size="small" onClick={() => onSplit(task)} sx={{ color: '#8b5cf6' }}>
                  <CallSplit fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {canEdit && (
              <Tooltip title="Редактировать">
                <IconButton size="small" onClick={() => onEdit(task)}>
                  <Edit fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {canDelete && (
              <Tooltip title="Удалить">
                <IconButton size="small" color="error" onClick={() => onDelete(task.id)}>
                  <Delete fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {showActionButtons && (
              <>
                {task.statusText !== 'Готово' && task.statusText !== 'Начал' && task.statusText !== 'Пауза' && (
                  <Tooltip title="Начать">
                    <IconButton size="small" onClick={() => onStart(task)} sx={{ color: '#22c55e' }}>
                      <PlayArrow fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
                {task.statusText === 'Начал' && (
                  <>
                    <Tooltip title="Пауза">
                      <IconButton size="small" onClick={() => onPause(task)} sx={{ color: '#f59e0b' }}>
                        <Pause fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Завершить">
                      <IconButton size="small" onClick={() => onComplete(task)} sx={{ color: '#22c55e' }}>
                        <CheckCircle fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </>
                )}
                {task.statusText === 'Пауза' && (
                  <>
                    <Tooltip title="Продолжить">
                      <IconButton size="small" onClick={() => onResume(task)} sx={{ color: '#22c55e' }}>
                        <PlayArrow fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Завершить">
                      <IconButton size="small" onClick={() => onComplete(task)} sx={{ color: '#22c55e' }}>
                        <CheckCircle fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </>
                )}
              </>
            )}
          </Box>
        </TableCell>
      </TableRow>

      {hasChildren && isExpanded && (
        <TableRow>
          <TableCell colSpan={10} sx={{ p: 0 }}>
            <Collapse in={isExpanded} timeout="auto" unmountOnExit>
              <table style={{ width: '100%', paddingLeft: '48px' }}>
                <tbody>
                  {(childrenTasks || []).map(child => (
                    <ChildTaskRow
                      key={child.id}
                      task={child}
                      onOpenFile={onOpenFile}
                      onStart={onStart}
                      onPause={onPause}
                      onResume={onResume}
                      onComplete={onComplete}
                      onOpenComment={onOpenComment}
                      canChangeStatus={canChangeStatus}
                      currentUser={currentUser}
                      highlightMyTasks={highlightMyTasks}
                      selectedEmployeeForHighlight={selectedEmployeeForHighlight}
                    />
                  ))}
                </tbody>
              </table>
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </Fragment>
  );
}