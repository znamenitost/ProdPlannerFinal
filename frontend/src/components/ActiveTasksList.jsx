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
import useAuth from '../hooks/useAuth';
import useUserPreference from '../hooks/useUserPreference';
import { openFileOnClient } from '../utils/openFileOnClient';
import { normalizePathForOpen } from '../utils/filePathForOpen';
import {
  ensureFileOpenSettingsLoaded,
  getFileOpenShareName
} from '../utils/fileOpenSettingsCache';
import EmptyState from './ui/EmptyState';
import { Assignment } from '@mui/icons-material';
import { getTaskStatusLine } from './TaskTitleTwoLines';
import ActiveTaskCard from './ActiveTaskCard';
import CdrPreviewDialog from './CdrPreviewDialog';
import {
  isInfoStatus,
  isSequenceBlocked
} from '../constants/taskStatuses';
import { promptFussStartComment } from '../utils/fussStart';
import { offerPrintLabelsAfterReady } from '../utils/printLabelPrompt';
import useCdrPreview from '../hooks/useCdrPreview';
import { DEV_CDR_PREVIEW_ENABLED } from '../utils/devCdrPreviewConfig';
import { formatUserActionError } from '../utils/actionError';
import { sortActiveTasksForEmployeeStack } from '../utils/taskPriorityRank';

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
  const { showError, showWarning, showSuccess, confirm, promptInput } = useUiFeedback();
  const { user } = useAuth();
  const { data: tasks = [] } = useActiveTasksQuery(employee, Boolean(employee));
  const [pendingTaskId, setPendingTaskId] = useState(null);
  const pendingTaskIdRef = useRef(null);
  const [blockedBottomSort, setBlockedBottomSort] = useUserPreference(
    user,
    'activeTasks.blockedBottomSort',
    true
  );
  const [sortAnchorEl, setSortAnchorEl] = useState(null);
  const sortMenuOpen = Boolean(sortAnchorEl);
  const cdrPreview = useCdrPreview();

  const visibleTasks = useMemo(
    () => sortActiveTasksForEmployeeStack(tasks, {
      blockedBottomSort,
      isBlocked: isBlockedActiveTask
    }),
    [tasks, blockedBottomSort]
  );

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

    let fussComment = null;
    if (action === 'start' && task?.isFuss) {
      fussComment = await promptFussStartComment(promptInput);
      if (!fussComment) return;
    }

    setPendingTask(task.id);

    let completeResult = null;
    const runApi = async () => {
      if (action === 'start') await startTask(task.id, fussComment);
      else if (action === 'pause') await pauseTask(task.id);
      else if (action === 'resume') await resumeTask(task.id);
      else if (action === 'progress') await setProgress(task.id, progress);
      else if (action === 'complete') completeResult = await completeTask(task.id);
      await onUpdate();
    };

    try {
      const ok = await runWorkflowWithSequenceGuard({
        task,
        statusText: getTaskStatusLine(task),
        confirm,
        resolveStatus: async (t, targetStatus, extra) => {
          await updateTaskRow(t.id, buildTaskUpdatePayload(t, employee, targetStatus, extra));
        },
        runAction: runApi
      });
      if (ok !== false && action === 'complete') {
        await offerPrintLabelsAfterReady(promptInput, task, {
          showSuccess,
          showError,
          parentTask: completeResult?.parentRow ?? null
        });
      }
    } catch (err) {
      console.error('Ошибка действия:', err);
      if (err?.code === 'concurrency_conflict') {
        await onUpdate();
      }
      showError(formatUserActionError(err, 'Не удалось выполнить действие'));
    } finally {
      setPendingTask(null);
    }
  }, [confirm, employee, onUpdate, promptInput, setPendingTask, showError, showSuccess]);

  const openFile = useCallback((filePath) => {
    if (!filePath) {
      showWarning('Путь к файлу не указан');
      return;
    }
    const parts = String(filePath).replace(/\\/g, '/').split('/');
    const fileName = parts.pop() || '';
    const folderPath = parts.join('/');
    void ensureFileOpenSettingsLoaded()
      .then(() => openFileOnClient(normalizePathForOpen(folderPath, fileName, getFileOpenShareName())))
      .then((result) => {
        if (!result.ok) {
          showError(result.reason || 'Не удалось открыть файл');
        }
      });
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
              onShowCdrPreview={DEV_CDR_PREVIEW_ENABLED ? cdrPreview.handleShowCdrPreview : undefined}
              cdrPreviewBuilding={cdrPreview.isCdrPreviewBuilding(task.id)}
            />
          </Fragment>
        );
      })}
      {tasks.length === 0 && <EmptyState message="Нет активных задач" icon={Assignment} />}
    </Stack>
  );

  const cdrPreviewDialog = DEV_CDR_PREVIEW_ENABLED ? (
    <CdrPreviewDialog
      open={cdrPreview.cdrPreviewOpen}
      anchor={cdrPreview.cdrPreviewAnchor}
      previewUrl={cdrPreview.cdrPreviewData?.url}
      previewError={cdrPreview.cdrPreviewData?.error}
      pending={cdrPreview.cdrPreviewPending}
    />
  ) : null;

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
        {cdrPreviewDialog}
      </Paper>
    );
  }

  return (
    <Box sx={{ mt: 3 }}>
      <Typography variant="h2" sx={{ mb: 2 }}>
        Активные задачи
      </Typography>
      {taskStack}
      {cdrPreviewDialog}
    </Box>
  );
}
