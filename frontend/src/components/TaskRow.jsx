import { Fragment } from 'react';
import {
  TableRow,
  TableCell,
  Box,
  IconButton,
  Tooltip,
  Typography,
  Chip,
  LinearProgress,
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

const getParentProgress = (parent) => {
  if (!parent.children || parent.children.length === 0) return 0;
  const completed = parent.children.filter(c => c.statusText === 'Готово').length;
  return (completed / parent.children.length) * 100;
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
  canChangeStatus
}) {
  const overdue = isOverdue(task.deadline, task.statusText);
  const hasChildren = task.children && task.children.length > 0;
  const progress = hasChildren ? getParentProgress(task) : (task.statusText === 'Готово' ? 100 : 0);
  
  return (
    <Fragment>
      <TableRow 
        sx={{
          '&:hover': { bgcolor: '#f8fafc' },
          bgcolor: overdue && task.statusText !== 'Готово' ? '#fef2f2' : 'inherit',
          borderLeft: isChild ? '2px solid #e2e8f0' : 'none'
        }}
      >
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
            {isChild && <Box sx={{ width: 28 }} />}
          </Box>
        </TableCell>
        
        <TableCell>
          <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 1 }}>
            {isChild && <Box sx={{ width: 24 }} />}
            <Tooltip title={task.fileName} arrow>
              <Typography variant="body2" sx={{ fontWeight: isChild ? 400 : 600 }}>
                {isChild ? `└─ ` : ''}{getShortName(task.fileName, isChild)}
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
          <Typography variant="body2" sx={{ color: overdue ? '#dc2626' : 'inherit', fontSize: '0.8rem' }}>
            {new Date(task.deadline).toLocaleString()}
          </Typography>
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
          {hasChildren ? (
            <Tooltip title={getUniqueEmployees(task.children).join(' / ')} arrow>
              <Chip 
                icon={<Person sx={{ fontSize: 14 }} />}
                label={getUniqueEmployees(task.children).join(' / ')} 
                size="small"
                variant="outlined"
                sx={{ fontSize: '0.7rem', bgcolor: '#f1f5f9', maxWidth: '120px' }}
              />
            </Tooltip>
          ) : (
            <Chip 
              icon={<Person sx={{ fontSize: 14 }} />}
              label={task.employeeName} 
              size="small"
              variant="outlined"
              sx={{ fontSize: '0.7rem' }}
            />
          )}
        </TableCell>
        
        <TableCell>
          {hasChildren ? (
            progress >= 99.9 ? (
              <Chip 
                icon={<CheckCircle sx={{ fontSize: 16 }} />}
                label="Готово" 
                size="small"
                sx={{ bgcolor: '#22c55e', color: 'white', fontSize: '0.7rem' }}
              />
            ) : (
              <Box sx={{ width: 100 }}>
                <LinearProgress 
                  variant="determinate" 
                  value={progress} 
                  sx={{ height: 6, borderRadius: 3 }}
                />
                <Typography variant="caption" sx={{ fontSize: '0.7rem' }}>
                  {Math.round(progress)}%
                </Typography>
              </Box>
            )
          ) : (
            <Chip 
              icon={getStatusIcon(task.statusText)}
              label={task.statusText || "Назначена"} 
              size="small"
              sx={{ bgcolor: getStatusColor(task.statusText), color: 'white', fontSize: '0.7rem' }}
            />
          )}
        </TableCell>
        
        <TableCell>
          <Box sx={{ display: 'flex', flexDirection: 'row', gap: 0.5 }}>
            {canChangeStatus && task.statusText !== 'Готово' && task.statusText !== 'Начал' && task.statusText !== 'Пауза' && !hasChildren && (
              <Tooltip title="Начать">
                <IconButton size="small" onClick={() => onStart(task)} sx={{ color: '#22c55e' }}>
                  <PlayArrow fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            
            {canChangeStatus && task.statusText === 'Начал' && !hasChildren && (
              <>
                <Tooltip title="Пауза">
                  <IconButton size="small" onClick={() => onPause(task)} sx={{ color: '#f59e0b' }}>
                    <Pause fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Завершить">
                  <IconButton size="small" onClick={() => onComplete(task)} sx={{ color: '#3b82f6' }}>
                    <CheckCircle fontSize="small" />
                  </IconButton>
                </Tooltip>
              </>
            )}
            
            {canChangeStatus && task.statusText === 'Пауза' && !hasChildren && (
              <>
                <Tooltip title="Продолжить">
                  <IconButton size="small" onClick={() => onResume(task)} sx={{ color: '#22c55e' }}>
                    <PlayArrow fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Завершить">
                  <IconButton size="small" onClick={() => onComplete(task)} sx={{ color: '#3b82f6' }}>
                    <CheckCircle fontSize="small" />
                  </IconButton>
                </Tooltip>
              </>
            )}
            
            {canChangeStatus && task.statusText !== 'Готово' && task.statusText !== 'Начал' && task.statusText !== 'Пауза' && !hasChildren && (
              <Tooltip title="Завершить (без времени)">
                <IconButton size="small" onClick={() => onComplete(task)} sx={{ color: '#ef4444' }}>
                  <CheckCircle fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
            
            {canSplit && (
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
          <TableCell colSpan={9} sx={{ p: 0 }}>
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