import useTaskTableApi from '../useTaskTableApi';
import { useUiFeedback } from '../../context/UiFeedbackContext';
import { TASK_TABLE_EMPLOYEES, TASK_TABLE_TYPES } from './taskTableConstants';
import useTaskTableRows from './useTaskTableRows';
import useTaskTableChildren from './useTaskTableChildren';
import useTaskTableActions from './useTaskTableActions';
import useTaskTableModals from './useTaskTableModals';

export default function useTaskTableController({
  refreshTrigger,
  onTaskUpdate,
  selectedEmployeeForHighlight
}) {
  const { showError, showWarning, confirm } = useUiFeedback();
  const api = useTaskTableApi();

  const rowsState = useTaskTableRows(api, {
    refreshTrigger,
    selectedEmployeeForHighlight,
    onTaskUpdate
  });

  const childrenState = useTaskTableChildren(api);

  const actions = useTaskTableActions({
    api,
    refresh: rowsState.refresh,
    refreshChildren: childrenState.refreshChildren,
    loadChildrenForParent: childrenState.loadChildrenForParent,
    expandParent: childrenState.expandParent,
    newRow: rowsState.newRow,
    setNewRow: rowsState.setNewRow,
    setEditingId: rowsState.setEditingId,
    showError,
    showWarning,
    confirm
  });

  const modals = useTaskTableModals({
    api,
    employees: TASK_TABLE_EMPLOYEES,
    taskTypes: TASK_TABLE_TYPES,
    childrenCache: childrenState.childrenCache,
    setChildrenForParent: childrenState.setChildrenForParent,
    loadChildrenForParent: childrenState.loadChildrenForParent,
    clearChildrenCache: childrenState.clearChildrenCache,
    refreshChildren: childrenState.refreshChildren,
    patchChildInCache: childrenState.patchChildInCache,
    expandedRows: childrenState.expandedRows,
    editingId: rowsState.editingId,
    refresh: rowsState.refresh,
    patchRow: rowsState.patchRow,
    newRow: rowsState.newRow,
    setNewRow: rowsState.setNewRow,
    showError
  });

  return {
    api,
    employees: TASK_TABLE_EMPLOYEES,
    taskTypes: TASK_TABLE_TYPES,
    ...rowsState,
    ...childrenState,
    ...actions,
    ...modals,
    handleSaveComment: (comment) => modals.handleSaveComment(comment, api.updateRow)
  };
}
