import { useCallback } from 'react';
import { combineDateTime, DEFAULT_TIME } from '../../utils/dateTimeHelpers';

export default function useTaskTableActions({
  api,
  refresh,
  refreshChildren,
  loadChildrenForParent,
  expandParent,
  newRow,
  setNewRow,
  setEditingId,
  showError,
  showWarning,
  confirm
}) {
  const handleSaveNewRow = useCallback(async () => {
    if (!newRow.isSharedTask && !newRow.employeeName) {
      showWarning('Выберите сотрудника или настройте общую задачу');
      return;
    }

    const payload = {
      folderPath: newRow.folderPath,
      fileName: newRow.fileName,
      comment: newRow.comment,
      deadline: newRow.deadline,
      estimateHours: newRow.estimateHours,
      parentRowNumber: null
    };

    if (newRow.isSharedTask && newRow.assigneeParts?.length >= 2) {
      payload.parts = newRow.assigneeParts;
      payload.estimateHours = newRow.assigneeParts.reduce(
        (s, p) => s + (p.allocatedHours || 0),
        0
      );
    } else {
      const hours = parseFloat(newRow.estimateHours);
      if (!hours || hours <= 0) {
        showWarning('Укажите количество часов');
        return;
      }
      payload.estimateHours = hours;
      payload.type = (newRow.types || []).join(', ');
      payload.employeeName = newRow.employeeName;
    }

    try {
      const created = await api.createRow(payload);
      setNewRow(null);
      refresh();
      if (newRow.isSharedTask && created?.id) {
        expandParent(created.id);
        await loadChildrenForParent(created.id);
      }
    } catch (err) {
      console.error('Ошибка сохранения:', err);
      showError(err.message || 'Ошибка сохранения задачи');
    }
  }, [
    api,
    newRow,
    refresh,
    setNewRow,
    expandParent,
    loadChildrenForParent,
    showError,
    showWarning
  ]);

  const handleUpdateRow = useCallback(async (row) => {
    try {
      await api.updateRow(row.id, {
        folderPath: row.folderPath,
        fileName: row.fileName,
        comment: row.comment,
        deadline: row.deadline,
        estimateHours: row.estimateHours,
        type: row.type,
        employeeName: row.employeeName,
        parentRowNumber: row.parentRowNumber,
        statusText: row.statusText
      });
      setEditingId(null);
      refresh();
    } catch (err) {
      console.error('Ошибка обновления:', err);
      showError('Ошибка обновления задачи');
    }
  }, [api, refresh, setEditingId, showError]);

  const runLifecycleAction = useCallback(async (action, row) => {
    try {
      await action(row.id);
      refresh();
      if (row.parentRowNumber) {
        await refreshChildren(row.parentRowNumber);
      }
    } catch (err) {
      console.error(err);
    }
  }, [refresh, refreshChildren]);

  const handleStartTask = useCallback(
    (row) => runLifecycleAction(api.startTask, row),
    [api.startTask, runLifecycleAction]
  );
  const handlePauseTask = useCallback(
    (row) => runLifecycleAction(api.pauseTask, row),
    [api.pauseTask, runLifecycleAction]
  );
  const handleResumeTask = useCallback(
    (row) => runLifecycleAction(api.resumeTask, row),
    [api.resumeTask, runLifecycleAction]
  );
  const handleCompleteTask = useCallback(
    (row) => runLifecycleAction(api.completeTask, row),
    [api.completeTask, runLifecycleAction]
  );

  const handleDeleteRow = useCallback(async (id) => {
    const confirmed = await confirm({
      title: 'Удалить задачу?',
      message: 'Задача будет удалена без возможности восстановления.',
      confirmLabel: 'Удалить',
      confirmColor: 'error',
    });
    if (!confirmed) return;
    try {
      await api.deleteRow(id);
      refresh();
    } catch (err) {
      console.error(err);
    }
  }, [api, refresh, confirm]);

  const handleAddNewRow = useCallback(() => {
    const today = new Date().toISOString().slice(0, 10);
    setNewRow({
      folderPath: '',
      fileName: '',
      comment: '',
      deadline: combineDateTime(today, DEFAULT_TIME),
      estimateHours: '',
      types: [],
      employeeName: '',
      assigneeParts: null,
      isSharedTask: false,
      parentRowNumber: null
    });
  }, [setNewRow]);

  return {
    handleSaveNewRow,
    handleUpdateRow,
    handleStartTask,
    handlePauseTask,
    handleResumeTask,
    handleCompleteTask,
    handleDeleteRow,
    handleAddNewRow
  };
}
