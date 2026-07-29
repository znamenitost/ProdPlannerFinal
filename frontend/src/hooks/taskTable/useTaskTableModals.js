import { useState, useCallback } from 'react';
import { childrenToModalParts, apiPartsToModalParts, taskToModalParts } from '../../utils/splitTaskUtils';
import { SUPPLY_MODE_INTERNAL, TASK_EXECUTION_PARALLEL, TASK_EXECUTION_SEQUENTIAL } from '../../constants/taskStatuses';
import { getTaskComments } from '../../services/api';

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

  const closeSplitModal = useCallback(() => {
    setSplitModalOpen(false);
    setSplitModalTask(null);
    setSplitModalInitialParts(null);
  }, []);

  const handleOpenNewSharedModal = useCallback((draftOverride = null) => {
    const source = draftOverride || newRow;
    if (!source) return;

    // Синхронизируем текстовые поля локального draft в parent state до открытия модалки.
    if (draftOverride) setNewRow(draftOverride);

    setSplitModalMode('draft');
    setSplitModalTask({
      estimateHours: source.estimateHours,
      fileName: source.fileName,
      folderPath: source.folderPath,
      taskExecutionMode: source.taskExecutionMode
    });
    let initialParts = apiPartsToModalParts(source.assigneeParts, employees, taskTypes);
    if (!initialParts?.length && source.employeeName) {
      initialParts = [{
        employeeName: source.employeeName,
        taskTypes: source.types?.length ? source.types : [],
        hours: Number(source.estimateHours) || 0
      }];
    }
    setSplitModalInitialParts(initialParts);
    setSplitModalOpen(true);
  }, [newRow, employees, taskTypes, setNewRow]);

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

  const applyCommentPreview = useCallback(async (taskId) => {
    const task = selectedCommentTask;
    if (!task || task.id !== taskId) return;

    setCommentSaving(true);
    try {
      const data = await getTaskComments(taskId);
      const commentPatch = {
        comment: data?.preview ?? '',
        commentEditedViaDialog: (data?.comments?.length ?? 0) > 0,
        commentBadgeCount: 0
      };

      const parentId = task.parentRowNumber;
      if (parentId) {
        patchChildInCache(task.id, commentPatch);
        invalidateChildCache(parentId);
        const children = await api.loadChildren(parentId);
        setChildrenForParent(parentId, children);
      } else {
        patchRow(task.id, commentPatch);
      }
      setSelectedCommentTask((prev) => (prev ? { ...prev, ...commentPatch } : prev));
    } catch (err) {
      console.error(err);
      showError('Ошибка обновления комментария');
    } finally {
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
    if (!open) setSelectedCommentTask(null);
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
    handleCommentChanged: applyCommentPreview,
    setCommentDialogOpen: setCommentDialogOpenStable
  };
}
