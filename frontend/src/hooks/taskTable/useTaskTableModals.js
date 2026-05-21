import { useState } from 'react';
import { childrenToModalParts, apiPartsToModalParts, taskToModalParts } from '../../utils/splitTaskUtils';

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
  showError
}) {
  const [splitModalOpen, setSplitModalOpen] = useState(false);
  const [splitModalMode, setSplitModalMode] = useState('split');
  const [splitModalTask, setSplitModalTask] = useState(null);
  const [splitModalInitialParts, setSplitModalInitialParts] = useState(null);
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [selectedCommentTask, setSelectedCommentTask] = useState(null);

  const closeSplitModal = () => {
    setSplitModalOpen(false);
    setSplitModalTask(null);
    setSplitModalInitialParts(null);
  };

  const handleOpenNewSharedModal = () => {
    setSplitModalMode('draft');
    setSplitModalTask({
      estimateHours: newRow.estimateHours,
      fileName: newRow.fileName,
      folderPath: newRow.folderPath
    });
    let initialParts = apiPartsToModalParts(newRow.assigneeParts, employees, taskTypes);
    if (!initialParts?.length && newRow.employeeName) {
      initialParts = [{
        employeeName: newRow.employeeName,
        taskTypes: newRow.types?.length ? newRow.types : [taskTypes[0]],
        hours: Number(newRow.estimateHours) || 0
      }];
    }
    setSplitModalInitialParts(initialParts);
    setSplitModalOpen(true);
  };

  const handleDraftApply = (apiParts) => {
    const isShared = apiParts.length >= 2;
    const totalFromParts = apiParts.reduce((s, p) => s + (p.allocatedHours || 0), 0);
    if (isShared) {
      setNewRow(prev => ({
        ...prev,
        assigneeParts: apiParts,
        isSharedTask: true,
        estimateHours: totalFromParts,
        employeeName: '',
        types: []
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
        types
      }));
    }
  };

  const openEditSharedModal = async (task) => {
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
      folderPath: task.folderPath
    });
    setSplitModalInitialParts(childrenToModalParts(children, employees, taskTypes));
    setSplitModalOpen(true);
  };

  const handleOpenAssigneeModal = async (task) => {
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
  };

  const handleSplitSuccess = async (result) => {
    const parentId = splitModalTask?.id;
    if (parentId && result) {
      const rowPatch = {
        estimateHours: result.estimateHours,
        isSplitTask: result.isSplitTask,
        employeeName: result.employeeName ?? '',
        type: result.type ?? ''
      };
      if (!result.isSplitTask) {
        rowPatch.splitEmployeeNames = '';
      }
      patchRow(parentId, rowPatch);
    }
    if (parentId) {
      invalidateChildCache(parentId);
      const children = await api.loadChildren(parentId);
      setChildrenForParent(parentId, children);
      if (expandedRows.has(parentId)) {
        await loadChildrenForParent(parentId, { force: true });
      }
    }
  };

  const handleOpenComment = (row) => {
    setSelectedCommentTask(row);
    setCommentDialogOpen(true);
  };

  const handleSaveComment = async (newComment, updateRow) => {
    if (!selectedCommentTask) return;
    const task = selectedCommentTask;
    const updatedTask = { ...task, comment: newComment };
    try {
      await updateRow(updatedTask.id, updatedTask);

      const parentId = task.parentRowNumber;
      if (parentId) {
        patchChildInCache(task.id, { comment: newComment });
        invalidateChildCache(parentId);
        const children = await api.loadChildren(parentId);
        setChildrenForParent(parentId, children);
      } else {
        patchRow(task.id, { comment: newComment });
      }

      setCommentDialogOpen(false);
      setSelectedCommentTask(null);
    } catch (err) {
      console.error(err);
      showError('Ошибка сохранения комментария');
    }
  };

  return {
    splitModalOpen,
    splitModalMode,
    splitModalTask,
    splitModalInitialParts,
    commentDialogOpen,
    selectedCommentTask,
    closeSplitModal,
    handleOpenNewSharedModal,
    handleDraftApply,
    handleOpenAssigneeModal,
    handleSplitSuccess,
    handleOpenComment,
    handleSaveComment,
    setCommentDialogOpen
  };
}
