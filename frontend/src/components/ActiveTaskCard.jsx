import { memo } from 'react';
import {
  AccessTime,
  CheckCircle,
  Error,
  Event,
  FolderOpen,
  Groups,
  Pause,
  PlayArrow,
  Warning
} from '@mui/icons-material';
import {
  Backdrop,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  IconButton,
  Stack,
  Tooltip,
  Typography
} from '@mui/material';
import { compactButtonThemeStyles } from '../theme/componentVariants';
import {
  ACTION_RESUME,
  isInfoStatus,
  isSequenceBlocked,
  shouldShowActiveTaskStatusChip,
  STATUS_IN_PROGRESS,
  STATUS_PAUSED,
  SUPPLY_MODE_INTERNAL
} from '../constants/taskStatuses';
import { getTaskBorderColor } from '../utils/taskBorderColor';
import { getTaskFileLabel, getTaskHeading, getTaskStatusLine } from './TaskTitleTwoLines';
import TaskStatusCell from './taskTable/TaskStatusCell';
import { taskShowsThroughApproval } from '../utils/throughApproval';
import { ThroughApprovalMark } from './taskTable/ThroughApprovalChip';
import { TaskPriorityMark } from './taskTable/TaskPriorityChip';
import { IssuedWithoutReadyMark } from './taskTable/IssuedWithoutReadyChip';

const blockedButtonSx = { opacity: 0.5 };
const PROGRESS_MARKS = [0.3, 0.6, 0.9];

function invokeTaskAction(action, ...args) {
  void Promise.resolve(action(...args)).catch((err) => {
    console.error('Ошибка действия с задачей:', err);
  });
}

function isProgressMarkActive(progress, mark) {
  return Math.abs((progress ?? 0) - mark) < 0.02;
}

function stripTaskTypeSuffix(fileLabel, taskType) {
  if (!fileLabel || fileLabel === '—') return fileLabel;
  const type = String(taskType || '').trim();
  if (type && fileLabel.endsWith(` [${type}]`)) {
    return fileLabel.slice(0, -(` [${type}]`.length));
  }
  return fileLabel.replace(/\s+\[[^\]]+\]$/, '');
}

function getRiskProps(riskLevel) {
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
}

function ActiveTaskCard({ task, isPending, lifecycleBusy = false, onAction, onOpenFile }) {
  const statusActionsDisabled = isPending || lifecycleBusy;
  const risk = getRiskProps(task.riskLevel);
  const statusLabel = getTaskStatusLine(task);
  const taskHeading = getTaskHeading(task);
  const taskFileLabel = stripTaskTypeSuffix(getTaskFileLabel(task), task.type);
  const titleLine = taskFileLabel === '—' ? taskHeading : `${taskHeading} | ${taskFileLabel}`;
  const showInfoStatus = isInfoStatus(statusLabel);
  const isSequentialChild = task.supplyMode === SUPPLY_MODE_INTERNAL && task.sequenceOrder > 0;
  const sequenceBlocked = isSequenceBlocked(task, statusLabel) || task.status === 8;
  const blocked = showInfoStatus || sequenceBlocked;
  const showStatusChip = shouldShowActiveTaskStatusChip(task, statusLabel);
  const isAssignedLike = task.status === 0 || task.status === 6 || task.status === 7;
  const isInProgress = task.status === 1;
  const isPaused = task.status === 2;
  const isCompleted = task.status === 3;
  const showWorkflowButtons = !isCompleted && (
    sequenceBlocked || showInfoStatus || (!blocked && (isAssignedLike || isInProgress || isPaused))
  );
  const canComplete = isInProgress || isPaused;
  const primaryAction = isPaused ? 'resume' : isInProgress ? 'pause' : 'start';
  const primaryLabel = isPaused ? ACTION_RESUME : isInProgress ? STATUS_PAUSED : STATUS_IN_PROGRESS;
  const PrimaryIcon = isInProgress ? Pause : PlayArrow;
  const primaryColor = isInProgress ? 'warning' : 'success';
  const primaryBlocked = sequenceBlocked || showInfoStatus;
  const sharedTaskIconSx = {
    color: (theme) => task.supplyMode === SUPPLY_MODE_INTERNAL
      ? theme.palette.info.main
      : theme.palette.success.main
  };

  return (
    <Card
      variant="nested"
      sx={(theme) => ({
        borderLeft: '4px solid',
        borderLeftColor: getTaskBorderColor({ ...task, statusText: statusLabel }, theme)
      })}
    >
      <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) max-content',
            gap: 1,
            alignItems: 'center'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
            <IconButton
              size="small"
              color="primary"
              onClick={() => onOpenFile(task.file)}
              aria-label="Открыть файл"
            >
              <FolderOpen fontSize="small" />
            </IconButton>
            {taskShowsThroughApproval(task) && (
              <Tooltip title="Через согласование" arrow>
                <Box component="span" aria-label="Через согласование">
                  <ThroughApprovalMark />
                </Box>
              </Tooltip>
            )}
            {task?.isPriorityMarked && (
              <Tooltip title="В приоритете" arrow>
                <Box component="span" aria-label="В приоритете">
                  <TaskPriorityMark />
                </Box>
              </Tooltip>
            )}
            {task?.issuedWithoutReady && (
              <Tooltip title="Выдан без статуса «Готово»" arrow>
                <Box component="span" aria-label="Выдан без статуса Готово">
                  <IssuedWithoutReadyMark />
                </Box>
              </Tooltip>
            )}
            {task.isSplitTask && (
              <Groups fontSize="small" sx={sharedTaskIconSx} aria-label="Общая задача" />
            )}
            {isSequentialChild && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}
              >
                Этап {task.sequenceOrder}
              </Typography>
            )}
            <Typography
              variant="subtitle2"
              sx={{
                flex: 1,
                minWidth: 0,
                fontWeight: 600,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}
            >
              {titleLine}
            </Typography>
          </Box>

          <Stack
            direction="row"
            sx={{
              flexWrap: 'wrap',
              gap: 0.75,
              justifyContent: 'flex-end',
              alignItems: 'center'
            }}
          >
            <Chip label={task.type} size="small" variant="outlined" sx={{ height: 22, fontSize: '0.7rem' }} />
            {showStatusChip && (
              <TaskStatusCell statusText={statusLabel} label={statusLabel} />
            )}
          </Stack>

          <Box sx={{ position: 'relative', display: 'inline-flex', maxWidth: '100%' }}>
          <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75, alignItems: 'center' }}>
            {showWorkflowButtons && (
              <>
                <Button
                  size="small"
                  variant="compact"
                  color={primaryColor}
                  startIcon={<PrimaryIcon />}
                  disabled={statusActionsDisabled}
                  onClick={() => invokeTaskAction(onAction, task, primaryAction)}
                  sx={primaryBlocked ? blockedButtonSx : undefined}
                >
                  {primaryLabel}
                </Button>
                <Button
                  size="small"
                  variant="compact"
                  color="primary"
                  startIcon={<CheckCircle />}
                  disabled={statusActionsDisabled || !canComplete}
                  onClick={() => invokeTaskAction(onAction, task, 'complete')}
                  sx={primaryBlocked ? blockedButtonSx : undefined}
                >
                  Готово
                </Button>
              </>
            )}
            {!blocked && !isCompleted && (
              <>
                {PROGRESS_MARKS.map((p) => (
                  <Button
                    key={p}
                    size="small"
                    variant={isProgressMarkActive(task.progress, p) ? 'contained' : 'text'}
                    color="secondary"
                    disabled={statusActionsDisabled}
                    onClick={() => invokeTaskAction(onAction, task, 'progress', p)}
                    sx={compactButtonThemeStyles}
                  >
                    {Math.round(p * 100)}%
                  </Button>
                ))}
              </>
            )}
          </Stack>
          <Backdrop
            open={isPending}
            sx={{
              position: 'absolute',
              inset: 0,
              zIndex: 1,
              borderRadius: 1,
              bgcolor: 'rgba(255, 255, 255, 0.55)'
            }}
          >
            <CircularProgress size={28} />
          </Backdrop>
          </Box>

          <Stack
            direction="row"
            spacing={2}
            sx={{
              color: 'text.secondary',
              justifyContent: 'flex-end',
              alignItems: 'center',
              flexWrap: 'wrap'
            }}
          >
            {risk && (
              <Chip
                icon={risk.icon}
                label={risk.label}
                size="small"
                color={risk.color}
                sx={{ height: 22, fontSize: '0.7rem' }}
              />
            )}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <AccessTime sx={{ fontSize: 14 }} />
              <Typography variant="caption">{task.estimateHours} ч</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Event sx={{ fontSize: 14 }} />
              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                {task.deadline
                  ? `${new Date(task.deadline).toLocaleDateString()} ${new Date(task.deadline).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                  : 'Нет дедлайна'}
              </Typography>
            </Box>
          </Stack>
        </Box>
      </CardContent>
    </Card>
  );
}

export default memo(ActiveTaskCard);
