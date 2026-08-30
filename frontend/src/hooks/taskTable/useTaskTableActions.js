import { useCallback, useRef, useState } from 'react';
import { combineDateTime, DEFAULT_TIME } from '../../utils/dateTimeHelpers';
import {
  buildTaskUpdatePayload,
  createCustomerOrderLink
} from '../../services/api';
import { runWorkflowWithSequenceGuard } from '../../utils/supplyStatusWorkflow';
import {
  SUPPLY_MODE_COOPERATIVE,
  SUPPLY_MODE_INTERNAL,
  TASK_EXECUTION_PARALLEL,
  TASK_EXECUTION_SEQUENTIAL
} from '../../constants/taskStatuses';
import { unwrapTaskSaveResponse } from '../../utils/showPlanningWarnings';
import { DEV_CDR_PREVIEW_ENABLED } from '../../utils/devCdrPreviewConfig';
import {
  getDevCdrDefaultFolderPath,
  getDevCdrDefaultFileName
} from '../../utils/devCdrPreviewConfig';
import { startCdrAutoSearchAfterSave } from '../../utils/cdrAutoSearch';
import { promptFussStartComment } from '../../utils/fussStart';
import {
  offerPrintLabelsAfterReady,
  printOrderLabelWithQuantityPrompt
} from '../../utils/printLabelPrompt';
import { STATUS_COMPLETED } from '../../constants/taskStatuses';
import { formatUserActionError, USER_ACTION_MESSAGES } from '../../utils/actionError';

function kickOffCdrAutoSearch({
  taskId,
  folderPath,
  fileName,
  showWarning,
  showLoading,
  showSuccess,
  showInfo,
  progressMessage
}) {
  if (!DEV_CDR_PREVIEW_ENABLED || !taskId) return;
  startCdrAutoSearchAfterSave({
    taskId,
    folderPath,
    fileName,
    showWarning,
    showLoading,
    showSuccess,
    showInfo,
    progressMessage
  });
}

export default function useTaskTableActions({
  api,
  refresh,
  patchRow,
  removeRow,
  selectedEmployeeForHighlight,
  invalidateChildCache,
  setChildrenForParent,
  patchChildInCache,
  loadChildrenForParent,
  expandParent,
  newRow,
  setNewRow,
  setEditingId,
  onCalendarRefresh,
  showError,
  showWarning,
  showSuccess,
  showLoading,
  showInfo,
  confirm,
  promptInput,
  applyPlanningWarnings
}) {
  const [pendingLifecycleTaskId, setPendingLifecycleTaskId] = useState(null);
  const [savingNewRow, setSavingNewRow] = useState(false);
  const [savingRowId, setSavingRowId] = useState(null);
  const pendingLifecycleTaskIdRef = useRef(null);
  const pendingPriorityTaskIdRef = useRef(null);
  const savingNewRowRef = useRef(false);
  const savingRowIdRef = useRef(null);
  const deletingRowIdRef = useRef(null);

  const setPendingLifecycleTask = useCallback((taskId) => {
    pendingLifecycleTaskIdRef.current = taskId;
    setPendingLifecycleTaskId(taskId);
  }, []);

  const isNotFound = useCallback((err) => (
    err?.status === 404 || String(err?.message || '').includes('"status":404')
  ), []);

  const syncRowFromServer = useCallback(async (row) => {
    const employee = selectedEmployeeForHighlight || '';
    const parentId = row.parentRowNumber;

    try {
      if (parentId) {
        invalidateChildCache(parentId);
        const updatedChild = await api.fetchTableRow(row.id, employee);
        patchChildInCache(row.id, updatedChild);
        const children = await api.loadChildren(parentId);
        setChildrenForParent(parentId, children);
        const parentDto = await api.fetchTableRow(parentId, employee);
        patchRow(parentId, parentDto);
      } else {
        const updated = await api.fetchTableRow(row.id, employee);
        patchRow(row.id, updated);
      }
    } catch (err) {
      if (!isNotFound(err)) throw err;

      if (parentId) {
        const children = await api.loadChildren(parentId);
        setChildrenForParent(parentId, children);
        try {
          const parentDto = await api.fetchTableRow(parentId, employee);
          patchRow(parentId, parentDto);
        } catch (parentErr) {
          if (isNotFound(parentErr)) removeRow(parentId);
          else throw parentErr;
        }
      } else {
        removeRow(row.id);
      }
    }

    onCalendarRefresh?.();
  }, [
    api,
    selectedEmployeeForHighlight,
    invalidateChildCache,
    setChildrenForParent,
    patchChildInCache,
    patchRow,
    removeRow,
    isNotFound,
    onCalendarRefresh
  ]);

  const refreshParentRow = useCallback(async (parentId) => {
    const employee = selectedEmployeeForHighlight || '';
    try {
      const parentDto = await api.fetchTableRow(parentId, employee);
      patchRow(parentId, parentDto);
    } catch (err) {
      if (isNotFound(err)) removeRow(parentId);
      else throw err;
    }
  }, [api, selectedEmployeeForHighlight, patchRow, removeRow, isNotFound]);

  const applyLifecycleResult = useCallback(async (row, result) => {
    if (!result || typeof result !== 'object' || !('removedFromTable' in result)) {
      await syncRowFromServer(row);
      return;
    }

    const parentId = result.parentRowId ?? row.parentRowNumber;

    if (parentId) {
      invalidateChildCache(parentId);
      const children = await api.loadChildren(parentId);
      setChildrenForParent(parentId, children);

      if (result.row) {
        patchChildInCache(result.row.id, result.row);
      } else if (!result.removedFromTable) {
        try {
          const employee = selectedEmployeeForHighlight || '';
          const updatedChild = await api.fetchTableRow(row.id, employee);
          patchChildInCache(row.id, updatedChild);
        } catch (err) {
          if (!isNotFound(err)) throw err;
        }
      }

      if (result.parentRemovedFromTable) {
        removeRow(parentId);
      } else if (result.parentRow) {
        patchRow(parentId, result.parentRow);
      } else {
        await refreshParentRow(parentId);
      }
    } else if (result.removedFromTable) {
      removeRow(row.id);
    } else if (result.row) {
      patchRow(row.id, result.row);
    } else {
      await syncRowFromServer(row);
    }

    onCalendarRefresh?.();
  }, [
    api,
    syncRowFromServer,
    refreshParentRow,
    selectedEmployeeForHighlight,
    invalidateChildCache,
    setChildrenForParent,
    patchChildInCache,
    patchRow,
    removeRow,
    onCalendarRefresh
  ]);

  const handleSaveNewRow = useCallback(async (draft) => {
    const row = draft || newRow;
    if (!row) return;
    if (savingNewRowRef.current) {
      showInfo?.(USER_ACTION_MESSAGES.savingInProgress);
      return;
    }

    const isShared = row.isSharedTask && row.assigneeParts?.length >= 2;
    const hasSingleAssignee = Boolean(row.employeeName);

    if (!isShared && !hasSingleAssignee) {
      showWarning('Назначьте сотрудника и часы через иконку участников');
      return;
    }

    const payload = {
      folderPath: row.folderPath,
      fileName: row.fileName,
      comment: row.comment,
      deadline: row.deadline,
      parentRowNumber: null
    };

    if (isShared) {
      payload.parts = row.assigneeParts;
      payload.estimateHours = row.assigneeParts.reduce(
        (s, p) => s + (p.allocatedHours || 0),
        0
      );
      payload.supplyMode =
        row.taskExecutionMode === TASK_EXECUTION_SEQUENTIAL
          ? SUPPLY_MODE_INTERNAL
          : SUPPLY_MODE_COOPERATIVE;
    } else if (row.requiresTestBeforeProduction) {
      const testH = parseFloat(row.testEstimateHours);
      const prodH = parseFloat(row.productionEstimateHours);
      if (!testH || testH < 0.5 || !prodH || prodH < 0.5) {
        showWarning('Укажите часы теста и основной части (от 0.5)');
        return;
      }
      payload.requiresTestBeforeProduction = true;
      payload.testEstimateHours = testH;
      payload.productionEstimateHours = prodH;
      payload.estimateHours = testH + prodH;
      payload.type = (row.types || []).join(', ');
      payload.employeeName = row.employeeName;
    } else {
      const hours = parseFloat(row.estimateHours);
      if (!hours || hours < 0.5 || hours > 24) {
        showWarning('Укажите часы в назначениях (от 0.5 до 24)');
        return;
      }
      payload.estimateHours = hours;
      payload.type = (row.types || []).join(', ');
      payload.employeeName = row.employeeName;
    }

    savingNewRowRef.current = true;
    setSavingNewRow(true);
    showLoading?.(USER_ACTION_MESSAGES.savingTask);

    try {
      const raw = await api.createRow(payload);
      const { task: created, planningWarnings } = unwrapTaskSaveResponse(raw);
      applyPlanningWarnings(planningWarnings);
      const wasShared = row.isSharedTask;
      setNewRow(null);
      showSuccess(USER_ACTION_MESSAGES.taskCreated);
      if (created?.id) {
        kickOffCdrAutoSearch({
          taskId: created.id,
          folderPath: created.folderPath || payload.folderPath,
          fileName: created.fileName || payload.fileName,
          showWarning,
          showLoading,
          showSuccess,
          showInfo,
          progressMessage: USER_ACTION_MESSAGES.previewProgressAfterSave
        });
      }
      void refresh();
      if (wasShared && created?.id) {
        await loadChildrenForParent(created.id);
        expandParent(created.id);
      }
    } catch (err) {
      console.error('Ошибка сохранения:', err);
      showError(formatUserActionError(err, 'Не удалось сохранить задачу', {
        hint: USER_ACTION_MESSAGES.createRetryHint
      }));
    } finally {
      savingNewRowRef.current = false;
      setSavingNewRow(false);
    }
  }, [
    api,
    newRow,
    refresh,
    setNewRow,
    expandParent,
    loadChildrenForParent,
    showError,
    showWarning,
    showSuccess,
    showLoading,
    showInfo,
    applyPlanningWarnings
  ]);

  const handleUpdateRow = useCallback(async (row) => {
    if (savingRowIdRef.current === row.id) {
      showInfo?.(USER_ACTION_MESSAGES.savingInProgress);
      return;
    }

    savingRowIdRef.current = row.id;
    setSavingRowId(row.id);
    showLoading?.(USER_ACTION_MESSAGES.savingChanges);
    try {
      const raw = await api.updateRow(row.id, {
        folderPath: row.folderPath,
        fileName: row.fileName,
        comment: row.comment,
        deadline: row.deadline,
        estimateHours: row.estimateHours,
        type: row.type,
        employeeName: row.employeeName,
        parentRowNumber: row.parentRowNumber,
        expectedUpdatedAt: row.updatedAt ?? null
      });
      const { planningWarnings, replacedTaskId } = unwrapTaskSaveResponse(raw);
      applyPlanningWarnings(planningWarnings);
      if (replacedTaskId != null) {
        setEditingId(null);
        removeRow(replacedTaskId);
        void refresh();
        onCalendarRefresh?.();
        showSuccess(USER_ACTION_MESSAGES.taskUpdated);
      } else {
        setEditingId(null);
        showSuccess(USER_ACTION_MESSAGES.taskUpdated);
        kickOffCdrAutoSearch({
          taskId: row.id,
          folderPath: row.folderPath,
          fileName: row.fileName,
          showWarning,
          showLoading,
          showSuccess,
          showInfo,
          progressMessage: USER_ACTION_MESSAGES.previewProgressAfterUpdate
        });
        void syncRowFromServer(row);
      }
    } catch (err) {
      console.error('Ошибка обновления:', err);
      if (err?.code === 'concurrency_conflict') {
        await syncRowFromServer(row);
      }
      showError(formatUserActionError(err, 'Не удалось сохранить изменения'));
    } finally {
      savingRowIdRef.current = null;
      setSavingRowId(null);
    }
  }, [api, syncRowFromServer, setEditingId, showError, showWarning, showSuccess, showLoading, showInfo, applyPlanningWarnings, removeRow, refresh, onCalendarRefresh]);

  const runLifecycleAction = useCallback(async (action, row) => {
    if (pendingLifecycleTaskIdRef.current != null) return false;

    setPendingLifecycleTask(row.id);
    try {
      const ok = await runWorkflowWithSequenceGuard({
        task: row,
        statusText: row.statusText,
        confirm,
        resolveStatus: async (task, targetStatus, extra) => {
          await api.updateRow(
            task.id,
            buildTaskUpdatePayload(
              task,
              selectedEmployeeForHighlight || task.employeeName,
              targetStatus,
              extra
            )
          );
          await syncRowFromServer(task);
        },
        runAction: async () => {
          const result = await action(row.id, selectedEmployeeForHighlight || row.employeeName);
          await applyLifecycleResult(row, result);
        }
      });
      return ok !== false;
    } catch (err) {
      console.error(err);
      if (err?.code === 'concurrency_conflict') {
        await syncRowFromServer(row);
      }
      showError(formatUserActionError(err, 'Не удалось выполнить действие с задачей'));
      return false;
    } finally {
      setPendingLifecycleTask(null);
    }
  }, [
    syncRowFromServer,
    applyLifecycleResult,
    showError,
    confirm,
    api,
    selectedEmployeeForHighlight,
    setPendingLifecycleTask
  ]);

  const handleStartTask = useCallback(
    async (row) => {
      let comment = null;
      if (row?.isFuss) {
        comment = await promptFussStartComment(promptInput);
        if (!comment) return;
      }
      await runLifecycleAction(
        (id, employee) => api.startTask(id, employee, comment),
        row
      );
    },
    [api, promptInput, runLifecycleAction]
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
    async (row) => {
      let completeResult = null;
      const ok = await runLifecycleAction(async (id, employee) => {
        completeResult = await api.completeTask(id, employee);
        return completeResult;
      }, row);
      if (ok) {
        await offerPrintLabelsAfterReady(promptInput, row, {
          showSuccess,
          showError,
          parentTask: completeResult?.parentRow ?? null
        });
      }
    },
    [api, runLifecycleAction, promptInput, showSuccess, showError]
  );

  const handleSetStatus = useCallback(async (row, statusText, extra) => {
    if (pendingLifecycleTaskIdRef.current != null) return;

    setPendingLifecycleTask(row.id);
    try {
      await api.updateRow(row.id, buildTaskUpdatePayload(
        row,
        selectedEmployeeForHighlight || row.employeeName,
        statusText,
        extra
      ));
      await syncRowFromServer(row);
      if (statusText === STATUS_COMPLETED) {
        let parentTask = null;
        if (row.parentRowNumber) {
          try {
            parentTask = await api.fetchTableRow(
              row.parentRowNumber,
              selectedEmployeeForHighlight || row.employeeName
            );
          } catch {
            parentTask = null;
          }
        }
        await offerPrintLabelsAfterReady(promptInput, row, { showSuccess, showError, parentTask });
      }
    } catch (err) {
      console.error(err);
      if (err?.code === 'concurrency_conflict') {
        await syncRowFromServer(row);
      }
      showError(formatUserActionError(err, 'Не удалось изменить статус задачи'));
    } finally {
      setPendingLifecycleTask(null);
    }
  }, [
    api,
    syncRowFromServer,
    showError,
    showSuccess,
    setPendingLifecycleTask,
    selectedEmployeeForHighlight,
    promptInput
  ]);

  const handleSetPriorityRank = useCallback(async (row, rank, options = {}) => {
    if (pendingPriorityTaskIdRef.current === row.id) return;
    pendingPriorityTaskIdRef.current = row.id;
    try {
      await api.setPriorityRank(row.id, rank, options);
      await syncRowFromServer(row);
      await refresh();
      if (row.parentRowNumber) {
        await loadChildrenForParent(row.parentRowNumber, { force: true });
      }
    } catch (err) {
      console.error(err);
      if (err?.code === 'concurrency_conflict') {
        await syncRowFromServer(row);
      }
      showError(formatUserActionError(err, 'Не удалось изменить очередь задачи'));
    } finally {
      pendingPriorityTaskIdRef.current = null;
    }
  }, [api, loadChildrenForParent, refresh, showError, syncRowFromServer]);

  const handleDeleteRow = useCallback(async (id) => {
    if (deletingRowIdRef.current != null) {
      showInfo?.(USER_ACTION_MESSAGES.deletingInProgress);
      return;
    }
    if (pendingLifecycleTaskIdRef.current != null) {
      showWarning('Дождитесь завершения действия с задачей');
      return;
    }

    const confirmed = await confirm({
      title: 'Удалить задачу?',
      message: 'Задача будет удалена без возможности восстановления.',
      confirmLabel: 'Удалить',
      confirmColor: 'error',
    });
    if (!confirmed) return;

    deletingRowIdRef.current = id;
    setPendingLifecycleTask(id);
    showLoading?.(USER_ACTION_MESSAGES.deletingTask);
    try {
      await api.deleteRow(id);
      removeRow(id);
      invalidateChildCache(id);
      await refresh();
      onCalendarRefresh?.();
      showSuccess(USER_ACTION_MESSAGES.taskDeleted);
    } catch (err) {
      console.error(err);
      if (err?.code === 'concurrency_conflict') {
        await refresh();
      }
      showError(formatUserActionError(err, 'Не удалось удалить задачу', {
        hint: USER_ACTION_MESSAGES.deleteRetryHint
      }));
    } finally {
      deletingRowIdRef.current = null;
      setPendingLifecycleTask(null);
    }
  }, [api, removeRow, refresh, invalidateChildCache, onCalendarRefresh, confirm, showError, showWarning, showSuccess, showLoading, showInfo, setPendingLifecycleTask]);

  const handleAddNewRow = useCallback(() => {
    const today = new Date().toISOString().slice(0, 10);
    setNewRow({
      folderPath: getDevCdrDefaultFolderPath(),
      fileName: getDevCdrDefaultFileName(),
      comment: '',
      deadline: combineDateTime(today, DEFAULT_TIME),
      estimateHours: '',
      types: [],
      employeeName: '',
      assigneeParts: null,
      isSharedTask: false,
      taskExecutionMode: TASK_EXECUTION_PARALLEL,
      parentRowNumber: null
    });
  }, [setNewRow]);

  const handleEditRow = useCallback((id) => {
    setEditingId(id);
  }, [setEditingId]);

  const handleCopyOrderLink = useCallback(async (task) => {
    const taskId = typeof task === 'object' ? task?.id : task;
    if (!taskId) return;
    try {
      const link = await createCustomerOrderLink(taskId);
      const url = link?.url || (link?.path ? `${window.location.origin}${link.path}` : '');
      if (!url) throw new Error('Сервер не вернул ссылку');
      await navigator.clipboard.writeText(url);
      const name = link.customerName ? ` (${link.customerName})` : '';
      showSuccess?.(`Ссылка на заказ${name} скопирована`);
    } catch (err) {
      showError(formatUserActionError(err, 'Не удалось скопировать ссылку на заказ'));
    }
  }, [showError, showSuccess]);

  const handlePrintOrderLabel = useCallback(async (task) => {
    await printOrderLabelWithQuantityPrompt(promptInput, task, { showSuccess, showError });
  }, [promptInput, showSuccess, showError]);

  return {
    pendingLifecycleTaskId,
    savingNewRow,
    savingRowId,
    handleSaveNewRow,
    handleUpdateRow,
    handleStartTask,
    handlePauseTask,
    handleResumeTask,
    handleCompleteTask,
    handleSetStatus,
    handleSetPriorityRank,
    handleDeleteRow,
    handleAddNewRow,
    handleEditRow,
    handleCopyOrderLink,
    handlePrintOrderLabel
  };
}
