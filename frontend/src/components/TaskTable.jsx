import { useState, useEffect, useCallback } from 'react';
import {
  Paper,
  Table,
  TableBody,
  TableContainer,
} from '@mui/material';
import SplitTaskModal from './SplitTaskModal';
import TaskTableHead from './TaskTableHead';
import NewTaskRow from './NewTaskRow';
import EditTaskRow from './EditTaskRow';
import ParentTaskRow from './ParentTaskRow';
import TaskTableToolbar from './TaskTableToolbar';
import CommentDialog from './CommentDialog';
import useTaskTableApi from '../hooks/useTaskTableApi';
import useExpandedRows from '../hooks/useExpandedRows';

export default function TaskTable({ refreshTrigger, onTaskUpdate, userRole, currentUser }) {
  const [rows, setRows] = useState([]);
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
  const { isExpanded, toggleExpand } = useExpandedRows();

  const loadRows = useCallback(async () => {
    try {
      const data = await api.loadRows();
      setRows(data);
    } catch (err) {
      console.error('Ошибка загрузки:', err);
    }
  }, [api]);

  useEffect(() => {
    loadRows();
  }, [refreshTrigger, loadRows]);

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
      setTimeout(() => refresh(), 100);
    } catch (err) { 
      console.error(err);
      alert('Ошибка при начале задачи: ' + (err.message || 'неизвестная ошибка'));
    }
  };

  const handlePauseTask = async (row) => {
    try {
      await api.pauseTask(row.id);
      refresh();
      setTimeout(() => refresh(), 100);
    } catch (err) { 
      console.error(err);
      alert('Ошибка при паузе задачи: ' + (err.message || 'неизвестная ошибка'));
    }
  };

  const handleResumeTask = async (row) => {
    try {
      await api.resumeTask(row.id);
      refresh();
      setTimeout(() => refresh(), 100);
    } catch (err) { 
      console.error(err);
      alert('Ошибка при возобновлении задачи: ' + (err.message || 'неизвестная ошибка'));
    }
  };

  const handleCompleteTask = async (row) => {
    try {
      await api.completeTask(row.id);
      refresh();
      setTimeout(() => refresh(), 100);
    } catch (err) { 
      console.error(err);
      alert('Ошибка при завершении задачи: ' + (err.message || 'неизвестная ошибка'));
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

  const handleFieldChange = (task, field, value) => {
    setRows(prevRows => prevRows.map(r => r.id === task.id ? { ...r, [field]: value } : r));
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
            {rows.map(task => (
              editingId === task.id ? (
                <EditTaskRow
                  key={task.id}
                  task={task}
                  onUpdate={handleUpdateRow}
                  onCancel={() => setEditingId(null)}
                  onFieldChange={handleFieldChange}
                  taskTypes={taskTypes}
                  employees={employees}
                />
              ) : (
                <ParentTaskRow
                  key={task.id}
                  task={task}
                  isExpanded={isExpanded(task.id)}
                  onToggleExpand={toggleExpand}
                  onOpenFile={api.openFile}
                  onStart={handleStartTask}
                  onPause={handlePauseTask}
                  onResume={handleResumeTask}
                  onComplete={handleCompleteTask}
                  onEdit={() => setEditingId(task.id)}
                  onDelete={handleDeleteRow}
                  onSplit={handleSplitTask}
                  onOpenComment={handleOpenComment}
                  canEdit={isAdmin}
                  canDelete={isAdmin}
                  canSplit={isAdmin}
                  canChangeStatus={!isAdmin}
                  currentUser={currentUser}
                  highlightMyTasks={highlightMyTasks}
                />
              )
            ))}
          </TableBody>
        </Table>
      </TableContainer>

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