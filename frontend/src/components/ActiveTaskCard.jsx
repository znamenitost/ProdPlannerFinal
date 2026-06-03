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
  isInfoStatus,
  isPendingApprovalCalendar,
  isSequenceBlocked,
  STATUS_NO_ITEMS,
  STATUS_PENDING_APPROVAL,
  SUPPLY_MODE_INTERNAL
} from '../constants/taskStatuses';
import { getTaskFileLabel, getTaskHeading, getTaskStatusLine } from './TaskTitleTwoLines';
import TaskStatusCell from './taskTable/TaskStatusCell';

const blockedButtonSx = { opacity: 0.5 };
const PROGRESS_MARKS = [0.3, 0.6, 0.9];

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

function getBorderColor(task, theme) {
  const text = getTaskStatusLine(task);
  if (text === STATUS_PENDING_APPROVAL || isPendingApprovalCalendar(text)) {
    return theme.palette.secondary.main;
  }
  if (text === STATUS_NO_ITEMS) return theme.palette.error.main;
  if (task.status === 1) return theme.palette.info.main;
  if (task.status === 2) return theme.palette.warning.main;
  return theme.palette.divider;
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
  const showBlockingStatus = showInfoStatus || sequenceBlocked;
  const isAssignedLike = task.status === 0 || task.status === 6 || task.status === 7;
  const isInProgress = task.status === 1;
  const isPaused = task.status === 2;
  const isCompleted = task.status === 3;
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
        borderLeftColor: getBorderColor(task, theme)
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
            <Tooltip title="Открыть файл" arrow describeChild>
              <IconButton
                size="small"
                color="primary"
                onClick={() => onOpenFile(task.file)}
                aria-label="Открыть файл"
              >
                <FolderOpen fontSize="small" />
              </IconButton>
            </Tooltip>
            {task.isSplitTask && (
              <Tooltip title="Общая задача" arrow>
                <Groups fontSize="small" sx={sharedTaskIconSx} />
              </Tooltip>
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
            {showBlockingStatus && (
              <TaskStatusCell statusText={statusLabel} label={statusLabel} />
            )}
            {risk && (
              <Chip icon={risk.icon} label={risk.label} size="small" color={risk.color} sx={{ height: 22, fontSize: '0.7rem' }} />
            )}
          </Stack>

          <Box sx={{ position: 'relative', display: 'inline-flex', maxWidth: '100%' }}>
          <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75, alignItems: 'center' }}>
            {sequenceBlocked && !isCompleted && (
              <Button
                size="small"
                variant="compact"
                color="success"
                startIcon={<PlayArrow />}
                disabled={statusActionsDisabled}
                onClick={() => onAction(task, 'start')}
                sx={blockedButtonSx}
              >
                Начал
              </Button>
            )}
            {!sequenceBlocked && showInfoStatus && !isCompleted && (
              <>
                <Button
                  size="small"
                  variant="compact"
                  color="success"
                  startIcon={<PlayArrow />}
                  disabled={statusActionsDisabled}
                  onClick={() => onAction(task, 'start')}
                  sx={blockedButtonSx}
                >
                  Начал
                </Button>
                <Button
                  size="small"
                  variant="compact"
                  color="warning"
                  startIcon={<Pause />}
                  disabled
                  sx={blockedButtonSx}
                >
                  Пауза
                </Button>
                <Button
                  size="small"
                  variant="compact"
                  color="primary"
                  startIcon={<CheckCircle />}
                  disabled
                  sx={blockedButtonSx}
                >
                  Готово
                </Button>
              </>
            )}
            {!blocked && (isAssignedLike || isInProgress || isPaused) && !isCompleted && (
              <>
                {(isAssignedLike || isPaused) && (
                  <Button
                    size="small"
                    variant="compact"
                    color="success"
                    startIcon={<PlayArrow />}
                    disabled={statusActionsDisabled}
                    onClick={() => onAction(task, isPaused ? 'resume' : 'start')}
                  >
                    {isPaused ? 'Продолжить' : 'Начал'}
                  </Button>
                )}
                {isInProgress && (
                  <Button
                    size="small"
                    variant="compact"
                    color="warning"
                    startIcon={<Pause />}
                    disabled={statusActionsDisabled}
                    onClick={() => onAction(task, 'pause')}
                  >
                    Пауза
                  </Button>
                )}
                {(isInProgress || isPaused) && (
                  <Button
                    size="small"
                    variant="compact"
                    color="primary"
                    startIcon={<CheckCircle />}
                    disabled={statusActionsDisabled}
                    onClick={() => onAction(task, 'complete')}
                  >
                    Готово
                  </Button>
                )}
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
                    onClick={() => onAction(task, 'progress', p)}
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
        </Box>
      </CardContent>
    </Card>
  );
}

export default memo(ActiveTaskCard);
