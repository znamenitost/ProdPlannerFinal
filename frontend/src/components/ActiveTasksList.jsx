import { startTask, pauseTask, resumeTask, setProgress, completeTask } from '../services/api';
import {
  Warning,
  Error,
  FolderOpen,
  AccessTime,
  Event,
  PlayArrow,
  Pause,
  CheckCircle,
  Assignment
} from '@mui/icons-material';
import {
  Tooltip,
  Chip,
  IconButton,
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  LinearProgress,
  Stack
} from '@mui/material';
import { useUiFeedback } from '../context/UiFeedbackContext';
import { openFileOnClient } from '../utils/openFileOnClient';
import { normalizePathForOpen } from '../utils/filePathForOpen';
import { glassCardSx, compactActionButtonSx } from '../theme/surfaces';
import EmptyState from './ui/EmptyState';

export default function ActiveTasksList({ tasks, onUpdate, onSplit, embedded = false }) {
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
    if (!result.ok) showError('Не удалось открыть файл');
  };

  const getRiskProps = (riskLevel) => {
    switch (riskLevel) {
      case 'overdue':
        return { icon: <Error fontSize="small" />, color: 'error', label: 'Дедлайн сорван' };
      case 'critical':
        return { icon: <Error fontSize="small" />, color: 'error', label: 'Не хватает времени' };
      case 'warning':
        return { icon: <Warning fontSize="small" />, color: 'warning', label: 'Дедлайн приближается' };
      default:
        return null;
    }
  };

  const getShortTitle = (title) => {
    if (!title) return '';
    return title.split('\\').pop().split('/').pop();
  };

  const getBorderColor = (status, theme) => {
    if (status === 1) return theme.palette.info.main;
    if (status === 2) return theme.palette.warning.main;
    return theme.palette.divider;
  };

  const list = (
    <Stack spacing={2}>
      {tasks.map((task) => {
        const risk = getRiskProps(task.riskLevel);
        const progressValue = Math.round((task.progress || 0) * 100);

        return (
          <Card
            key={task.id}
            sx={(theme) => ({
              ...glassCardSx,
              borderLeft: '4px solid',
              borderLeftColor: getBorderColor(task.status, theme)
            })}
          >
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                <Tooltip title="Открыть файл" arrow>
                  <IconButton size="small" color="primary" onClick={() => openFile(task.file)}>
                    <FolderOpen fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Typography variant="subtitle2">{getShortTitle(task.title)}</Typography>
                <Chip label={task.type} size="small" variant="outlined" sx={{ height: 22, fontSize: '0.7rem' }} />
                {risk && (
                  <Chip icon={risk.icon} label={risk.label} size="small" color={risk.color} sx={{ height: 22, fontSize: '0.7rem' }} />
                )}
              </Box>

              <Stack direction="row" spacing={2} sx={{ mb: 1, color: 'text.secondary' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <AccessTime sx={{ fontSize: 14 }} />
                  <Typography variant="caption">{task.estimateHours} ч</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Event sx={{ fontSize: 14 }} />
                  <Typography variant="caption">
                    {task.deadline
                      ? `${new Date(task.deadline).toLocaleDateString()} ${new Date(task.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                      : 'Нет дедлайна'}
                  </Typography>
                </Box>
              </Stack>

              <LinearProgress
                variant="determinate"
                value={progressValue}
                color={task.status === 1 ? 'info' : task.status === 2 ? 'warning' : 'inherit'}
                sx={{ mb: 1.5, borderRadius: 1 }}
              />

              <Stack direction="row" flexWrap="wrap" gap={0.75}>
                {task.status === 0 && (
                  <Button size="small" variant="outlined" color="success" startIcon={<PlayArrow />} onClick={() => handleAction(task.id, 'start')} sx={compactActionButtonSx}>
                    Начал
                  </Button>
                )}
                {task.status === 1 && (
                  <>
                    <Button size="small" variant="outlined" color="warning" startIcon={<Pause />} onClick={() => handleAction(task.id, 'pause')} sx={compactActionButtonSx}>
                      Пауза
                    </Button>
                    <Button size="small" variant="outlined" color="primary" startIcon={<CheckCircle />} onClick={() => handleAction(task.id, 'complete')} sx={compactActionButtonSx}>
                      Готово
                    </Button>
                  </>
                )}
                {task.status === 2 && (
                  <>
                    <Button size="small" variant="contained" color="success" startIcon={<PlayArrow />} onClick={() => handleAction(task.id, 'resume')} sx={compactActionButtonSx}>
                      Продолжить
                    </Button>
                    <Button size="small" variant="outlined" color="primary" startIcon={<CheckCircle />} onClick={() => handleAction(task.id, 'complete')} sx={compactActionButtonSx}>
                      Готово
                    </Button>
                  </>
                )}
                {task.status !== 3 && [0.3, 0.6, 0.9].map((p) => (
                  <Button key={p} size="small" variant="text" color="secondary" onClick={() => handleAction(task.id, 'progress', p)} sx={compactActionButtonSx}>
                    {Math.round(p * 100)}%
                  </Button>
                ))}
              </Stack>
            </CardContent>
          </Card>
        );
      })}
      {tasks.length === 0 && <EmptyState message="Нет активных задач" icon={Assignment} />}
    </Stack>
  );

  if (embedded) return list;

  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="h2" sx={{ mb: 2 }}>Активные задачи</Typography>
      {list}
    </Box>
  );
}
