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
import { buildTaskCdrPreview } from '../../utils/devCdrPreviewService';
import { getCdrPathValidationError } from '../../utils/cdrPreviewErrors';

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
  applyPlanningWarnings
}) {
  const [pendingLifecycleTaskId, setPendingLifecycleTaskId] = useState(null);
  const pendingLifecycleTaskIdRef = useRef(null);
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
        removeRow(parentId);
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
      }

      if (result.parentRemovedFromTable) {
        removeRow(parentId);
      } else if (result.parentRow) {
        patchRow(parentId, result.parentRow);
      }
    } else if (result.removedFromTable) {
      removeRow(row.id);
    } else if (result.row) {
      patchRow(row.id, result.row);
    }

    onCalendarRefresh?.();
  }, [
    api,
    syncRowFromServer,
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
      if (DEV_CDR_PREVIEW_ENABLED && created?.id) {
        const folderPath = created.folderPath || payload.folderPath;
        const fileName = created.fileName || payload.fileName;
        const pathIssue = getCdrPathValidationError(folderPath, fileName);
        if (pathIssue) {
          showWarning(pathIssue);
        } else {
          try {
            await buildTaskCdrPreview(created.id, folderPath, fileName);
          } catch (previewErr) {
            showWarning(previewErr?.message || 'Не удалось построить превью .cdr');
          }
        }
      }
      setNewRow(null);
      await refresh();
      if (newRow.isSharedTask && created?.id) {
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
    applyPlanningWarnings
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
        parentRowNumber: row.parentRowNumber
      });
      const { planningWarnings } = unwrapTaskSaveResponse(raw);
      applyPlanningWarnings(planningWarnings);
      setEditingId(null);
      await syncRowFromServer(row);
      if (DEV_CDR_PREVIEW_ENABLED) {
        const pathIssue = getCdrPathValidationError(row.folderPath, row.fileName);
        if (pathIssue) {
          showWarning(pathIssue);
        } else {
          try {
            await buildTaskCdrPreview(row.id, row.folderPath, row.fileName);
          } catch (previewErr) {
            showWarning(previewErr?.message || 'Не удалось построить превью .cdr');
          }
        }
      }
    } catch (err) {
      console.error('Ошибка обновления:', err);
      showError('Ошибка обновления задачи');
    } finally {
      savingRowIdRef.current = null;
    }
  }, [api, syncRowFromServer, setEditingId, showError, showWarning, applyPlanningWarnings]);

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
      await api.updateRow(row.id, {
        folderPath: row.folderPath,
        fileName: row.fileName,
        comment: row.comment,
        deadline: row.deadline,
        estimateHours: row.estimateHours,
        type: row.type,
        employeeName: row.employeeName,
        parentRowNumber: row.parentRowNumber,
        statusText,
        sequenceOverride: extra?.sequenceOverride ?? false
      });
      await syncRowFromServer(row);
    } catch (err) {
      console.error(err);
      showError(err.message || 'Не удалось изменить статус задачи');
    } finally {
      setPendingLifecycleTask(null);
    }
  }, [api, syncRowFromServer, showError, setPendingLifecycleTask]);

  const handleDeleteRow = useCallback(async (id) => {
    if (deletingRowIdRef.current != null) return;

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
      showError(err.message || 'Не удалось удалить задачу');
    } finally {
      deletingRowIdRef.current = null;
    }
  }, [api, removeRow, refresh, invalidateChildCache, onCalendarRefresh, confirm, showError]);

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
    handleDeleteRow,
    handleAddNewRow,
    handleEditRow
  };
}
