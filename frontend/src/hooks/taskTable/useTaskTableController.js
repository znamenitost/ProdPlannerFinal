import { useEffect, useRef } from 'react';
import useTaskTableApi from '../useTaskTableApi';
import { useUiFeedback } from '../../context/UiFeedbackContext';
import { TASK_TABLE_EMPLOYEES, TASK_TABLE_TYPES } from './taskTableConstants';
import useTaskTableRows from './useTaskTableRows';
import useTaskTableChildren from './useTaskTableChildren';
import useTaskTableActions from './useTaskTableActions';
import useTaskTableModals from './useTaskTableModals';
import { shouldShowHoursTypeColumns } from '../../utils/taskTableColumns';
import { handleTaskTableHubEvent } from '../../utils/taskTableHubHandler';

export default function useTaskTableController({
  refreshTrigger,
  onCalendarRefresh,
  onRegisterHubHandler,
  selectedEmployeeForHighlight
}) {
  const { showError, showWarning, confirm } = useUiFeedback();
  const api = useTaskTableApi();

  const rowsState = useTaskTableRows(api, {
    refreshTrigger,
    selectedEmployeeForHighlight,
    onCalendarRefresh
  });

  const childrenState = useTaskTableChildren(api, refreshTrigger);

  const actions = useTaskTableActions({
    api,
    refresh: rowsState.refresh,
    patchRow: rowsState.patchRow,
    removeRow: rowsState.removeRow,
    selectedEmployeeForHighlight,
    invalidateChildCache: childrenState.invalidateChildCache,
    setChildrenForParent: childrenState.setChildrenForParent,
    loadChildrenForParent: childrenState.loadChildrenForParent,
    expandParent: childrenState.expandParent,
    newRow: rowsState.newRow,
    setNewRow: rowsState.setNewRow,
    setEditingId: rowsState.setEditingId,
    onCalendarRefresh,
    showError,
    showWarning,
    confirm
  });

  const hubCtxRef = useRef(null);
  hubCtxRef.current = {
    rows: rowsState.rows,
    childrenCache: childrenState.childrenCache,
    api,
    selectedEmployeeForHighlight,
    patchRow: rowsState.patchRow,
    removeRow: rowsState.removeRow,
    invalidateChildCache: childrenState.invalidateChildCache,
    setChildrenForParent: childrenState.setChildrenForParent,
    loadChildrenForParent: childrenState.loadChildrenForParent
  };

  useEffect(() => {
    if (!onRegisterHubHandler) return undefined;

    const handler = (event) => handleTaskTableHubEvent(event, hubCtxRef.current);
    onRegisterHubHandler(handler);
    return () => onRegisterHubHandler(null);
  }, [onRegisterHubHandler]);

  const modals = useTaskTableModals({
    api,
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
    showError
  });

  const showHoursTypeColumns = shouldShowHoursTypeColumns(rowsState.newRow);

  return {
    api,
    employees: TASK_TABLE_EMPLOYEES,
    taskTypes: TASK_TABLE_TYPES,
    showHoursTypeColumns,
    ...rowsState,
    ...childrenState,
    ...actions,
    ...modals,
    handleSaveComment: (comment) => modals.handleSaveComment(comment, api.updateRow)
  };
}
