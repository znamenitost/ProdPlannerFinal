import { useState, useCallback, useRef } from 'react';
import { childrenToModalParts, apiPartsToModalParts, taskToModalParts } from '../../utils/splitTaskUtils';
import { SUPPLY_MODE_INTERNAL, TASK_EXECUTION_PARALLEL, TASK_EXECUTION_SEQUENTIAL } from '../../constants/taskStatuses';

export default function useTaskTableModals({
  api,
  employees,
  taskTypes,
  childrenCache,
  setChildrenForParent,
  loadChildrenForParent,
  clearChildrenCache,
  invalidateChildCache,
  refreshChildren,
  patchChildInCache,
  expandedRows,
  editingId,
  patchRow,
  selectedEmployeeForHighlight,
  newRow,
  setNewRow,
  showError,
  applyPlanningWarnings
}) {
  const [splitModalOpen, setSplitModalOpen] = useState(false);
  const [splitModalMode, setSplitModalMode] = useState('split');
  const [splitModalTask, setSplitModalTask] = useState(null);
  const [splitModalInitialParts, setSplitModalInitialParts] = useState(null);
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [selectedCommentTask, setSelectedCommentTask] = useState(null);
  const [commentSaving, setCommentSaving] = useState(false);
  const savingCommentRef = useRef(false);

  const closeSplitModal = useCallback(() => {
    setSplitModalOpen(false);
    setSplitModalTask(null);
    setSplitModalInitialParts(null);
  }, []);

  const handleOpenNewSharedModal = useCallback(() => {
    setSplitModalMode('draft');
    setSplitModalTask({
      estimateHours: newRow.estimateHours,
      fileName: newRow.fileName,
      folderPath: newRow.folderPath,
      taskExecutionMode: newRow.taskExecutionMode
    });
    let initialParts = apiPartsToModalParts(newRow.assigneeParts, employees, taskTypes);
    if (!initialParts?.length && newRow.employeeName) {
      initialParts = [{
        employeeName: newRow.employeeName,
        taskTypes: newRow.types?.length ? newRow.types : [],
        hours: Number(newRow.estimateHours) || 0
      }];
    }
    setSplitModalInitialParts(initialParts);
    setSplitModalOpen(true);
  }, [newRow, employees, taskTypes]);

  const handleDraftApply = useCallback((apiParts, _parts, executionMode) => {
    const isShared = apiParts.length >= 2;
    const totalFromParts = apiParts.reduce((s, p) => s + (p.allocatedHours || 0), 0);
    const taskExecutionMode = executionMode || TASK_EXECUTION_PARALLEL;
    if (isShared) {
      setNewRow(prev => ({
        ...prev,
        assigneeParts: apiParts,
        isSharedTask: true,
        estimateHours: totalFromParts,
        employeeName: '',
        types: [],
        taskExecutionMode
      }));
    } else {
      const part = apiParts[0];
      const types = part.taskType
        ? part.taskType.split(',').map(s => s.trim()).filter(Boolean)
        : [];
      setNewRow(prev => ({
        ...prev,
        assigneeParts: null,
        isSharedTask: false,
        estimateHours: totalFromParts,
        employeeName: part.employeeName,
        types,
        taskExecutionMode: TASK_EXECUTION_PARALLEL,
        requiresTestBeforeProduction: Boolean(part.requiresTestBeforeProduction),
        testEstimateHours: part.testEstimateHours ?? 0,
        productionEstimateHours: part.productionEstimateHours ?? 0,
      }));
    }
  }, [setNewRow]);

  const openEditSharedModal = useCallback(async (task) => {
    let children = childrenCache.get(task.id);
    if (!children?.length) {
      children = await api.loadChildren(task.id);
      setChildrenForParent(task.id, children);
    }
    setSplitModalMode('edit');
    setSplitModalTask({
      id: task.id,
      estimateHours: task.estimateHours,
      fileName: task.fileName,
      folderPath: task.folderPath,
      taskExecutionMode: task.supplyMode === SUPPLY_MODE_INTERNAL
        ? TASK_EXECUTION_SEQUENTIAL
        : 'parallel'
    });
    setSplitModalInitialParts(childrenToModalParts(children, employees, taskTypes));
    setSplitModalOpen(true);
  }, [api, childrenCache, employees, setChildrenForParent, taskTypes]);

  const handleOpenAssigneeModal = useCallback(async (task) => {
    try {
      if (task.isSplitTask) {
        await openEditSharedModal(task);
        return;
      }
      setSplitModalMode('edit');
      setSplitModalTask({
        id: task.id,
        estimateHours: task.estimateHours,
        fileName: task.fileName,
        folderPath: task.folderPath
      });
      setSplitModalInitialParts(taskToModalParts(task, employees, taskTypes));
      setSplitModalOpen(true);
    } catch (err) {
      showError(err.message || 'Не удалось открыть назначения');
    }
  }, [employees, openEditSharedModal, showError, taskTypes]);

  const handleSplitSuccess = useCallback(async (result) => {
    const parentId = splitModalTask?.id;
    applyPlanningWarnings(result?.planningWarnings);
    try {
      if (parentId) {
        const employee = selectedEmployeeForHighlight || '';
        const updatedRow = await api.fetchTableRow(parentId, employee);
        patchRow(parentId, updatedRow);

        invalidateChildCache(parentId);
        const children = await api.loadChildren(parentId);
        setChildrenForParent(parentId, children);
        if (expandedRows.has(parentId)) {
          await loadChildrenForParent(parentId, { force: true });
        }
      }
    } catch (err) {
      console.error(err);
      showError(err.message || 'Не удалось обновить назначения');
    }
  }, [
    api,
    applyPlanningWarnings,
    expandedRows,
    invalidateChildCache,
    loadChildrenForParent,
    patchRow,
    selectedEmployeeForHighlight,
    setChildrenForParent,
    showError,
    splitModalTask?.id
  ]);

  const handleOpenComment = useCallback((row) => {
    setSelectedCommentTask(row);
    setCommentDialogOpen(true);
  }, []);

  const handleSaveComment = useCallback(async (newComment) => {
    if (!selectedCommentTask || savingCommentRef.current) return;

    savingCommentRef.current = true;
    setCommentSaving(true);
    const task = selectedCommentTask;
    const previousComment = String(task.comment || '');
    const commentChanged = String(newComment || '') !== previousComment;
    try {
      await api.updateRow(task.id, {
        folderPath: task.folderPath ?? '',
        fileName: task.fileName ?? '',
        comment: newComment,
        deadline: task.deadline,
        estimateHours: task.estimateHours ?? 0,
        type: task.type ?? '',
        employeeName: task.employeeName ?? '',
        parentRowNumber: task.parentRowNumber ?? null,
        expectedUpdatedAt: task.updatedAt ?? null,
        commentEditedViaDialog: commentChanged
      });

      const commentPatch = { comment: newComment };
      if (commentChanged || task.commentEditedViaDialog) {
        commentPatch.commentEditedViaDialog = true;
      }

      const parentId = task.parentRowNumber;
      if (parentId) {
        patchChildInCache(task.id, commentPatch);
        invalidateChildCache(parentId);
        const children = await api.loadChildren(parentId);
        setChildrenForParent(parentId, children);
      } else {
        patchRow(task.id, commentPatch);
      }

      setCommentDialogOpen(false);
      setSelectedCommentTask(null);
    } catch (err) {
      console.error(err);
      showError('Ошибка сохранения комментария');
    } finally {
      savingCommentRef.current = false;
      setCommentSaving(false);
    }
  }, [
    api,
    invalidateChildCache,
    patchChildInCache,
    patchRow,
    selectedCommentTask,
    setChildrenForParent,
    showError
  ]);

  const setCommentDialogOpenStable = useCallback((open) => {
    setCommentDialogOpen(open);
  }, []);

  return {
    splitModalOpen,
    splitModalMode,
    splitModalTask,
    splitModalInitialParts,
    commentDialogOpen,
    selectedCommentTask,
    commentSaving,
    closeSplitModal,
    handleOpenNewSharedModal,
    handleDraftApply,
    handleOpenAssigneeModal,
    handleSplitSuccess,
    handleOpenComment,
    handleSaveComment,
    setCommentDialogOpen: setCommentDialogOpenStable
  };
}
