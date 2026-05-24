import {
  startTask,
  pauseTask,
  resumeTask,
  setProgress,
  completeTask,
  updateTaskRow,
  buildTaskUpdatePayload
} from '../services/api';
import { runWorkflowWithInfoGuard } from '../utils/infoStatusWorkflow';
import {
  Warning,
  Error,
  FolderOpen,
  AccessTime,
  Event,
  PlayArrow,
  Pause,
  CheckCircle,

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
import useActiveTasksQuery from '../hooks/queries/useActiveTasksQuery';
import { openFileOnClient } from '../utils/openFileOnClient';
import { normalizePathForOpen } from '../utils/filePathForOpen';
import { glassCardSx, compactActionButtonSx } from '../theme/surfaces';
import EmptyState from './ui/EmptyState';
import { Assignment } from '@mui/icons-material';
import TaskTitleTwoLines, { getTaskStatusLine } from './TaskTitleTwoLines';
import TaskStatusCell from './taskTable/TaskStatusCell';
import {
  isInfoStatus,
  isPendingApprovalCalendar,
  STATUS_NO_ITEMS,
  STATUS_PENDING_APPROVAL
} from '../constants/taskStatuses';

const blockedButtonSx = { opacity: 0.5 };

export default function ActiveTasksList({ onUpdate, embedded = false, employee = '' }) {
  const { showError, showWarning, confirm } = useUiFeedback();
  const { data: tasks = [] } = useActiveTasksQuery(employee, Boolean(employee));

  const runGuardedAction = async (task, action, progress = null) => {
    const runApi = async () => {
      if (action === 'start') await startTask(task.id);
      else if (action === 'pause') await pauseTask(task.id);
      else if (action === 'resume') await resumeTask(task.id);
      else if (action === 'progress') await setProgress(task.id, progress);
      else if (action === 'complete') await completeTask(task.id);
      await onUpdate();
    };

    try {
      await runWorkflowWithInfoGuard({
        task,
        statusText: getTaskStatusLine(task),
        confirm,
        resolveStatus: async (t, targetStatus) => {
          await updateTaskRow(t.id, buildTaskUpdatePayload(t, employee, targetStatus));
        },
        runAction: runApi
      });
    } catch (err) {
      console.error('Ошибка действия:', err);
      showError(err.message || 'Не удалось выполнить действие');
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

  const getBorderColor = (task, theme) => {
    const text = getTaskStatusLine(task);
    if (text === STATUS_PENDING_APPROVAL || isPendingApprovalCalendar(text)) {
      return theme.palette.secondary.main;
    }
    if (text === STATUS_NO_ITEMS) return theme.palette.error.light;
    if (task.status === 1) return theme.palette.info.main;
    if (task.status === 2) return theme.palette.warning.main;
    return theme.palette.divider;
  };

  const content = (
    <Stack spacing={2}>
      {tasks.map((task) => {
        const risk = getRiskProps(task.riskLevel);
        const progressValue = Math.round((task.progress || 0) * 100);
        const statusLabel = getTaskStatusLine(task);
        const showInfoStatus = isInfoStatus(statusLabel);
        const blocked = showInfoStatus;
        const isAssignedLike = task.status === 0 || task.status === 6 || task.status === 7;
        const isInProgress = task.status === 1;
        const isPaused = task.status === 2;
        const isCompleted = task.status === 3;
        return (
          <Card
            key={task.id}
            sx={(theme) => ({
              ...glassCardSx,
              borderLeft: '4px solid',
              borderLeftColor: getBorderColor(task, theme)
            })}
          >
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mb: 1 }}>
                <Tooltip title="Открыть файл" arrow>
                  <IconButton size="small" color="primary" onClick={() => openFile(task.file)}>
                    <FolderOpen fontSize="small" />
                  </IconButton>
                </Tooltip>
                <TaskTitleTwoLines task={task} sx={{ flex: 1, minWidth: 0 }} />
                {showInfoStatus && (
                  <TaskStatusCell statusText={statusLabel} label={statusLabel} />
                )}
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

              <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75, alignItems: 'center' }}>
                {blocked && !isCompleted && (
                  // В инфостатусе сначала нужно «Начал» — workflow подтвердит снятие
                  // инфостатуса и откроет интервал. «Готово» появится из обычной ветки
                  // после старта, как и описано в спеке.
                  <Button
                    size="small"
                    variant="outlined"
                    color="success"
                    startIcon={<PlayArrow />}
                    onClick={() => runGuardedAction(task, 'start')}
                    sx={{ ...compactActionButtonSx, ...blockedButtonSx }}
                  >
                    Начал
                  </Button>
                )}
                {!blocked && (isAssignedLike || isInProgress || isPaused) && !isCompleted && (
                  <>
                    {(isAssignedLike || isPaused) && (
                      <Button
                        size="small"
                        variant={isPaused ? 'contained' : 'outlined'}
                        color="success"
                        startIcon={<PlayArrow />}
                        onClick={() => runGuardedAction(task, isPaused ? 'resume' : 'start')}
                        sx={compactActionButtonSx}
                      >
                        {isPaused ? 'Продолжить' : 'Начал'}
                      </Button>
                    )}
                    {isInProgress && (
                      <Button
                        size="small"
                        variant="outlined"
                        color="warning"
                        startIcon={<Pause />}
                        onClick={() => runGuardedAction(task, 'pause')}
                        sx={compactActionButtonSx}
                      >
                        Пауза
                      </Button>
                    )}
                    {(isInProgress || isPaused) && (
                      <Button
                        size="small"
                        variant="outlined"
                        color="primary"
                        startIcon={<CheckCircle />}
                        onClick={() => runGuardedAction(task, 'complete')}
                        sx={compactActionButtonSx}
                      >
                        Готово
                      </Button>
                    )}
                  </>
                )}
                {!blocked && !isCompleted && (
                  <>
                    {[0.3, 0.6, 0.9].map((p) => (
                      <Button
                        key={p}
                        size="small"
                        variant="text"
                        color="secondary"
                        onClick={() => runGuardedAction(task, 'progress', p)}
                        sx={compactActionButtonSx}
                      >
                        {Math.round(p * 100)}%
                      </Button>
                    ))}
                  </>
                )}
              </Stack>
            </CardContent>
          </Card>
        );
      })}
      {tasks.length === 0 && <EmptyState message="Нет активных задач" icon={Assignment} />}
    </Stack>
  );

  if (embedded) return content;

  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="h2" sx={{ mb: 2 }}>
        Активные задачи
      </Typography>
      {content}
    </Box>
  );
}
