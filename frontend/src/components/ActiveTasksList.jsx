import { Fragment, useCallback, useMemo, useRef, useState } from 'react';
import {
  startTask,
  pauseTask,
  resumeTask,
  setProgress,
  completeTask,
  updateTaskRow,
  buildTaskUpdatePayload
} from '../services/api';
import { runWorkflowWithSequenceGuard } from '../utils/supplyStatusWorkflow';
import {
  Sort
} from '@mui/icons-material';
import {
  Tooltip,
  Checkbox,
  IconButton,
  Divider,
  ListItemText,
  Box,
  Typography,
  Menu,
  MenuItem,
  Stack,
  Paper
} from '@mui/material';
import { sectionTitleRowSx } from '../theme/surfaces';
import { useUiFeedback } from '../context/UiFeedbackContext';
import useActiveTasksQuery from '../hooks/queries/useActiveTasksQuery';
import { openFileOnClient } from '../utils/openFileOnClient';
import { normalizePathForOpen } from '../utils/filePathForOpen';
import EmptyState from './ui/EmptyState';
import { Assignment } from '@mui/icons-material';
import { getTaskStatusLine } from './TaskTitleTwoLines';
import ActiveTaskCard from './ActiveTaskCard';
import {
  isInfoStatus,
  isSequenceBlocked
} from '../constants/taskStatuses';

function getDeadlineSortValue(task) {
  if (!task?.deadline) return Number.POSITIVE_INFINITY;
  const value = new Date(task.deadline).getTime();
  return Number.isNaN(value) ? Number.POSITIVE_INFINITY : value;
}

function isBlockedActiveTask(task) {
  const statusLabel = getTaskStatusLine(task);
  return isInfoStatus(statusLabel) || isSequenceBlocked(task, statusLabel) || task?.status === 8;
}

export default function ActiveTasksList({
  onUpdate,
  sectionTitle,
  sectionIcon,
  sectionSx,
  employee = ''
}) {
  const { showError, showWarning, confirm } = useUiFeedback();
  const { data: tasks = [] } = useActiveTasksQuery(employee, Boolean(employee));
  const [pendingTaskId, setPendingTaskId] = useState(null);
  const pendingTaskIdRef = useRef(null);
  const [blockedBottomSort, setBlockedBottomSort] = useState(true);
  const [sortAnchorEl, setSortAnchorEl] = useState(null);
  const sortMenuOpen = Boolean(sortAnchorEl);

  const visibleTasks = useMemo(() => {
    return tasks
      .map((task, index) => ({ task, index }))
      .sort((a, b) => {
        if (blockedBottomSort) {
          const blockedDiff = Number(isBlockedActiveTask(a.task)) - Number(isBlockedActiveTask(b.task));
          if (blockedDiff) return blockedDiff;
        }

        const deadlineDiff = getDeadlineSortValue(a.task) - getDeadlineSortValue(b.task);
        return deadlineDiff || a.index - b.index;
      })
      .map(({ task }) => task);
  }, [tasks, blockedBottomSort]);

  const setPendingTask = useCallback((taskId) => {
    pendingTaskIdRef.current = taskId;
    setPendingTaskId(taskId);
  }, []);

  const handleOpenSortMenu = useCallback((event) => {
    setSortAnchorEl(event.currentTarget);
  }, []);

  const handleCloseSortMenu = useCallback(() => {
    setSortAnchorEl(null);
  }, []);

  const handleToggleBlockedBottomSort = useCallback(() => {
    setBlockedBottomSort((prev) => !prev);
  }, []);

  const runGuardedAction = useCallback(async (task, action, progress = null) => {
    if (pendingTaskIdRef.current != null) return;
    setPendingTask(task.id);

    const runApi = async () => {
      if (action === 'start') await startTask(task.id);
      else if (action === 'pause') await pauseTask(task.id);
      else if (action === 'resume') await resumeTask(task.id);
      else if (action === 'progress') await setProgress(task.id, progress);
      else if (action === 'complete') await completeTask(task.id);
      await onUpdate();
    };

    try {
      await runWorkflowWithSequenceGuard({
        task,
        statusText: getTaskStatusLine(task),
        confirm,
        resolveStatus: async (t, targetStatus, extra) => {
          await updateTaskRow(t.id, buildTaskUpdatePayload(t, employee, targetStatus, extra));
        },
        runAction: runApi
      });
    } catch (err) {
      console.error('Ошибка действия:', err);
      showError(err.message || 'Не удалось выполнить действие');
    } finally {
      setPendingTask(null);
    }
  }, [confirm, employee, onUpdate, setPendingTask, showError]);

  const openFile = useCallback((filePath) => {
    if (!filePath) {
      showWarning('Путь к файлу не указан');
      return;
    }
    const parts = String(filePath).replace(/\\/g, '/').split('/');
    const fileName = parts.pop() || '';
    const folderPath = parts.join('/');
    const result = openFileOnClient(normalizePathForOpen(folderPath, fileName));
    if (!result.ok) showError('Не удалось открыть файл');
  }, [showError, showWarning]);

  const sortControls = (
    <>
      <Tooltip title="Сортировка">
        <IconButton
          size="small"
          onClick={handleOpenSortMenu}
          color={blockedBottomSort ? 'primary' : 'default'}
          aria-label="Сортировка активных задач"
          sx={[
            blockedBottomSort && { border: '1px solid', borderColor: 'primary.main' }
          ]}
        >
          <Sort fontSize="small" />
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={sortAnchorEl}
        open={sortMenuOpen}
        onClose={handleCloseSortMenu}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        <MenuItem onClick={handleToggleBlockedBottomSort}>
          <Checkbox
            size="small"
            checked={blockedBottomSort}
            disableRipple
            tabIndex={-1}
            sx={{ pointerEvents: 'none' }}
          />
          <ListItemText primary="Заблокированные снизу" />
        </MenuItem>
      </Menu>
    </>
  );

  const taskStack = (
    <Stack spacing={2}>
      {visibleTasks.map((task, index) => {
        const showBlockedDivider =
          blockedBottomSort &&
          index > 0 &&
          !isBlockedActiveTask(visibleTasks[index - 1]) &&
          isBlockedActiveTask(task);

        return (
          <Fragment key={task.id}>
            {showBlockedDivider && (
              <Divider sx={{ my: 0.5 }}>
                <Typography variant="caption" color="text.secondary">
                  Заблокированные
                </Typography>
              </Divider>
            )}
            <ActiveTaskCard
              task={task}
              isPending={pendingTaskId === task.id}
              lifecycleBusy={pendingTaskId != null}
              onAction={runGuardedAction}
              onOpenFile={openFile}
            />
          </Fragment>
        );
      })}
      {tasks.length === 0 && <EmptyState message="Нет активных задач" icon={Assignment} />}
    </Stack>
  );

  if (sectionTitle) {
    return (
      <Paper variant="section" sx={sectionSx}>
        <Box
          sx={{
            ...sectionTitleRowSx,
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 1,
            mb: 3
          }}
        >
          <Box sx={sectionTitleRowSx}>
            {sectionIcon}
            <Typography variant="h2" component="h2">
              {sectionTitle}
            </Typography>
          </Box>
          {sortControls}
        </Box>
        {taskStack}
      </Paper>
    );
  }

  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="h2" sx={{ mb: 2 }}>
        Активные задачи
      </Typography>
      {taskStack}
    </Box>
  );
}
