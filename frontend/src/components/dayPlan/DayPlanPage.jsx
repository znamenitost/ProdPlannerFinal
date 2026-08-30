import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Alert,
  Box,
  Button,
  Chip,
  Divider,
  IconButton,
  Paper,
  Stack,
  Typography,
  useMediaQuery,
  useTheme
} from '@mui/material';
import {
  ChevronLeft,
  ChevronRight,
  Groups,
  Today,
  ViewTimeline
} from '@mui/icons-material';
import useDayPlanQuery from '../../hooks/queries/useDayPlanQuery';
import useDayPlanRankMutation from '../../hooks/queries/useDayPlanRankMutation';
import useDayPlanLifecycle from '../../hooks/useDayPlanLifecycle';
import useTaskFileOpen from '../../hooks/useTaskFileOpen';
import useCdrPreview from '../../hooks/useCdrPreview';
import { CalendarLoadingState } from '../LoadingState';
import EmptyState from '../ui/EmptyState';
import CdrPreviewDialog from '../CdrPreviewDialog';
import CommentDialog from '../CommentDialog';
import DayPlanCanvas from './DayPlanCanvas';
import TaskTypeGlyph from './TaskTypeGlyph';
import TaskTitleTwoLines from '../TaskTitleTwoLines';
import TaskFileNameCell from '../taskTable/TaskFileNameCell';
import TaskCommentCell from '../taskTable/TaskCommentCell';
import {
  addWorkdays,
  formatDayPlanDateKey,
  getPlanAnchorDate
} from '../../utils/dayPlanDate';
import { planableUnplanned } from '../../utils/dayPlanBoard';
import { DEV_CDR_PREVIEW_ENABLED } from '../../utils/devCdrPreviewConfig';
import { sectionHeaderSx, sectionTitleRowSx } from '../../theme/surfaces';
import { useUiFeedback } from '../../context/UiFeedbackContext';
import { useTextLimit } from '../../context/TextLimitContext';
import { SUPPLY_MODE_INTERNAL } from '../../constants/taskStatuses';
import { queryKeys } from '../../lib/queryKeys';
import { getTaskComments } from '../../services/api';

function taskFromDto(task) {
  if (!task) return null;
  return {
    heading: task.title,
    folderPath: task.folderPath,
    fileName: task.fileName,
    statusText: task.statusText,
    isFuss: task.isFuss,
    isSplitTask: task.isSplitTask
  };
}

function collectSelectableTasks(...plans) {
  const byId = new Map();
  for (const plan of plans) {
    for (const wave of plan?.waves || []) {
      for (const block of wave.blocks || []) {
        if (block.task?.id) byId.set(block.task.id, block.task);
      }
      for (const task of wave.blocked || []) {
        if (task?.id) byId.set(task.id, task);
      }
    }
    for (const task of plan?.unplanned || []) {
      if (task?.id) byId.set(task.id, task);
    }
  }
  return byId;
}

function DetailsCard({ task, onOpenComment }) {
  const textLimit = useTextLimit();
  if (!task) return null;

  const partners = task.partnerNames || [];
  const sequential = task.supplyMode === SUPPLY_MODE_INTERNAL && task.sequenceOrder > 0;

  return (
    <Stack
      spacing={1.5}
      divider={<Divider flexItem />}
      sx={{ minWidth: 0 }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25, minWidth: 0 }}>
        <TaskTypeGlyph type={task.type} />
        <TaskTitleTwoLines
          task={taskFromDto(task)}
          headingVariant="subtitle2"
          showStatus={false}
          headingSx={{ lineHeight: 1.45 }}
        />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <TaskFileNameCell
          fileName={task.fileName}
          task={task}
          textLimit={textLimit}
        />
      </Box>
      <TaskCommentCell
        task={task}
        onOpenComment={onOpenComment}
        framed
      />
      {task.deadline && (
        <Typography variant="body2" color="text.secondary">
          Дедлайн {new Date(task.deadline).toLocaleString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
          })}
        </Typography>
      )}
      {task.isSplitTask && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, flexWrap: 'wrap' }}>
          <Groups fontSize="small" />
          <Typography variant="body2">
            {sequential
              ? `Этап ${task.sequenceOrder}${partners.length ? ` → ${partners.join(', ')}` : ''}`
              : partners.length
                ? `Вместе: ${partners.join(', ')}`
                : 'Общая задача'}
          </Typography>
        </Box>
      )}
    </Stack>
  );
}

export default function DayPlanPage({ employee, isAdmin = false }) {
  const theme = useTheme();
  const isMdUp = useMediaQuery(theme.breakpoints.up('md'));
  const queryClient = useQueryClient();
  const { showError } = useUiFeedback();
  const { handleOpenFolder, handleOpenFile } = useTaskFileOpen();
  const { runAction, pendingTaskId } = useDayPlanLifecycle(employee);
  const cdrPreview = useCdrPreview();
  const [dateKey, setDateKey] = useState(() => formatDayPlanDateKey(getPlanAnchorDate(new Date())));
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [commentTask, setCommentTask] = useState(null);
  const [commentSaving, setCommentSaving] = useState(false);

  const { data: plan, isPending, isError } = useDayPlanQuery(employee, dateKey);
  const { assign, pending } = useDayPlanRankMutation(employee);

  useEffect(() => {
    if (isError) showError('Не удалось загрузить план дня');
  }, [isError, showError]);

  useEffect(() => {
    setSelectedTaskId(null);
  }, [employee, dateKey]);

  const tasksById = useMemo(
    () => collectSelectableTasks(plan),
    [plan]
  );
  const selectedTask = selectedTaskId == null
    ? null
    : (tasksById.get(selectedTaskId) ?? tasksById.get(Number(selectedTaskId)) ?? null);
  const unplanned = useMemo(() => planableUnplanned(plan?.unplanned), [plan]);
  const handleOpenComment = useCallback((row) => {
    setCommentTask(row);
    setCommentDialogOpen(true);
  }, []);
  const handleCommentChanged = useCallback(async (taskId) => {
    setCommentSaving(true);
    try {
      const data = await getTaskComments(taskId);
      const comment = data?.preview ?? '';
      setCommentTask((prev) => (prev?.id === taskId ? { ...prev, comment } : prev));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.dayPlanAll(employee) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.taskTableAll() })
      ]);
    } catch (err) {
      console.error(err);
      showError('Ошибка обновления комментария');
    } finally {
      setCommentSaving(false);
    }
  }, [employee, queryClient, showError]);
  const handleCloseComment = useCallback(() => {
    setCommentDialogOpen(false);
    setCommentTask(null);
  }, []);
  const anchorDate = useMemo(() => {
    const [y, m, d] = dateKey.split('-').map(Number);
    return new Date(y, (m || 1) - 1, d || 1);
  }, [dateKey]);
  const now = plan?.currentTime ? new Date(plan.currentTime) : new Date();
  const isToday = dateKey === formatDayPlanDateKey(getPlanAnchorDate(now));

  const headerTitle = anchorDate.toLocaleDateString('ru-RU', {
    weekday: 'long',
    day: 'numeric',
    month: 'long'
  });

  if (!employee) {
    return (
      <Paper variant="section">
        <EmptyState message="Выберите сотрудника в шапке, чтобы увидеть план дня" />
      </Paper>
    );
  }

  if (isPending || !plan) {
    return (
      <Paper variant="section">
        <CalendarLoadingState />
      </Paper>
    );
  }

  return (
    <Paper variant="section" sx={{ mb: 3 }}>
      <Box sx={sectionHeaderSx}>
        <Box sx={sectionTitleRowSx}>
          <ViewTimeline color="primary" />
          <Typography variant="h2">План дня</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <IconButton
            variant="soft"
            color="primary"
            onClick={() => setDateKey(formatDayPlanDateKey(addWorkdays(anchorDate, -1)))}
            aria-label="Предыдущий рабочий день"
          >
            <ChevronLeft />
          </IconButton>
          <Typography variant="subtitle1" sx={{ textTransform: 'capitalize', minWidth: 180, textAlign: 'center' }}>
            {headerTitle}
          </Typography>
          <IconButton
            variant="soft"
            color="primary"
            onClick={() => setDateKey(formatDayPlanDateKey(addWorkdays(anchorDate, 1)))}
            aria-label="Следующий рабочий день"
          >
            <ChevronRight />
          </IconButton>
          <Button
            size="small"
            variant="outlined"
            startIcon={<Today />}
            disabled={isToday}
            onClick={() => setDateKey(formatDayPlanDateKey(getPlanAnchorDate(new Date())))}
          >
            Сегодня
          </Button>
        </Box>
      </Box>

      {plan.tailHours > 0 && (
        <Chip
          size="small"
          color="warning"
          variant="outlined"
          label={`хвост ${Number(plan.tailHours).toFixed(1)} ч`}
          sx={{ mb: 2 }}
        />
      )}

      {plan.tailHours > 0 && (
        <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
          Очередь не влезает в этот день. Ещё {Number(plan.tailHours).toFixed(1)} ч
          {plan.tailUntil
            ? ` — до ${new Date(plan.tailUntil).toLocaleString('ru-RU', {
              day: '2-digit',
              month: '2-digit',
              hour: '2-digit',
              minute: '2-digit'
            })}`
            : ''}
          .
        </Alert>
      )}

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: isMdUp ? 'minmax(0, 1fr) 280px' : '1fr',
          gap: 2,
          alignItems: 'start'
        }}
      >
        <Box sx={{ minWidth: 0 }}>
          <DayPlanCanvas
            plan={plan}
            unplanned={unplanned}
            selectedTaskId={selectedTaskId}
            onSelectBlock={(block) => setSelectedTaskId(block.taskId)}
            canEdit={isAdmin}
            onAssign={assign}
            onOpenFolder={handleOpenFolder}
            onOpenFile={handleOpenFile}
            onAction={runAction}
            showActions
            pendingTaskId={pendingTaskId}
            onShowCdrPreview={DEV_CDR_PREVIEW_ENABLED ? cdrPreview.handleShowCdrPreview : undefined}
            isCdrPreviewBuilding={cdrPreview.isCdrPreviewBuilding}
            pending={pending}
          />
        </Box>
        <Box
          sx={{
            p: 2,
            borderRadius: 2,
            bgcolor: 'background.default',
            border: '1px solid',
            borderColor: 'divider',
            minWidth: 0
          }}
        >
          <DetailsCard
            task={selectedTask}
            onOpenComment={handleOpenComment}
          />
        </Box>
      </Box>
      {DEV_CDR_PREVIEW_ENABLED && (
        <CdrPreviewDialog
          open={cdrPreview.cdrPreviewOpen}
          anchor={cdrPreview.cdrPreviewAnchor}
          previewUrl={cdrPreview.cdrPreviewData?.url}
          previewError={cdrPreview.cdrPreviewData?.error}
          pending={cdrPreview.cdrPreviewPending}
        />
      )}
      <CommentDialog
        open={commentDialogOpen}
        task={commentTask}
        pending={commentSaving}
        onChanged={handleCommentChanged}
        onClose={handleCloseComment}
      />
    </Paper>
  );
}
