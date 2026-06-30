import { useCallback, useRef, useState } from 'react';
import { combineDateTime, DEFAULT_TIME } from '../../utils/dateTimeHelpers';
import { buildTaskUpdatePayload } from '../../services/api';
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

function kickOffCdrAutoSearch({ taskId, folderPath, fileName, autoSearchMinutes, showWarning }) {
  if (!DEV_CDR_PREVIEW_ENABLED || !taskId) return;
  startCdrAutoSearchAfterSave({
    taskId,
    folderPath,
    fileName,
    autoSearchMinutes,
    showWarning
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
  confirm,
  applyPlanningWarnings,
  getAutoSearchMinutes = () => 0
}) {
  const [pendingLifecycleTaskId, setPendingLifecycleTaskId] = useState(null);
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

  const handleSaveNewRow = useCallback(async () => {
    if (savingNewRowRef.current) return;
    savingNewRowRef.current = true;

    try {
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
        payload.supplyMode =
          newRow.taskExecutionMode === TASK_EXECUTION_SEQUENTIAL
            ? SUPPLY_MODE_INTERNAL
            : SUPPLY_MODE_COOPERATIVE;
      } else if (newRow.requiresTestBeforeProduction) {
        const testH = parseFloat(newRow.testEstimateHours);
        const prodH = parseFloat(newRow.productionEstimateHours);
        if (!testH || testH < 0.5 || !prodH || prodH < 0.5) {
          showWarning('Укажите часы теста и основной части (от 0.5)');
          return;
        }
        payload.requiresTestBeforeProduction = true;
        payload.testEstimateHours = testH;
        payload.productionEstimateHours = prodH;
        payload.estimateHours = testH + prodH;
        payload.type = (newRow.types || []).join(', ');
        payload.employeeName = newRow.employeeName;
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

      const raw = await api.createRow(payload);
      const { task: created, planningWarnings } = unwrapTaskSaveResponse(raw);
      applyPlanningWarnings(planningWarnings);
      const wasShared = newRow.isSharedTask;
      setNewRow(null);
      if (created?.id) {
        kickOffCdrAutoSearch({
          taskId: created.id,
          folderPath: created.folderPath || payload.folderPath,
          fileName: created.fileName || payload.fileName,
          autoSearchMinutes: getAutoSearchMinutes(),
          showWarning
        });
      }
      void refresh();
      if (wasShared && created?.id) {
        await loadChildrenForParent(created.id);
        expandParent(created.id);
      }
    } catch (err) {
      console.error('Ошибка сохранения:', err);
      showError(err.message || 'Ошибка сохранения задачи');
    } finally {
      savingNewRowRef.current = false;
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
    applyPlanningWarnings,
    patchRow,
    getAutoSearchMinutes
  ]);

  const handleUpdateRow = useCallback(async (row) => {
    if (savingRowIdRef.current === row.id) return;

    savingRowIdRef.current = row.id;
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
      } else {
        kickOffCdrAutoSearch({
          taskId: row.id,
          folderPath: row.folderPath,
          fileName: row.fileName,
          autoSearchMinutes: getAutoSearchMinutes(),
          showWarning
        });
        setEditingId(null);
        void syncRowFromServer(row);
      }
    } catch (err) {
      console.error('Ошибка обновления:', err);
      if (err?.code === 'concurrency_conflict') {
        await syncRowFromServer(row);
      }
      showError(err.message || 'Ошибка обновления задачи');
    } finally {
      savingRowIdRef.current = null;
    }
  }, [api, syncRowFromServer, setEditingId, showError, showWarning, applyPlanningWarnings, patchRow, removeRow, refresh, onCalendarRefresh, getAutoSearchMinutes]);

  const runLifecycleAction = useCallback(async (action, row) => {
    if (pendingLifecycleTaskIdRef.current != null) return;

    setPendingLifecycleTask(row.id);
    try {
      await runWorkflowWithSequenceGuard({
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
    } catch (err) {
      console.error(err);
      if (err?.code === 'concurrency_conflict') {
        await syncRowFromServer(row);
      }
      showError(err.message || 'Не удалось выполнить действие с задачей');
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
    } catch (err) {
      console.error(err);
      if (err?.code === 'concurrency_conflict') {
        await syncRowFromServer(row);
      }
      showError(err.message || 'Не удалось изменить статус задачи');
    } finally {
      setPendingLifecycleTask(null);
    }
  }, [api, syncRowFromServer, showError, setPendingLifecycleTask, selectedEmployeeForHighlight]);

  const handleTogglePriority = useCallback(async (row, marked) => {
    if (pendingPriorityTaskIdRef.current === row.id) return;
    pendingPriorityTaskIdRef.current = row.id;
    try {
      await api.updateRow(
        row.id,
        buildTaskUpdatePayload(
          row,
          selectedEmployeeForHighlight || row.employeeName,
          row.statusText,
          { priorityMarked: marked }
        )
      );
      await syncRowFromServer(row);
    } catch (err) {
      console.error(err);
      if (err?.code === 'concurrency_conflict') {
        await syncRowFromServer(row);
      }
      showError(err.message || 'Не удалось изменить пометку задачи');
    } finally {
      pendingPriorityTaskIdRef.current = null;
    }
  }, [api, selectedEmployeeForHighlight, showError, syncRowFromServer]);

  const handleDeleteRow = useCallback(async (id) => {
    if (deletingRowIdRef.current != null) return;
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
    try {
      await api.deleteRow(id);
      removeRow(id);
      invalidateChildCache(id);
      await refresh();
      onCalendarRefresh?.();
    } catch (err) {
      console.error(err);
      if (err?.code === 'concurrency_conflict') {
        await refresh();
      }
      showError(err.message || 'Не удалось удалить задачу');
    } finally {
      deletingRowIdRef.current = null;
    }
  }, [api, removeRow, refresh, invalidateChildCache, onCalendarRefresh, confirm, showError, showWarning]);

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

  return {
    pendingLifecycleTaskId,
    handleSaveNewRow,
    handleUpdateRow,
    handleStartTask,
    handlePauseTask,
    handleResumeTask,
    handleCompleteTask,
    handleSetStatus,
    handleTogglePriority,
    handleDeleteRow,
    handleAddNewRow,
    handleEditRow
  };
}
