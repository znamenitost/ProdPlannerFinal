import { useCallback, useState } from 'react';
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
  const [pendingLifecycleTaskId, setPendingLifecycleTaskId] = useState(null);

  const handleSaveNewRow = useCallback(async () => {
    const isShared = newRow.isSharedTask && newRow.assigneeParts?.length >= 2;
    const hasSingleAssignee = Boolean(newRow.employeeName);

    if (!isShared && !hasSingleAssignee) {
      showWarning('Назначьте сотрудника и часы через иконку участников');
      return;
    }

    const payload = {
      folderPath: newRow.folderPath,
      fileName: newRow.fileName,
      comment: newRow.comment,
      deadline: newRow.deadline,
      parentRowNumber: null
    };

    if (isShared) {
      payload.parts = newRow.assigneeParts;
      payload.estimateHours = newRow.assigneeParts.reduce(
        (s, p) => s + (p.allocatedHours || 0),
        0
      );
    } else {
      const hours = parseFloat(newRow.estimateHours);
      if (!hours || hours < 0.5 || hours > 24) {
        showWarning('Укажите часы в назначениях (от 0.5 до 24)');
        return;
      }
      payload.estimateHours = hours;
      payload.type = (newRow.types || []).join(', ');
      payload.employeeName = newRow.employeeName;
    }

    try {
      const created = await api.createRow(payload);
      setNewRow(null);
      await refresh();
      if (newRow.isSharedTask && created?.id) {
        await loadChildrenForParent(created.id);
        expandParent(created.id);
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
      await refresh();
    } catch (err) {
      console.error('Ошибка обновления:', err);
      showError('Ошибка обновления задачи');
    }
  }, [api, refresh, setEditingId, showError]);

  const runLifecycleAction = useCallback(async (action, row) => {
    if (pendingLifecycleTaskId === row.id) return;

    setPendingLifecycleTaskId(row.id);
    try {
      await action(row.id);
      await refresh();
      if (row.parentRowNumber) {
        await refreshChildren(row.parentRowNumber);
      }
    } catch (err) {
      console.error(err);
      if (err?.code === 'concurrency_conflict') {
        await refresh();
        if (row.parentRowNumber) {
          await refreshChildren(row.parentRowNumber);
        }
      }
      showError(err.message || 'Не удалось выполнить действие с задачей');
    } finally {
      setPendingLifecycleTaskId(null);
    }
  }, [pendingLifecycleTaskId, refresh, refreshChildren, showError]);

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
    pendingLifecycleTaskId,
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
