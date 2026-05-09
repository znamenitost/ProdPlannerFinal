import { useState, useEffect, useCallback } from 'react';
import {
  Paper,
  Table,
  TableBody,
  TableContainer,
  TablePagination,
} from '@mui/material';
import SplitTaskModal from './SplitTaskModal';
import TaskTableHead from './TaskTableHead';
import NewTaskRow from './NewTaskRow';
import EditTaskRow from './EditTaskRow';
import ParentTaskRow from './ParentTaskRow';
import TaskTableToolbar from './TaskTableToolbar';
import CommentDialog from './CommentDialog';
import useTaskTableApi from '../hooks/useTaskTableApi';

export default function TaskTable({ refreshTrigger, onTaskUpdate, userRole, currentUser, selectedEmployeeForHighlight }) {
  const [rows, setRows] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [editingId, setEditingId] = useState(null);
  const [newRow, setNewRow] = useState(null);
  const [splitModalOpen, setSplitModalOpen] = useState(false);
  const [selectedTaskForSplit, setSelectedTaskForSplit] = useState(null);
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [selectedCommentTask, setSelectedCommentTask] = useState(null);
  const [highlightMyTasks, setHighlightMyTasks] = useState(false);
  const [employees] = useState(['Дима', 'Яромир', 'Павел']);
  const [taskTypes] = useState(['Резка', 'УФ печать', 'Монтаж', 'Дизайн', 'Сборка', 'Упаковка']);

  const isAdmin = userRole === 'Admin';
  const api = useTaskTableApi();

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

  const loadChildrenForParent = async (parentId) => {
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
  };

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

  const handleSaveNewRow = async () => {
    try {
      await api.createRow({
        folderPath: newRow.folderPath,
        fileName: newRow.fileName,
        comment: newRow.comment,
        deadline: newRow.deadline,
        estimateHours: newRow.estimateHours,
        type: (newRow.types || []).join(', '),
        employeeName: newRow.employeeName,
        parentRowNumber: null
      });
      setNewRow(null);
      refresh();
    } catch (err) {
      console.error('Ошибка сохранения:', err);
      alert('Ошибка сохранения задачи');
    }
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
      alert('Ошибка обновления задачи');
    }
  };

  const handleStartTask = async (row) => {
    try {
      await api.startTask(row.id);
      refresh();
    } catch (err) { 
      console.error(err);
    }
  };

  const handlePauseTask = async (row) => {
    try {
      await api.pauseTask(row.id);
      refresh();
    } catch (err) { 
      console.error(err);
    }
  };

  const handleResumeTask = async (row) => {
    try {
      await api.resumeTask(row.id);
      refresh();
    } catch (err) { 
      console.error(err);
    }
  };

  const handleCompleteTask = async (row) => {
    try {
      await api.completeTask(row.id);
      refresh();
    } catch (err) { 
      console.error(err);
    }
  };

  const handleDeleteRow = async (id) => {
    if (!window.confirm('Удалить задачу?')) return;
    try {
      await api.deleteRow(id);
      refresh();
    } catch (err) { console.error(err); }
  };

  const handleSplitTask = async (row) => {
    try {
      const task = await api.getTaskForSplit(row.employeeName, row.id);
      setSelectedTaskForSplit(task);
      setSplitModalOpen(true);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSplitSuccess = () => refresh();

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
      alert('Ошибка сохранения комментария');
    }
  };

  const handleAddNewRow = () => {
    setNewRow({
      folderPath: '',
      fileName: '',
      comment: '',
      deadline: new Date().toISOString().slice(0, 16),
      estimateHours: 1,
      types: [taskTypes[0]],
      employeeName: employees[0],
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
        task={selectedTaskForSplit}
        onClose={() => setSplitModalOpen(false)}
        onSuccess={handleSplitSuccess}
      />
    </Paper>
  );
}