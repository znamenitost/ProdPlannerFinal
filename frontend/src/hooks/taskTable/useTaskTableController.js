import { useCallback, useEffect, useRef, useState } from 'react';
import useTaskTableApi from '../useTaskTableApi';
import { useUiFeedback } from '../../context/UiFeedbackContext';
import { TASK_TABLE_EMPLOYEES, TASK_TABLE_TYPES } from './taskTableConstants';
import useTaskTableRows from './useTaskTableRows';
import useTaskTableChildren from './useTaskTableChildren';
import useTaskTableActions from './useTaskTableActions';
import useTaskTableModals from './useTaskTableModals';
import usePlanningWarnings from './usePlanningWarnings';
import { handleTaskTableHubEvent } from '../../utils/taskTableHubHandler';
import useCdrPreview from '../useCdrPreview';
import { formatUserActionError } from '../../utils/actionError';

export default function useTaskTableController({
  onCalendarRefresh,
  onRegisterHubHandler,
  selectedEmployeeForHighlight,
  excludeCompleted = false,
  searchQuery = '',
  showFuss = false,
  pickupMode = false
}) {
  const { showError, showWarning, showSuccess, showLoading, showInfo, confirm, promptInput } = useUiFeedback();
  const api = useTaskTableApi();
  const {
    planningWarnings,
    applyPlanningWarnings,
    dismissPlanningWarning
  } = usePlanningWarnings();
  const [intervalsDialogOpen, setIntervalsDialogOpen] = useState(false);
  const [intervalsPending, setIntervalsPending] = useState(false);
  const [intervalsTask, setIntervalsTask] = useState(null);
  const [intervalsRows, setIntervalsRows] = useState([]);
  const intervalsSavingRef = useRef(false);
  const {
    handleShowCdrPreview,
    handleCloseCdrPreview,
    cdrPreviewOpen,
    cdrPreviewTask,
    cdrPreviewData,
    cdrPreviewPending,
    cdrPreviewAnchor,
    isCdrPreviewBuilding
  } = useCdrPreview();

  const rowsState = useTaskTableRows(api, {
    selectedEmployeeForHighlight,
    onCalendarRefresh,
    excludeCompleted,
    searchQuery,
    showFuss,
    pickupMode
  });

  const childrenState = useTaskTableChildren(api);

  const actions = useTaskTableActions({
    api,
    refresh: rowsState.refresh,
    patchRow: rowsState.patchRow,
    removeRow: rowsState.removeRow,
    selectedEmployeeForHighlight,
    invalidateChildCache: childrenState.invalidateChildCache,
    setChildrenForParent: childrenState.setChildrenForParent,
    patchChildInCache: childrenState.patchChildInCache,
    loadChildrenForParent: childrenState.loadChildrenForParent,
    expandParent: childrenState.expandParent,
    newRow: rowsState.newRow,
    setNewRow: rowsState.setNewRow,
    setEditingId: rowsState.setEditingId,
    onCalendarRefresh,
    showError,
    showWarning,
    showSuccess,
    showLoading,
    showInfo,
    confirm,
    promptInput,
    applyPlanningWarnings
  });

  const refresh = useCallback(async () => {
    await rowsState.refresh();
    await childrenState.refreshExpandedChildren();
  }, [rowsState.refresh, childrenState.refreshExpandedChildren]);

  const { refreshExpandedChildren, expandedRows } = childrenState;

  useEffect(() => {
    if (expandedRows.size === 0) return undefined;
    let cancelled = false;
    refreshExpandedChildren().catch((err) => {
      if (!cancelled) console.error('Ошибка обновления дочерних задач при смене фильтра', err);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedEmployeeForHighlight, expandedRows.size, refreshExpandedChildren]);

  const hubCtxRef = useRef(null);
  hubCtxRef.current = {
    rows: rowsState.rows,
    childrenCache: childrenState.childrenCache,
    expandedRows: childrenState.expandedRows,
    api,
    selectedEmployeeForHighlight,
    pickupMode,
    searchQuery,
    patchRow: rowsState.patchRow,
    upsertRow: rowsState.upsertRow,
    removeRow: rowsState.removeRow,
    patchChildInCache: childrenState.patchChildInCache,
    setChildrenForParent: childrenState.setChildrenForParent,
    loadChildrenForParent: childrenState.loadChildrenForParent
  };

  useEffect(() => {
    if (!onRegisterHubHandler) return undefined;

    const handler = (event) => handleTaskTableHubEvent(event, hubCtxRef.current);
    onRegisterHubHandler(handler);
    return () => onRegisterHubHandler(null);
  }, [onRegisterHubHandler]);

  const handleOpenFile = useCallback((row) => {
    void api.openFile(row).catch((err) => {
      showError(formatUserActionError(err, 'Не удалось открыть файл'));
    });
  }, [api, showError]);

  const handleOpenFolder = useCallback((row) => {
    void api.openFolder(row).catch((err) => {
      showError(formatUserActionError(err, 'Не удалось открыть папку'));
    });
  }, [api, showError]);

  const modals = useTaskTableModals({
    api,
    handleOpenFile,
    employees: TASK_TABLE_EMPLOYEES,
    taskTypes: TASK_TABLE_TYPES,
    childrenCache: childrenState.childrenCache,
    setChildrenForParent: childrenState.setChildrenForParent,
    loadChildrenForParent: childrenState.loadChildrenForParent,
    clearChildrenCache: childrenState.clearChildrenCache,
    invalidateChildCache: childrenState.invalidateChildCache,
    refreshChildren: childrenState.refreshChildren,
    patchChildInCache: childrenState.patchChildInCache,
    expandedRows: childrenState.expandedRows,
    editingId: rowsState.editingId,
    patchRow: rowsState.patchRow,
    selectedEmployeeForHighlight,
    newRow: rowsState.newRow,
    setNewRow: rowsState.setNewRow,
    showError,
    applyPlanningWarnings
  });

  const showHoursTypeColumns = true;

  const handleOpenIntervals = useCallback(async (task) => {
    try {
      const intervals = await api.getIntervals(task.id);
      setIntervalsTask(task);
      setIntervalsRows(intervals || []);
      setIntervalsDialogOpen(true);
    } catch (err) {
      showError(formatUserActionError(err, 'Не удалось загрузить интервалы'));
    }
  }, [api, showError]);

  const handleCloseIntervals = useCallback(() => {
    if (intervalsPending) return;
    setIntervalsDialogOpen(false);
    setIntervalsTask(null);
    setIntervalsRows([]);
  }, [intervalsPending]);

  const handleSaveIntervals = useCallback(async (payload) => {
    if (!intervalsTask || intervalsSavingRef.current) return;
    intervalsSavingRef.current = true;
    setIntervalsPending(true);
    showLoading('Сохраняем интервалы…');
    try {
      await api.updateIntervals(intervalsTask.id, payload);
      await refresh();
      setIntervalsDialogOpen(false);
      showSuccess('Интервалы сохранены');
    } catch (err) {
      showError(formatUserActionError(err, 'Не удалось сохранить интервалы'));
    } finally {
      intervalsSavingRef.current = false;
      setIntervalsPending(false);
    }
  }, [api, intervalsTask, refresh, showError, showSuccess, showLoading]);

  return {
    api,
    employees: TASK_TABLE_EMPLOYEES,
    taskTypes: TASK_TABLE_TYPES,
    showHoursTypeColumns,
    ...rowsState,
    refresh,
    ...childrenState,
    ...actions,
    ...modals,
    handleOpenFile,
    handleOpenFolder,
    handleShowCdrPreview,
    handleCloseCdrPreview,
    cdrPreviewOpen,
    cdrPreviewTask,
    cdrPreviewData,
    cdrPreviewPending,
    cdrPreviewAnchor,
    isCdrPreviewBuilding,
    intervalsDialogOpen,
    intervalsPending,
    intervalsTask,
    intervalsRows,
    handleOpenIntervals,
    handleCloseIntervals,
    handleSaveIntervals,
    handleCommentChanged: modals.handleCommentChanged,
    commentSaving: modals.commentSaving,
    planningWarnings,
    dismissPlanningWarning
  };
}
