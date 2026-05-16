import { useState, useEffect, useCallback } from 'react';
import {
  Paper,
  Table,
  TableBody,
  TableContainer,
  TablePagination,
} from '@mui/material';
import SplitTaskModal, { childrenToModalParts, apiPartsToModalParts } from './SplitTaskModal';
import TaskTableHead from './TaskTableHead';
import NewTaskRow from './NewTaskRow';
import EditTaskRow from './EditTaskRow';
import ParentTaskRow from './ParentTaskRow';
import TaskTableToolbar from './TaskTableToolbar';
import CommentDialog from './CommentDialog';
import useTaskTableApi from '../hooks/useTaskTableApi';
import { useUiFeedback } from '../context/UiFeedbackContext';
import { combineDateTime, DEFAULT_TIME } from '../utils/dateTimeHelpers';


export default function TaskTable({ refreshTrigger, onTaskUpdate, userRole, currentUser, selectedEmployeeForHighlight }) {
  const [rows, setRows] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [editingId, setEditingId] = useState(null);
  const [newRow, setNewRow] = useState(null);
  const [splitModalOpen, setSplitModalOpen] = useState(false);
  const [splitModalMode, setSplitModalMode] = useState('split');
  const [splitModalTask, setSplitModalTask] = useState(null);
  const [splitModalInitialParts, setSplitModalInitialParts] = useState(null);
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [selectedCommentTask, setSelectedCommentTask] = useState(null);
  const [highlightMyTasks, setHighlightMyTasks] = useState(false);
  const [employees] = useState(['Дима', 'Яромир', 'Павел']);
  const [taskTypes] = useState(['Резка', 'УФ печать', 'Монтаж', 'Дизайн', 'Сборка', 'Упаковка']);

  const isAdmin = userRole === 'Admin';
  const api = useTaskTableApi();
  const { showError, showWarning, confirm } = useUiFeedback();

  const [expandedRows, setExpandedRows] = useState(new Set());
  const [childrenCache, setChildrenCache] = useState(new Map());
  const [loadingChildren, setLoadingChildren] = useState(new Set());

  const loadRows = useCallback(async () => {
    try {
      const result = await api.loadRows(page + 1, rowsPerPage, selectedEmployeeForHighlight || '');
      setRows(result.items);
      setTotalCount(result.totalCount);
    } catch (err) {
      console.error('Ошибка загрузки задач:', err);
    }
  }, [api, page, rowsPerPage, selectedEmployeeForHighlight]);

  useEffect(() => {
    loadRows();
  }, [refreshTrigger, page, rowsPerPage, selectedEmployeeForHighlight, loadRows]);

  const loadChildrenForParent = useCallback(async (parentId) => {
    if (childrenCache.has(parentId)) return childrenCache.get(parentId);
    if (loadingChildren.has(parentId)) return;
    
    setLoadingChildren(prev => new Set(prev).add(parentId));
    try {
      const children = await api.loadChildren(parentId);
      setChildrenCache(prev => new Map(prev).set(parentId, children));
      return children;
    } catch (err) {
      console.error('Ошибка загрузки детей', err);
      return [];
    } finally {
      setLoadingChildren(prev => {
        const newSet = new Set(prev);
        newSet.delete(parentId);
        return newSet;
      });
    }
  }, [api, childrenCache, loadingChildren]);

  // ========== НОВАЯ ФУНКЦИЯ ДЛЯ ОБНОВЛЕНИЯ КЕША ДЕТЕЙ ==========
  const refreshChildren = useCallback(async (parentId) => {
  if (expandedRows.has(parentId)) {
    // Родитель раскрыт — обновляем детей без удаления кеша (чтобы не схлопывалось)
    setLoadingChildren(prev => new Set(prev).add(parentId));
    try {
      const children = await api.loadChildren(parentId);
      setChildrenCache(prev => new Map(prev).set(parentId, children));
    } catch (err) {
      console.error('Ошибка обновления детей', err);
    } finally {
      setLoadingChildren(prev => {
        const newSet = new Set(prev);
        newSet.delete(parentId);
        return newSet;
      });
    }
  } else {
    // Родитель свёрнут — можно удалить кеш, чтобы при разворачивании загрузить свежее
    setChildrenCache(prev => {
      const newMap = new Map(prev);
      newMap.delete(parentId);
      return newMap;
    });
  }
}, [expandedRows, api.loadChildren]);

  const toggleExpand = async (parentId) => {
    if (expandedRows.has(parentId)) {
      setExpandedRows(prev => {
        const newSet = new Set(prev);
        newSet.delete(parentId);
        return newSet;
      });
    } else {
      await loadChildrenForParent(parentId);
      setExpandedRows(prev => new Set(prev).add(parentId));
    }
  };

  const refresh = () => {
    loadRows();
    if (onTaskUpdate) onTaskUpdate();
  };

  const closeSplitModal = () => {
    setSplitModalOpen(false);
    setSplitModalTask(null);
    setSplitModalInitialParts(null);
  };

  const handleSaveNewRow = async () => {
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
        setExpandedRows(prev => new Set(prev).add(created.id));
        await loadChildrenForParent(created.id);
      }
    } catch (err) {
      console.error('Ошибка сохранения:', err);
      showError(err.message || 'Ошибка сохранения задачи');
    }
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
      setChildrenCache(prev => new Map(prev).set(task.id, children));
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

  const handleUpdateRow = async (row) => {
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
  };

  // ========== ИСПРАВЛЕННЫЕ ОБРАБОТЧИКИ С ВЫЗОВОМ refreshChildren ==========
  const handleStartTask = async (row) => {
    try {
      await api.startTask(row.id);
      refresh();
      if (row.parentRowNumber) {
        await refreshChildren(row.parentRowNumber);
      }
    } catch (err) { 
      console.error(err);
    }
  };

  const handlePauseTask = async (row) => {
    try {
      await api.pauseTask(row.id);
      refresh();
      if (row.parentRowNumber) {
        await refreshChildren(row.parentRowNumber);
      }
    } catch (err) { 
      console.error(err);
    }
  };

  const handleResumeTask = async (row) => {
    try {
      await api.resumeTask(row.id);
      refresh();
      if (row.parentRowNumber) {
        await refreshChildren(row.parentRowNumber);
      }
    } catch (err) { 
      console.error(err);
    }
  };

  const handleCompleteTask = async (row) => {
    try {
      await api.completeTask(row.id);
      refresh();
      if (row.parentRowNumber) {
        await refreshChildren(row.parentRowNumber);
      }
    } catch (err) { 
      console.error(err);
    }
  };

  const handleDeleteRow = async (id) => {
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
    } catch (err) { console.error(err); }
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
      setChildrenCache(prev => new Map(prev).set(parentId, children));
    }
    refresh();
    if (parentId) {
      if (splitModalMode !== 'edit') {
        setChildrenCache(prev => {
          const next = new Map(prev);
          next.delete(parentId);
          return next;
        });
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

  const handleSaveComment = async (newComment) => {
    if (!selectedCommentTask) return;
    const updatedTask = { ...selectedCommentTask, comment: newComment };
    try {
      await api.updateRow(updatedTask.id, updatedTask);
      setCommentDialogOpen(false);
      setSelectedCommentTask(null);
      refresh();
    } catch (err) {
      console.error(err);
      showError('Ошибка сохранения комментария');
    }
  };


    const handleAddNewRow = () => {
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
    };

  const toggleHighlight = () => setHighlightMyTasks(!highlightMyTasks);
  const handleChangePage = (event, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  return (
    <Paper elevation={0} sx={{ p: 3, borderRadius: 3 }}>
      <TaskTableToolbar
        isAdmin={isAdmin}
        onAddNew={handleAddNewRow}
        highlightMyTasks={highlightMyTasks}
        onToggleHighlight={toggleHighlight}
      />

      <TableContainer sx={{ maxHeight: '70vh', overflow: 'auto' }}>
        <Table stickyHeader size="small">
          <TaskTableHead isAdmin={isAdmin} />
          <TableBody>
            {newRow && isAdmin && (
              <NewTaskRow
                newRow={newRow}
                setNewRow={setNewRow}
                taskTypes={taskTypes}
                employees={employees}
                onSave={handleSaveNewRow}
                onCancel={() => setNewRow(null)}
                onOpenSharedModal={handleOpenNewSharedModal}
              />
            )}
            {rows.map(parent => {
              const children = childrenCache.get(parent.id) || [];
              const isExpanded = expandedRows.has(parent.id);
              return editingId === parent.id ? (
                <EditTaskRow
                  key={parent.id}
                  task={parent}
                  onUpdate={handleUpdateRow}
                  onCancel={() => setEditingId(null)}
                  taskTypes={taskTypes}
                  employees={employees}
                  onOpenSharedModal={handleOpenEditSharedModal}
                />
              ) : (
                <ParentTaskRow
                  key={parent.id}
                  task={parent}
                  childrenTasks={children}
                  isExpanded={isExpanded}
                  onToggleExpand={toggleExpand}
                  onOpenFile={api.openFile}
                  onStart={handleStartTask}
                  onPause={handlePauseTask}
                  onResume={handleResumeTask}
                  onComplete={handleCompleteTask}
                  onEdit={() => setEditingId(parent.id)}
                  onDelete={handleDeleteRow}
                  onSplit={handleSplitTask}
                  onOpenComment={handleOpenComment}
                  canEdit={isAdmin}
                  canDelete={isAdmin}
                  canSplit={isAdmin}
                  canChangeStatus={!isAdmin}
                  currentUser={currentUser}
                  highlightMyTasks={highlightMyTasks}
                  selectedEmployeeForHighlight={selectedEmployeeForHighlight}
                />
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {isAdmin && (
        <TablePagination
          rowsPerPageOptions={[25, 50, 100]}
          component="div"
          count={totalCount}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      )}

      <CommentDialog
        open={commentDialogOpen}
        comment={selectedCommentTask?.comment || ''}
        onSave={handleSaveComment}
        onClose={() => setCommentDialogOpen(false)}
      />

      <SplitTaskModal
        open={splitModalOpen}
        mode={splitModalMode}
        task={splitModalTask}
        initialParts={splitModalInitialParts}
        employees={employees}
        taskTypes={taskTypes}
        onClose={closeSplitModal}
        onSuccess={handleSplitSuccess}
        onDraftApply={handleDraftApply}
      />
    </Paper>
  );
}