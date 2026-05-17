import { useState } from 'react';
import { childrenToModalParts, apiPartsToModalParts } from '../../components/SplitTaskModal';

export default function useTaskTableModals({
  api,
  employees,
  taskTypes,
  childrenCache,
  setChildrenForParent,
  loadChildrenForParent,
  clearChildrenCache,
  expandedRows,
  editingId,
  refresh,
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
    setSplitModalInitialParts(
      apiPartsToModalParts(newRow.assigneeParts, employees, taskTypes)
    );
    setSplitModalOpen(true);
  };

  const handleDraftApply = (apiParts) => {
    const isShared = apiParts.length >= 2;
    const totalFromParts = apiParts.reduce((s, p) => s + (p.allocatedHours || 0), 0);
    setNewRow(prev => ({
      ...prev,
      assigneeParts: isShared ? apiParts : null,
      isSharedTask: isShared,
      estimateHours: isShared ? totalFromParts : (prev.estimateHours === '' ? '' : prev.estimateHours)
    }));
  };

  const handleOpenEditSharedModal = async (task) => {
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

  const handleSplitTask = async (row) => {
    try {
      const task = await api.getTaskForSplit(row.employeeName, row.id);
      setSplitModalMode('split');
      setSplitModalTask({
        id: task.id,
        estimateHours: task.estimateHours,
        fileName: row.fileName,
        folderPath: row.folderPath
      });
      setSplitModalInitialParts(null);
      setSplitModalOpen(true);
    } catch (err) {
      showError(err.message);
    }
  };

  const handleSplitSuccess = async () => {
    const parentId = splitModalTask?.id;
    if (splitModalMode === 'edit' && editingId === parentId) {
      const children = await api.loadChildren(parentId);
      setChildrenForParent(parentId, children);
    }
    refresh();
    if (parentId) {
      if (splitModalMode !== 'edit') {
        clearChildrenCache(parentId);
      }
      if (expandedRows.has(parentId)) {
        await loadChildrenForParent(parentId);
      }
    }
  };

  const handleOpenComment = (row) => {
    setSelectedCommentTask(row);
    setCommentDialogOpen(true);
  };

  const handleSaveComment = async (newComment, updateRow) => {
    if (!selectedCommentTask) return;
    const updatedTask = { ...selectedCommentTask, comment: newComment };
    try {
      await updateRow(updatedTask.id, updatedTask);
      setCommentDialogOpen(false);
      setSelectedCommentTask(null);
      refresh();
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
    handleOpenEditSharedModal,
    handleSplitTask,
    handleSplitSuccess,
    handleOpenComment,
    handleSaveComment,
    setCommentDialogOpen
  };
}
