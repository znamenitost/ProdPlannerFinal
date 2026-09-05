import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box,
  Paper,
  Typography
} from '@mui/material';
import { ViewTimeline } from '@mui/icons-material';
import { useQueryClient } from '@tanstack/react-query';
import useDayPlanQuery from '../../hooks/queries/useDayPlanQuery';
import useDayPlanRankMutation from '../../hooks/queries/useDayPlanRankMutation';
import useDayPlanLifecycle from '../../hooks/useDayPlanLifecycle';
import useTaskFileOpen from '../../hooks/useTaskFileOpen';
import useCdrPreview from '../../hooks/useCdrPreview';
import { CalendarLoadingState } from '../LoadingState';
import EmptyState from '../ui/EmptyState';
import CdrPreviewDialog from '../CdrPreviewDialog';
import CommentDialog from '../CommentDialog';
import SplitTaskModal from '../SplitTaskModal';
import DayPlanCanvas from './DayPlanCanvas';
import { planableUnplanned } from '../../utils/dayPlanBoard';
import { DEV_CDR_PREVIEW_ENABLED } from '../../utils/devCdrPreviewConfig';
import { sectionHeaderSx, sectionTitleRowSx } from '../../theme/surfaces';
import { useUiFeedback } from '../../context/UiFeedbackContext';
import { queryKeys } from '../../lib/queryKeys';
import { getSplitChildren, getTableRow } from '../../services/api';
import { childrenToModalParts, taskToModalParts } from '../../utils/splitTaskUtils';
import {
  getDayPlanCommentOpenTask,
  getDayPlanSplitParentId
} from '../../utils/dayPlanCardIdentity';
import {
  SUPPLY_MODE_INTERNAL,
  TASK_EXECUTION_PARALLEL,
  TASK_EXECUTION_SEQUENTIAL
} from '../../constants/taskStatuses';
import { TASK_TABLE_EMPLOYEES, TASK_TABLE_TYPES } from '../../hooks/taskTable/taskTableConstants';

export default function DayPlanPage({ employee, isAdmin = false }) {
  const { showError } = useUiFeedback();
  const queryClient = useQueryClient();
  const { handleOpenFolder, handleOpenFile } = useTaskFileOpen();
  const { runAction, pendingTaskId } = useDayPlanLifecycle(employee);
  const cdrPreview = useCdrPreview();
  const [commentTask, setCommentTask] = useState(null);
  const [splitModalOpen, setSplitModalOpen] = useState(false);
  const [splitModalTask, setSplitModalTask] = useState(null);
  const [splitModalInitialParts, setSplitModalInitialParts] = useState(null);

  const { data: plan, isPending, isError } = useDayPlanQuery(employee);
  const { assign, pending } = useDayPlanRankMutation(employee);

  useEffect(() => {
    if (isError) showError('Не удалось загрузить план');
  }, [isError, showError]);

  const unplanned = useMemo(() => planableUnplanned(plan?.unplanned), [plan]);

  const handleOpenComment = useCallback((task) => {
    const openTask = getDayPlanCommentOpenTask(task);
    if (!openTask?.id) return;
    setCommentTask(openTask);
  }, []);

  const handleOpenAssignees = useCallback(async (task) => {
    if (!task?.id) return;
    const parentId = getDayPlanSplitParentId(task);
    try {
      if (parentId) {
        const [parent, children] = await Promise.all([
          getTableRow(parentId, employee),
          getSplitChildren(parentId)
        ]);
        setSplitModalTask({
          id: parent.id,
          estimateHours: parent.estimateHours,
          fileName: parent.fileName,
          folderPath: parent.folderPath,
          taskExecutionMode: parent.supplyMode === SUPPLY_MODE_INTERNAL
            ? TASK_EXECUTION_SEQUENTIAL
            : TASK_EXECUTION_PARALLEL
        });
        setSplitModalInitialParts(childrenToModalParts(children, TASK_TABLE_EMPLOYEES, TASK_TABLE_TYPES));
        setSplitModalOpen(true);
        return;
      }

      const row = await getTableRow(task.id, employee);
      setSplitModalTask({
        id: row.id,
        estimateHours: row.estimateHours,
        fileName: row.fileName,
        folderPath: row.folderPath
      });
      setSplitModalInitialParts(taskToModalParts(row, TASK_TABLE_EMPLOYEES, TASK_TABLE_TYPES));
      setSplitModalOpen(true);
    } catch (err) {
      showError(err.message || 'Не удалось открыть назначения');
    }
  }, [employee, showError]);

  const handleSplitSuccess = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.dayPlanAll(employee) });
    queryClient.invalidateQueries({ queryKey: queryKeys.taskTableAll() });
  }, [queryClient, employee]);

  const handleCommentChanged = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: queryKeys.dayPlanAll(employee) });
    queryClient.invalidateQueries({ queryKey: queryKeys.taskTableAll() });
  }, [queryClient, employee]);

  if (!employee) {
    return (
      <Paper variant="section">
        <EmptyState message="Выберите сотрудника в шапке, чтобы увидеть план" />
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
          <Typography variant="h2">План</Typography>
        </Box>
      </Box>

      <DayPlanCanvas
        plan={plan}
        unplanned={unplanned}
        canEdit={isAdmin}
        onAssign={assign}
        onOpenFolder={handleOpenFolder}
        onOpenFile={handleOpenFile}
        onOpenComment={handleOpenComment}
        onOpenAssignees={isAdmin ? handleOpenAssignees : undefined}
        employee={employee}
        isAdmin={isAdmin}
        onAction={runAction}
        showActions
        pendingTaskId={pendingTaskId}
        onShowCdrPreview={DEV_CDR_PREVIEW_ENABLED ? cdrPreview.handleShowCdrPreview : undefined}
        isCdrPreviewBuilding={cdrPreview.isCdrPreviewBuilding}
        pending={pending}
      />
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
        open={Boolean(commentTask)}
        task={commentTask}
        onChanged={handleCommentChanged}
        onClose={() => setCommentTask(null)}
      />
      {isAdmin && (
        <SplitTaskModal
          open={splitModalOpen}
          mode="edit"
          task={splitModalTask}
          initialParts={splitModalInitialParts}
          employees={TASK_TABLE_EMPLOYEES}
          taskTypes={TASK_TABLE_TYPES}
          taskExecutionMode={splitModalTask?.taskExecutionMode}
          onClose={() => setSplitModalOpen(false)}
          onSuccess={handleSplitSuccess}
        />
      )}
    </Paper>
  );
}
