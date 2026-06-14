import { useCallback, useEffect, useRef, useState } from 'react';
import useTaskTableApi from '../useTaskTableApi';
import { useUiFeedback } from '../../context/UiFeedbackContext';
import { TASK_TABLE_EMPLOYEES, TASK_TABLE_TYPES } from './taskTableConstants';
import useTaskTableRows from './useTaskTableRows';
import useTaskTableChildren from './useTaskTableChildren';
import useTaskTableActions from './useTaskTableActions';
import useTaskTableModals from './useTaskTableModals';
import usePlanningWarnings from './usePlanningWarnings';
import { shouldShowHoursTypeColumns } from '../../utils/taskTableColumns';
import { handleTaskTableHubEvent } from '../../utils/taskTableHubHandler';
import { DEV_CDR_PREVIEW_ENABLED, formatDevTaskFilePath } from '../../utils/devCdrPreviewConfig';
import { loadTaskCdrPreview } from '../../utils/devCdrPreviewService';
import { cdrPreviewCacheKey } from '../../utils/cdrPreviewRowHandlers';

export default function useTaskTableController({
  onCalendarRefresh,
  onRegisterHubHandler,
  selectedEmployeeForHighlight
}) {
  const { showError, showWarning, showSuccess, confirm } = useUiFeedback();
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
  const [cdrPreviewOpen, setCdrPreviewOpen] = useState(false);
  const [cdrPreviewTask, setCdrPreviewTask] = useState(null);
  const [cdrPreviewData, setCdrPreviewData] = useState(null);
  const [cdrPreviewPending, setCdrPreviewPending] = useState(false);
  const [cdrPreviewAnchor, setCdrPreviewAnchor] = useState(null);
  const cdrPreviewLoadRef = useRef(0);
  const cdrPreviewRmbListenersRef = useRef(null);
  const cdrPreviewCacheRef = useRef(new Map());

  const detachCdrPreviewRmbListeners = useCallback(() => {
    const listeners = cdrPreviewRmbListenersRef.current;
    if (!listeners) return;
    window.removeEventListener('pointerup', listeners.onPointerUp, true);
    window.removeEventListener('mouseup', listeners.onMouseUp, true);
    window.removeEventListener('pointermove', listeners.onPointerMove, true);
    window.removeEventListener('contextmenu', listeners.onContextMenu, true);
    if (listeners.openTimer) window.clearTimeout(listeners.openTimer);
    cdrPreviewRmbListenersRef.current = null;
  }, []);

  useEffect(() => () => detachCdrPreviewRmbListeners(), [detachCdrPreviewRmbListeners]);

  const rowsState = useTaskTableRows(api, {
    selectedEmployeeForHighlight,
    onCalendarRefresh
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
    confirm,
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
    api,
    selectedEmployeeForHighlight,
    patchRow: rowsState.patchRow,
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

  const attachCdrPreviewRmbListeners = useCallback((onRelease) => {
    detachCdrPreviewRmbListeners();

    let closeAllowed = false;
    const openTimer = window.setTimeout(() => {
      closeAllowed = true;
    }, 0);

    const shouldClose = (event) => {
      if (!closeAllowed) return false;
      if (event.pointerType && event.pointerType !== 'mouse') return false;
      return (event.buttons & 2) === 0;
    };

    const onPointerUp = (event) => {
      if (shouldClose(event)) onRelease();
    };

    const onMouseUp = (event) => {
      if (shouldClose(event)) onRelease();
    };

    const onPointerMove = (event) => {
      if (!closeAllowed) return;
      if (event.pointerType && event.pointerType !== 'mouse') return;
      if ((event.buttons & 2) === 0) onRelease();
    };

    const onContextMenu = (event) => {
      event.preventDefault();
    };

    cdrPreviewRmbListenersRef.current = {
      onPointerUp,
      onMouseUp,
      onPointerMove,
      onContextMenu,
      openTimer
    };
    window.addEventListener('pointerup', onPointerUp, true);
    window.addEventListener('mouseup', onMouseUp, true);
    window.addEventListener('pointermove', onPointerMove, true);
    window.addEventListener('contextmenu', onContextMenu, true);
  }, [detachCdrPreviewRmbListeners]);

  const loadCachedCdrPreview = useCallback(async (task) => {
    const key = cdrPreviewCacheKey(task);
    let promise = key ? cdrPreviewCacheRef.current.get(key) : null;
    if (!promise) {
      promise = loadTaskCdrPreview(task);
      if (key) cdrPreviewCacheRef.current.set(key, promise);
    }
    return promise;
  }, []);

  const handleOpenFile = useCallback(async (row) => {
    try {
      await api.openFile(row);
    } catch (err) {
      showError(err.message || 'Не удалось открыть файл');
    }
  }, [api, showError]);

  const handleCloseCdrPreview = useCallback(() => {
    cdrPreviewLoadRef.current += 1;
    detachCdrPreviewRmbListeners();
    setCdrPreviewOpen(false);
    setCdrPreviewTask(null);
    setCdrPreviewData(null);
    setCdrPreviewPending(false);
    setCdrPreviewAnchor(null);
  }, [detachCdrPreviewRmbListeners]);

  const handleShowCdrPreview = useCallback(async (task, anchor) => {
    if (!DEV_CDR_PREVIEW_ENABLED) return;

    attachCdrPreviewRmbListeners(handleCloseCdrPreview);

    const path = formatDevTaskFilePath(task.folderPath, task.fileName);
    const loadId = ++cdrPreviewLoadRef.current;

    setCdrPreviewTask(task);
    setCdrPreviewAnchor(anchor || { x: 0, y: 0 });
    setCdrPreviewOpen(true);
    setCdrPreviewPending(true);
    setCdrPreviewData(null);

    try {
      const { preview, path: resolvedPath, error } = await loadCachedCdrPreview(task);
      if (loadId !== cdrPreviewLoadRef.current) return;

      const displayPath = resolvedPath || path;
      if (preview) {
        setCdrPreviewData({ ...preview, path: preview.path || displayPath });
      } else if (error) {
        setCdrPreviewData({ error, path: displayPath });
      } else {
        setCdrPreviewData({ path: displayPath });
      }
    } catch {
      if (loadId !== cdrPreviewLoadRef.current) return;
      setCdrPreviewData({ path });
    } finally {
      if (loadId === cdrPreviewLoadRef.current) {
        setCdrPreviewPending(false);
      }
    }
  }, [attachCdrPreviewRmbListeners, handleCloseCdrPreview, loadCachedCdrPreview]);

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

  const showHoursTypeColumns = shouldShowHoursTypeColumns(rowsState.newRow);

  const handleOpenIntervals = useCallback(async (task) => {
    try {
      const intervals = await api.getIntervals(task.id);
      setIntervalsTask(task);
      setIntervalsRows(intervals || []);
      setIntervalsDialogOpen(true);
    } catch (err) {
      showError(err.message || 'Не удалось загрузить интервалы');
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
    try {
      await api.updateIntervals(intervalsTask.id, payload);
      await refresh();
      setIntervalsDialogOpen(false);
      showSuccess('Интервалы сохранены');
    } catch (err) {
      showError(err.message || 'Не удалось сохранить интервалы');
    } finally {
      intervalsSavingRef.current = false;
      setIntervalsPending(false);
    }
  }, [api, intervalsTask, refresh, showError, showSuccess]);

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
    handleShowCdrPreview,
    handleCloseCdrPreview,
    cdrPreviewOpen,
    cdrPreviewTask,
    cdrPreviewData,
    cdrPreviewPending,
    cdrPreviewAnchor,
    intervalsDialogOpen,
    intervalsPending,
    intervalsTask,
    intervalsRows,
    handleOpenIntervals,
    handleCloseIntervals,
    handleSaveIntervals,
    handleSaveComment: modals.handleSaveComment,
    commentSaving: modals.commentSaving,
    planningWarnings,
    dismissPlanningWarning
  };
}
