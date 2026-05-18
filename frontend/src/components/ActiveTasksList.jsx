// ./frontend/src/components/ActiveTasksList.jsx
import { startTask, pauseTask, resumeTask, setProgress, completeTask } from '../services/api';
import { Warning, Error, FolderOpen, AccessTime, Event, PlayArrow, Pause, CheckCircle } from '@mui/icons-material';
import { Tooltip, Chip, IconButton, Box, Typography } from '@mui/material';
import { useUiFeedback } from '../context/UiFeedbackContext';
import { openFileOnClient } from '../utils/openFileOnClient';
import { normalizePathForOpen } from '../utils/filePathForOpen';

export default function ActiveTasksList({ tasks, onUpdate, onSplit }) {
  const { showError, showWarning } = useUiFeedback();
  const handleAction = async (id, action, progress = null) => {
    try {
      if (action === 'start') await startTask(id);
      else if (action === 'pause') await pauseTask(id);
      else if (action === 'resume') await resumeTask(id);
      else if (action === 'progress') await setProgress(id, progress);
      else if (action === 'complete') await completeTask(id);
      await onUpdate();
      setTimeout(() => onUpdate(), 100);
    } catch (err) {
      console.error('Ошибка действия:', err);
      showError('Не удалось выполнить действие. Проверьте консоль.');
    }
  };

  const openFile = (filePath) => {
    if (!filePath) {
      showWarning('Путь к файлу не указан');
      return;
    }
    const parts = String(filePath).replace(/\\/g, '/').split('/');
    const fileName = parts.pop() || '';
    const folderPath = parts.join('/');
    const result = openFileOnClient(normalizePathForOpen(folderPath, fileName));
    if (!result.ok) {
      showError('Не удалось открыть файл');
    }
  };

  const getRiskProps = (riskLevel) => {
    switch (riskLevel) {
      case 'overdue':
        return { icon: <Error sx={{ fontSize: 16 }} />, color: '#dc2626', label: 'Дедлайн сорван' };
      case 'critical':
        return { icon: <Error sx={{ fontSize: 16 }} />, color: '#dc2626', label: 'Не хватает времени' };
      case 'warning':
        return { icon: <Warning sx={{ fontSize: 16 }} />, color: '#f59e0b', label: 'Дедлайн приближается' };
      default:
        return null;
    }
  };

  const getShortTitle = (title) => {
    if (!title) return '';
    return title.split('\\').pop().split('/').pop();
  };

  const getBorderColor = (status) => {
    if (status === 1) return '#3b82f6';
    if (status === 2) return '#f59e0b';
    return '#cbd5e1';
  };

  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="h2" sx={{ mb: 2, fontSize: '1.3rem', fontWeight: 500 }}>
        Активные задачи
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {tasks.map(task => {
          const risk = getRiskProps(task.riskLevel);
          const borderColor = getBorderColor(task.status);
          
          return (
            <Box 
              key={task.id} 
              sx={{ 
                bgcolor: 'white',
                borderRadius: 2,
                p: 2,
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                transition: 'all 0.2s ease',
                borderLeft: `4px solid ${borderColor}`,
                '&:hover': { 
                  boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                  transform: 'translateY(-2px)'
                }
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                <Tooltip title="Открыть файл" arrow>
                  <IconButton 
                    size="small" 
                    onClick={() => openFile(task.file)}
                    sx={{ color: '#7c9ebf', p: 0.5 }}
                  >
                    <FolderOpen fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {getShortTitle(task.title)}
                </Typography>
                <Typography variant="caption" sx={{ color: '#6b7c93' }}>
                  ({task.type})
                </Typography>
                
                {risk && (
                  <Tooltip title={risk.label} arrow>
                    <Chip
                      icon={risk.icon}
                      label={risk.label}
                      size="small"
                      sx={{
                        height: 22,
                        fontSize: '0.7rem',
                        bgcolor: risk.color,
                        color: 'white',
                        '& .MuiChip-icon': { color: 'white', fontSize: 14, ml: 0.5 },
                        '& .MuiChip-label': { px: 1 }
                      }}
                    />
                  </Tooltip>
                )}
              </Box>
              
              <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 2, mb: 1, fontSize: '0.8rem', color: 'text.secondary' }}>
                <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 0.5 }}>
                  <AccessTime sx={{ fontSize: 14 }} />
                  <span>{task.estimateHours} ч</span>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 0.5 }}>
                  <Event sx={{ fontSize: 14 }} />
                  <span>
                    {task.deadline ? new Date(task.deadline).toLocaleDateString() + ' ' + new Date(task.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Нет дедлайна'}
                  </span>
                </Box>
              </Box>
              
              <Box sx={{ bgcolor: '#e2e8f0', borderRadius: 1, height: 8, overflow: 'hidden', mb: 1 }}>
                <Box 
                  sx={{ 
                    width: `${(task.progress || 0) * 100}%`,
                    height: '100%',
                    bgcolor: task.status === 1 ? '#3b82f6' : (task.status === 2 ? '#f59e0b' : '#cbd5e1'),
                    transition: 'width 0.3s ease',
                    borderRadius: 1
                  }} 
                />
              </Box>
              
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                {task.status === 0 && (
                  <Box 
                    component="button"
                    onClick={() => handleAction(task.id, 'start')}
                    sx={{ 
                      px: 2, py: 0.5, borderRadius: 1, fontSize: '0.75rem', fontWeight: 500,
                      cursor: 'pointer', transition: 'all 0.2s ease',
                      border: '1px solid #e2e8f0', bgcolor: '#f8fafc', color: '#334155',
                      display: 'inline-flex', alignItems: 'center', gap: 0.5,
                      '&:hover': { bgcolor: '#f1f5f9', transform: 'translateY(-1px)', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }
                    }}
                  >
                    <PlayArrow sx={{ fontSize: 16, color: '#3b82f6' }} /> Начал
                  </Box>
                )}
                
                {task.status === 1 && (
                  <>
                    <Box 
                      component="button"
                      onClick={() => handleAction(task.id, 'pause')}
                      sx={{ 
                        px: 2, py: 0.5, borderRadius: 1, fontSize: '0.75rem', fontWeight: 500,
                        cursor: 'pointer', transition: 'all 0.2s ease',
                        border: '1px solid #e2e8f0', bgcolor: '#f8fafc', color: '#334155',
                        display: 'inline-flex', alignItems: 'center', gap: 0.5,
                        '&:hover': { bgcolor: '#f1f5f9', transform: 'translateY(-1px)', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }
                      }}
                    >
                      <Pause sx={{ fontSize: 16, color: '#f59e0b' }} /> Пауза
                    </Box>
                    <Box 
                      component="button"
                      onClick={() => handleAction(task.id, 'complete')}
                      sx={{ 
                        px: 2, py: 0.5, borderRadius: 1, fontSize: '0.75rem', fontWeight: 500,
                        cursor: 'pointer', transition: 'all 0.2s ease',
                        border: '1px solid #e2e8f0', bgcolor: '#f8fafc', color: '#334155',
                        display: 'inline-flex', alignItems: 'center', gap: 0.5,
                        '&:hover': { bgcolor: '#f1f5f9', transform: 'translateY(-1px)', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }
                      }}
                    >
                      <CheckCircle sx={{ fontSize: 16, color: '#22c55e' }} /> Готово
                    </Box>
                  </>
                )}
                
                {task.status === 2 && (
                  <>
                    <Box 
                      component="button"
                      onClick={() => handleAction(task.id, 'resume')}
                      sx={{ 
                        px: 2, py: 0.5, borderRadius: 1, fontSize: '0.75rem', fontWeight: 500,
                        cursor: 'pointer', transition: 'all 0.2s ease',
                        border: '1px solid #e2e8f0', bgcolor: '#22c55e', color: 'white',
                        display: 'inline-flex', alignItems: 'center', gap: 0.5,
                        '&:hover': { bgcolor: '#16a34a', transform: 'translateY(-1px)', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }
                      }}
                    >
                      <PlayArrow sx={{ fontSize: 16 }} /> Продолжить
                    </Box>
                    <Box 
                      component="button"
                      onClick={() => handleAction(task.id, 'complete')}
                      sx={{ 
                        px: 2, py: 0.5, borderRadius: 1, fontSize: '0.75rem', fontWeight: 500,
                        cursor: 'pointer', transition: 'all 0.2s ease',
                        border: '1px solid #e2e8f0', bgcolor: '#f8fafc', color: '#334155',
                        display: 'inline-flex', alignItems: 'center', gap: 0.5,
                        '&:hover': { bgcolor: '#f1f5f9', transform: 'translateY(-1px)', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }
                      }}
                    >
                      <CheckCircle sx={{ fontSize: 16, color: '#22c55e' }} /> Готово
                    </Box>
                  </>
                )}
                
                {task.status !== 3 && (
                  <>
                    <Box 
                      component="button"
                      onClick={() => handleAction(task.id, 'progress', 0.3)}
                      sx={{ 
                        px: 2, py: 0.5, borderRadius: 1, fontSize: '0.75rem', fontWeight: 500,
                        cursor: 'pointer', transition: 'all 0.2s ease',
                        border: '1px solid #e2e8f0', bgcolor: '#f8fafc', color: '#334155',
                        '&:hover': { bgcolor: '#f1f5f9', transform: 'translateY(-1px)', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }
                      }}
                    >
                      30%
                    </Box>
                    <Box 
                      component="button"
                      onClick={() => handleAction(task.id, 'progress', 0.6)}
                      sx={{ 
                        px: 2, py: 0.5, borderRadius: 1, fontSize: '0.75rem', fontWeight: 500,
                        cursor: 'pointer', transition: 'all 0.2s ease',
                        border: '1px solid #e2e8f0', bgcolor: '#f8fafc', color: '#334155',
                        '&:hover': { bgcolor: '#f1f5f9', transform: 'translateY(-1px)', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }
                      }}
                    >
                      60%
                    </Box>
                    <Box 
                      component="button"
                      onClick={() => handleAction(task.id, 'progress', 0.9)}
                      sx={{ 
                        px: 2, py: 0.5, borderRadius: 1, fontSize: '0.75rem', fontWeight: 500,
                        cursor: 'pointer', transition: 'all 0.2s ease',
                        border: '1px solid #e2e8f0', bgcolor: '#f8fafc', color: '#334155',
                        '&:hover': { bgcolor: '#f1f5f9', transform: 'translateY(-1px)', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }
                      }}
                    >
                      90%
                    </Box>
                  </>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>

      {tasks.length === 0 && (
        <Box sx={{ textAlign: 'center', py: 4 }}>
          <Typography variant="body1" color="text.secondary">
            Нет активных задач
          </Typography>
        </Box>
      )}
    </Box>
  );
}