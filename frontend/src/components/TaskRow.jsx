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

const getShortName = (fullPath, isChild = false) => {
  if (!fullPath) return '';
  const parts = fullPath.split(/[\/\\]/).filter(p => p !== '');
  if (parts.length === 0) return '';
  if (isChild) {
    return parts[parts.length - 1];
  }
  const lastLevels = parts.slice(-2);
  let result = lastLevels.join('/');
  if (result.length > 40) {
    return '...' + result.substring(result.length - 37);
  }
  return result;
};

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

const getUniqueEmployees = (children) => {
  const uniqueEmployees = new Set();
  children.forEach(child => {
    if (child.employeeName) {
      uniqueEmployees.add(child.employeeName);
    }
  });
  return Array.from(uniqueEmployees);
};

const getParentStatus = (parent) => {
  if (!parent.children || parent.children.length === 0) return "Назначена";
  const allCompleted = parent.children.every(c => c.statusText === 'Готово');
  if (allCompleted) return "Готово";
  const anyStarted = parent.children.some(c => c.statusText === 'Начал' || c.statusText === 'Пауза');
  return anyStarted ? "Начал" : "Назначена";
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

  const isCurrentUserTask = () => {
    if (!currentUser) return false;
    
    // Обычная задача (не родительская)
    if (!hasChildren) {
      // Подсвечиваем только если задача НЕ завершена
      return task.employeeName === currentUser.fullName && task.statusText !== 'Готово';
    }
    
    // Родительская задача: проверяем наличие НЕзавершённых дочерних задач текущего сотрудника
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

  // Для дочерних задач показываем только важные колонки
  if (isChild) {
    return (
      <TableRow sx={getRowStyle()}>
        {/* Пустая ячейка для отступа (вместо иконок) */}
        <TableCell sx={{ width: 60 }} />
        
        {/* Название задачи (с отступом) */}
        <TableCell>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pl: 4 }}>
            <Tooltip title={task.fileName} arrow>
              <Typography variant="body2">{task.fileName}</Typography>
            </Tooltip>
          </Box>
        </TableCell>
        
        {/* Файл – скрыт для дочерних */}
        <TableCell sx={{ display: 'none' }} />
        
        {/* Комментарий */}
        <TableCell>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Tooltip 
              title={task.comment || 'Нет комментария'} 
              arrow 
              placement="top"
              slotProps={{
                tooltip: {
                  sx: {
                    bgcolor: '#1e293b',
                    fontSize: '12px',
                    padding: '8px 15px',
                    maxWidth: '400px',
                    borderRadius: 2,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                  }
                }
              }}
            >
              <Typography 
                variant="body2" 
                sx={{ 
                  color: 'text.secondary', 
                  fontSize: '0.8rem',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: '200px',
                  cursor: 'default'
                }}
              >
                {task.comment && task.comment.length > 30 
                  ? `${task.comment.slice(0, 30)}...` 
                  : (task.comment || '—')}
              </Typography>
            </Tooltip>
            <IconButton size="small" onClick={() => onOpenComment(task)} sx={{ p: 0.5 }}>
              <CommentIcon fontSize="small" sx={{ fontSize: 14, color: '#7c9ebf' }} />
            </IconButton>
          </Box>
        </TableCell>
        
        {/* Дедлайн – скрыт для дочерних */}
        <TableCell sx={{ display: 'none' }} />
        
        {/* Часы */}
        <TableCell align="center">
          <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
            {task.estimateHours.toFixed(1)} ч
          </Typography>
        </TableCell>
        
        {/* Тип работы */}
        <TableCell>
          <Tooltip title={task.type} arrow>
            <Chip 
              label={task.type && task.type.length > 20 ? task.type.substring(0, 20) + '...' : task.type} 
              size="small"
              variant="outlined"
              sx={{ fontSize: '0.7rem', maxWidth: '150px' }}
            />
          </Tooltip>
        </TableCell>
        
        {/* Сотрудник */}
        <TableCell>
          <Chip 
            icon={<Person sx={{ fontSize: 14 }} />}
            label={task.employeeName} 
            size="small"
            variant="outlined"
            sx={{ fontSize: '0.7rem' }}
          />
        </TableCell>
        
        {/* Статус */}
        <TableCell>
          <Chip 
            icon={displayStatusIcon}
            label={task.statusText || "Назначена"} 
            size="small"
            sx={{ bgcolor: displayStatusColor, color: 'white', fontSize: '0.7rem' }}
          />
        </TableCell>
        
        {/* Кнопки действий */}
        <TableCell>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {canChangeStatus && (
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
    );
  }

  // Обычная (родительская) задача – полное отображение
  return (
    <Fragment>
      <TableRow sx={getRowStyle()}>
        <TableCell>
          <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 0.5 }}>
            {hasChildren && (
              <IconButton size="small" onClick={() => onToggleExpand(task.id)}>
                {isExpanded ? <ExpandMore fontSize="small" /> : <ChevronRight fontSize="small" />}
              </IconButton>
            )}
            {!hasChildren && !isChild && <Box sx={{ width: 28 }} />}
            
            {!isChild && (
              <Tooltip title={`Открыть файл: ${task.folderPath}/${task.fileName}`} arrow>
                <IconButton size="small" onClick={() => onOpenFile(task)} sx={{ color: '#7c9ebf' }}>
                  <FolderOpen fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
        </TableCell>
        
        <TableCell>
          <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 1 }}>
            <Tooltip title={task.fileName} arrow>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {getShortName(task.fileName, false)}
              </Typography>
            </Tooltip>
            {hasChildren && (
              <Chip 
                size="small" 
                label={`Разделена на ${task.children.length}`}
                icon={<CallSplit sx={{ fontSize: 12 }} />}
                sx={{ height: 20, fontSize: '0.7rem', bgcolor: '#e0e7ff' }}
              />
            )}
          </Box>
        </TableCell>
        
        <TableCell>
          <Tooltip title={task.fileName} arrow>
            <Typography variant="body2" sx={{ fontSize: '0.8rem', wordBreak: 'break-all' }}>
              {task.fileName}
            </Typography>
          </Tooltip>
        </TableCell>
        
        <TableCell>
          <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 0.5 }}>
            <Tooltip 
              title={task.comment || 'Нет комментария'} 
              arrow 
              placement="top"
              slotProps={{
                tooltip: {
                  sx: {
                    bgcolor: '#1e293b',
                    fontSize: '12px',
                    padding: '8px 15px',
                    maxWidth: '400px',
                    borderRadius: 2,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
                  }
                }
              }}
            >
              <Typography 
                variant="body2" 
                sx={{ 
                  color: 'text.secondary', 
                  fontSize: '0.8rem',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '250px',
                  cursor: 'default'
                }}
              >
                {task.comment && task.comment.length > 25 
                  ? `${task.comment.slice(0, 25)}...` 
                  : (task.comment || '—')}
              </Typography>
            </Tooltip>
            <IconButton size="small" onClick={() => onOpenComment(task)} sx={{ p: 0.5 }}>
              <CommentIcon fontSize="small" sx={{ fontSize: 14, color: '#7c9ebf' }} />
            </IconButton>
          </Box>
        </TableCell>
        
        <TableCell>
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <Typography variant="body2" sx={{ color: overdue ? '#dc2626' : 'inherit', fontSize: '0.75rem' }}>
              {new Date(task.deadline).toLocaleDateString()}
            </Typography>
            <Typography variant="caption" sx={{ color: overdue ? '#dc2626' : 'text.secondary', fontSize: '0.7rem' }}>
              {new Date(task.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Typography>
          </Box>
        </TableCell>
        
        <TableCell align="center">
          <Typography variant="body2" sx={{ fontSize: '0.8rem' }}>
            {task.estimateHours.toFixed(1)} ч
          </Typography>
        </TableCell>
        
        <TableCell>
          <Tooltip title={task.type} arrow>
            <Chip 
              label={task.type && task.type.length > 20 ? task.type.substring(0, 20) + '...' : task.type} 
              size="small"
              variant="outlined"
              sx={{ fontSize: '0.7rem', maxWidth: '150px' }}
            />
          </Tooltip>
        </TableCell>
        
        <TableCell>
          <Chip 
            icon={<Person sx={{ fontSize: 14 }} />}
            label={task.employeeName} 
            size="small"
            variant="outlined"
            sx={{ fontSize: '0.7rem' }}
          />
        </TableCell>
        
        <TableCell>
          {hasChildren ? (
            <Chip 
              icon={displayStatusIcon}
              label={displayStatus} 
              size="small"
              sx={{ bgcolor: displayStatusColor, color: 'white', fontSize: '0.7rem' }}
            />
          ) : (
            <Chip 
              icon={displayStatusIcon}
              label={task.statusText || "Назначена"} 
              size="small"
              sx={{ bgcolor: displayStatusColor, color: 'white', fontSize: '0.7rem' }}
            />
          )}
        </TableCell>
        
        <TableCell>
          <Box sx={{ display: 'flex', flexDirection: 'row', gap: 0.5 }}>
            {canSplit && !hasChildren && !isChild && task.statusText !== 'Готово' && (
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