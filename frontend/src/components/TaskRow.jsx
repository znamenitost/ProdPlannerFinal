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
  Comment as CommentIcon
} from '@mui/icons-material';

function truncate(str, maxLen) {
  if (!str) return '';
  return str.length > maxLen ? str.substring(0, maxLen) + '...' : str;
}

function getLastPathSegment(path) {
  if (!path) return '';
  const parts = path.split(/[\/\\]/).filter(p => p !== '');
  return parts.length > 0 ? parts[parts.length - 1] : '';
}

const getStatusColor = (status) => {
  if (status === 'Готово') return '#22c55e';
  if (status === 'Начал') return '#3b82f6';
  if (status === 'Пауза') return '#f59e0b';
  return '#64748b';
};

const getStatusIcon = (status) => {
  if (status === 'Готово') return <CheckCircle sx={{ fontSize: 16 }} />;
  if (status === 'Начал') return <PlayArrow sx={{ fontSize: 16 }} />;
  if (status === 'Пауза') return <Pause sx={{ fontSize: 16 }} />;
  return null;
};

const getParentStatus = (parent) => {
  if (!parent.children || parent.children.length === 0) return "Назначена";
  const allCompleted = parent.children.every(c => c.statusText === 'Готово');
  if (allCompleted) return "Готово";
  const anyStarted = parent.children.some(c => c.statusText === 'Начал' || c.statusText === 'Пауза');
  return anyStarted ? "Начал" : "Назначена";
};

// Получить список уникальных сотрудников из дочерних задач
const getUniqueEmployeesFromChildren = (children) => {
  if (!children || children.length === 0) return '';
  const employees = new Set();
  children.forEach(child => {
    if (child.employeeName) employees.add(child.employeeName);
  });
  return Array.from(employees).join('/');
};

const isOverdue = (deadline, status) => {
  if (status === 'Готово') return false;
  return new Date(deadline) < new Date();
};

export default function TaskRow({ 
  task, 
  isChild, 
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
  highlightMyTasks
}) {
  const overdue = isOverdue(task.deadline, task.statusText);
  const hasChildren = task.children && task.children.length > 0;

  let displayStatus = task.statusText;
  let displayStatusIcon = null;
  let displayStatusColor = '#64748b';

  if (hasChildren) {
    displayStatus = getParentStatus(task);
    displayStatusIcon = getStatusIcon(displayStatus);
    displayStatusColor = getStatusColor(displayStatus);
  } else {
    displayStatusIcon = getStatusIcon(displayStatus);
    displayStatusColor = getStatusColor(displayStatus);
  }

  // Для родительской задачи с детьми – строка сотрудников
  const employeeDisplay = hasChildren 
    ? getUniqueEmployeesFromChildren(task.children) 
    : task.employeeName;

  const isCurrentUserTask = () => {
    if (!currentUser) return false;
    if (!hasChildren) {
      return task.employeeName === currentUser.fullName && task.statusText !== 'Готово';
    }
    if (hasChildren && task.children?.length) {
      return task.children.some(child => 
        child.employeeName === currentUser.fullName && 
        child.statusText !== 'Готово'
      );
    }
    return false;
  };
  const isMine = isCurrentUserTask();

  const getRowStyle = () => {
    let style = {
      '&:hover': { bgcolor: '#f8fafc' },
      borderLeft: isChild ? '2px solid #e2e8f0' : 'none'
    };
    let bgColor = overdue && task.statusText !== 'Готово' ? '#fef2f2' : 'inherit';
    if (highlightMyTasks) {
      if (isMine) {
        bgColor = '#e6f7ff';
        style.boxShadow = 'inset 0 0 0 2px #1890ff';
        style.borderRadius = '4px';
      } else {
        style.opacity = '0.65';
        style['&:hover'] = { bgcolor: '#f8fafc', opacity: '0.85' };
      }
    }
    return { ...style, bgcolor: bgColor };
  };

  const fullFilePath = `${task.folderPath || ''}/${task.fileName || ''}`.replace(/\/\//g, '/');
  const shortFolderPath = getLastPathSegment(task.folderPath);

  // ------------------------------------------------------------
  // Дочерняя задача
  // ------------------------------------------------------------
  if (isChild) {
    return (
      <TableRow sx={getRowStyle()}>
        <TableCell sx={{ width: '3%' }} />
        <TableCell sx={{ width: '15%' }}>
          <Tooltip title={task.folderPath || ''} arrow>
            <Typography variant="body2" sx={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {truncate(shortFolderPath, 40)}
            </Typography>
          </Tooltip>
        </TableCell>
        <TableCell sx={{ width: '10%' }}>
          <Tooltip title={task.fileName || ''} arrow>
            <Typography variant="body2" sx={{ fontSize: '0.75rem', color: '#4b5563', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {truncate(task.fileName || '', 40)}
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
        <TableCell sx={{ width: '10%', display: 'none' }} />
        <TableCell align="center" sx={{ width: '6%' }}>
          <Typography variant="body2" sx={{ fontSize: '0.8rem', whiteSpace: 'nowrap' }}>
            {task.estimateHours.toFixed(1)} ч
          </Typography>
        </TableCell>
        <TableCell sx={{ width: '8%' }}>
          <Tooltip title={task.type} arrow>
            <Chip label={truncate(task.type, 20)} size="small" variant="outlined" sx={{ fontSize: '0.7rem', maxWidth: '100%' }} />
          </Tooltip>
        </TableCell>
        <TableCell sx={{ width: '8%' }}>
          <Chip icon={<Person sx={{ fontSize: 14 }} />} label={employeeDisplay} size="small" variant="outlined" sx={{ fontSize: '0.7rem', whiteSpace: 'nowrap' }} />
        </TableCell>
        <TableCell sx={{ width: '8%' }}>
          <Chip icon={displayStatusIcon} label={task.statusText || "Назначена"} size="small" sx={{ bgcolor: displayStatusColor, color: 'white', fontSize: '0.7rem', whiteSpace: 'nowrap' }} />
        </TableCell>
        <TableCell sx={{ width: canChangeStatus ? '12%' : '10%' }}>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'nowrap', alignItems: 'center' }}>
            {canChangeStatus && (
              <>
                {task.statusText !== 'Готово' && task.statusText !== 'Начал' && task.statusText !== 'Пауза' && (
                  <Tooltip title="Начать"><IconButton size="small" onClick={() => onStart(task)} sx={{ color: '#22c55e' }}><PlayArrow fontSize="small" /></IconButton></Tooltip>
                )}
                {task.statusText === 'Начал' && (
                  <>
                    <Tooltip title="Пауза"><IconButton size="small" onClick={() => onPause(task)} sx={{ color: '#f59e0b' }}><Pause fontSize="small" /></IconButton></Tooltip>
                    <Tooltip title="Завершить"><IconButton size="small" onClick={() => onComplete(task)} sx={{ color: '#22c55e' }}><CheckCircle fontSize="small" /></IconButton></Tooltip>
                  </>
                )}
                {task.statusText === 'Пауза' && (
                  <>
                    <Tooltip title="Продолжить"><IconButton size="small" onClick={() => onResume(task)} sx={{ color: '#22c55e' }}><PlayArrow fontSize="small" /></IconButton></Tooltip>
                    <Tooltip title="Завершить"><IconButton size="small" onClick={() => onComplete(task)} sx={{ color: '#22c55e' }}><CheckCircle fontSize="small" /></IconButton></Tooltip>
                  </>
                )}
              </>
            )}
          </Box>
        </TableCell>
      </TableRow>
    );
  }

  // ------------------------------------------------------------
  // Родительская задача
  // ------------------------------------------------------------
  return (
    <Fragment>
      <TableRow sx={getRowStyle()}>
        <TableCell sx={{ width: '3%' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'nowrap' }}>
            {hasChildren && (
              <IconButton size="small" onClick={() => onToggleExpand(task.id)}>
                {isExpanded ? <ExpandMore fontSize="small" /> : <ChevronRight fontSize="small" />}
              </IconButton>
            )}
            {!hasChildren && !isChild && <Box sx={{ width: 28 }} />}
            {!isChild && (
              <Tooltip title={`Открыть файл: ${fullFilePath}`} arrow>
                <IconButton size="small" onClick={() => onOpenFile(task)} sx={{ color: '#7c9ebf' }}>
                  <FolderOpen fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
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
            {task.estimateHours.toFixed(1)} ч
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
            {/* Кнопка разделения только для задач без детей */}
            {canSplit && !hasChildren && task.statusText !== 'Готово' && (
              <Tooltip title="Разделить задачу">
                <IconButton size="small" onClick={() => onSplit(task)} sx={{ color: '#8b5cf6' }}>
                  <CallSplit fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {/* Кнопка редактирования */}
            {canEdit && (
              <Tooltip title="Редактировать">
                <IconButton size="small" onClick={() => onEdit(task)}>
                  <Edit fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {/* Кнопка удаления */}
            {canDelete && (
              <Tooltip title="Удалить">
                <IconButton size="small" color="error" onClick={() => onDelete(task.id)}>
                  <Delete fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            {/* Кнопки статуса только для задач без детей */}
            {canChangeStatus && !hasChildren && (
              <>
                {task.statusText !== 'Готово' && task.statusText !== 'Начал' && task.statusText !== 'Пауза' && (
                  <Tooltip title="Начать"><IconButton size="small" onClick={() => onStart(task)} sx={{ color: '#22c55e' }}><PlayArrow fontSize="small" /></IconButton></Tooltip>
                )}
                {task.statusText === 'Начал' && (
                  <>
                    <Tooltip title="Пауза"><IconButton size="small" onClick={() => onPause(task)} sx={{ color: '#f59e0b' }}><Pause fontSize="small" /></IconButton></Tooltip>
                    <Tooltip title="Завершить"><IconButton size="small" onClick={() => onComplete(task)} sx={{ color: '#22c55e' }}><CheckCircle fontSize="small" /></IconButton></Tooltip>
                  </>
                )}
                {task.statusText === 'Пауза' && (
                  <>
                    <Tooltip title="Продолжить"><IconButton size="small" onClick={() => onResume(task)} sx={{ color: '#22c55e' }}><PlayArrow fontSize="small" /></IconButton></Tooltip>
                    <Tooltip title="Завершить"><IconButton size="small" onClick={() => onComplete(task)} sx={{ color: '#22c55e' }}><CheckCircle fontSize="small" /></IconButton></Tooltip>
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
                  {task.children.map(child => (
                    <TaskRow
                      key={child.id}
                      task={child}
                      isChild={true}
                      isExpanded={false}
                      onToggleExpand={onToggleExpand}
                      onOpenFile={onOpenFile}
                      onStart={onStart}
                      onPause={onPause}
                      onResume={onResume}
                      onComplete={onComplete}
                      onEdit={onEdit}
                      onDelete={onDelete}
                      onSplit={onSplit}
                      onOpenComment={onOpenComment}
                      canEdit={canEdit}
                      canDelete={canDelete}
                      canSplit={canSplit}
                      canChangeStatus={canChangeStatus}
                      currentUser={currentUser}
                      highlightMyTasks={highlightMyTasks}
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