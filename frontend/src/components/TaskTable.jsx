import { useState, useEffect } from 'react';
import {
  Paper,
  Table,
  TableBody,
  TableContainer,
  Button,
  Box,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField
} from '@mui/material';
import { Add } from '@mui/icons-material';
import SplitTaskModal from './SplitTaskModal';
import TaskTableHead from './TaskTableHead';
import NewTaskRow from './NewTaskRow';
import EditTaskRow from './EditTaskRow';
import TaskRow from './TaskRow';
import { groupTasksByParent } from '../utils/taskUtils';   // ← ДОБАВЛЕННЫЙ ИМПОРТ

export default function TaskTable({ refreshTrigger, onTaskUpdate, userRole, currentUser }) {
  const [rows, setRows] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [newRow, setNewRow] = useState(null);
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [splitModalOpen, setSplitModalOpen] = useState(false);
  const [selectedTaskForSplit, setSelectedTaskForSplit] = useState(null);
  const [commentDialogOpen, setCommentDialogOpen] = useState(false);
  const [selectedCommentTask, setSelectedCommentTask] = useState(null);
  const [tempComment, setTempComment] = useState('');
  const [employees] = useState(['Дима', 'Яромир', 'Павел']);
  const [taskTypes] = useState(['Резка', 'УФ печать', 'Монтаж', 'Дизайн', 'Сборка', 'Упаковка']);

  const isAdmin = userRole === 'Admin';
  
  console.log('TaskTable - userRole:', userRole, 'isAdmin:', isAdmin);

  useEffect(() => {
    loadRows();
  }, [refreshTrigger]);

  const loadRows = async () => {
    try {
      const response = await fetch('/api/table/rows');
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      const data = await response.json();
      setRows(groupTasksByParent(data));
    } catch (err) {
      console.error('Ошибка загрузки:', err);
    }
  };

  const refresh = () => {
    loadRows();
    if (onTaskUpdate) onTaskUpdate();
  };

  const handleSaveNewRow = async () => {
    try {
      const response = await fetch('/api/table/row', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderPath: newRow.folderPath,
          fileName: newRow.fileName,
          comment: newRow.comment,
          statusText: newRow.statusText,
          deadline: newRow.deadline,
          estimateHours: newRow.estimateHours,
          type: (newRow.types || []).join(', '),
          employeeName: newRow.employeeName,
          parentRowNumber: null
        })
      });
      if (response.ok) {
        setNewRow(null);
        refresh();
      }
    } catch (err) {
      console.error('Ошибка сохранения:', err);
      alert('Ошибка сохранения задачи');
    }
  };

  const openFile = async (row) => {
    const fullPath = row.folderPath ? `${row.folderPath}/${row.fileName}` : row.fileName;
    if (!fullPath) return alert('Путь к файлу не указан');
    try {
      const response = await fetch('/api/files/open', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: fullPath })
      });
      const data = await response.json();
      if (!response.ok) alert(data.message || 'Ошибка открытия файла');
    } catch (err) {
      console.error('Ошибка открытия файла:', err);
      alert('Не удалось открыть файл');
    }
  };

  const handleStartTask = async (row) => {
    try {
      await fetch(`/api/table/row/${row.id}/start`, { method: 'POST' });
      refresh();
    } catch (err) { console.error('Ошибка:', err); }
  };

  const handlePauseTask = async (row) => {
    try {
      await fetch(`/api/table/row/${row.id}/pause`, { method: 'POST' });
      refresh();
    } catch (err) { console.error('Ошибка:', err); }
  };

  const handleResumeTask = async (row) => {
    try {
      await fetch(`/api/table/row/${row.id}/resume`, { method: 'POST' });
      refresh();
    } catch (err) { console.error('Ошибка:', err); }
  };

  const handleCompleteTask = async (row) => {
    try {
      await fetch(`/api/table/row/${row.id}/complete`, { method: 'POST' });
      refresh();
    } catch (err) { console.error('Ошибка:', err); }
  };

  const handleDeleteRow = async (id) => {
    if (!window.confirm('Удалить задачу?')) return;
    try {
      await fetch(`/api/table/row/${id}`, { method: 'DELETE' });
      refresh();
    } catch (err) { console.error('Ошибка удаления:', err); }
  };

  const handleUpdateRow = async (row) => {
    try {
      const response = await fetch(`/api/table/row/${row.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: row.id,
          folderPath: row.folderPath,
          fileName: row.fileName,
          comment: row.comment,
          statusText: row.statusText,
          deadline: row.deadline,
          estimateHours: row.estimateHours,
          type: row.type,
          employeeName: row.employeeName,
          parentRowNumber: row.parentRowNumber
        })
      });
      
      if (response.ok) {
        setEditingId(null);
        refresh();
      } else {
        alert('Ошибка обновления задачи');
      }
    } catch (err) {
      console.error('Ошибка обновления:', err);
      alert('Ошибка обновления задачи');
    }
  };

  const handleSplitTask = (row) => {
    const fetchTaskForSplit = async () => {
      try {
        const response = await fetch(`/api/tasks/active?employee=${encodeURIComponent(row.employeeName)}`);
        const tasks = await response.json();
        const task = tasks.find(t => t.rowNumber === row.id);
        if (task) {
          setSelectedTaskForSplit(task);
          setSplitModalOpen(true);
        } else {
          alert('Не удалось найти задачу для разделения');
        }
      } catch (err) {
        console.error('Ошибка:', err);
        alert('Ошибка при подготовке к разделению');
      }
    };
    fetchTaskForSplit();
  };

  const handleSplitSuccess = () => refresh();

  const handleOpenComment = (row) => {
    setSelectedCommentTask(row);
    setTempComment(row.comment || '');
    setCommentDialogOpen(true);
  };

  const handleSaveComment = async () => {
    if (!selectedCommentTask) return;
    try {
      const response = await fetch(`/api/table/row/${selectedCommentTask.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...selectedCommentTask, comment: tempComment })
      });
      if (response.ok) {
        setCommentDialogOpen(false);
        setSelectedCommentTask(null);
        refresh();
      }
    } catch (err) { console.error('Ошибка сохранения комментария:', err); }
  };

  const toggleExpand = (rowId) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(rowId)) newExpanded.delete(rowId);
    else newExpanded.add(rowId);
    setExpandedRows(newExpanded);
  };

  const handleFieldChange = (task, field, value) => {
    setRows(prevRows => prevRows.map(r => r.id === task.id ? { ...r, [field]: value } : r));
  };

  const handleAddNewRow = () => {
    setNewRow({
      folderPath: '',
      fileName: '',
      comment: '',
      statusText: '',
      deadline: new Date().toISOString().slice(0, 16),
      estimateHours: 1,
      types: [taskTypes[0]],
      employeeName: employees[0],
      parentRowNumber: null
    });
  };

  return (
    <Paper elevation={0} sx={{ p: 3, borderRadius: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h2" sx={{ fontWeight: 600 }}>📋 Таблица задач</Typography>
        {isAdmin && (
          <Button variant="contained" startIcon={<Add />} onClick={handleAddNewRow} sx={{ bgcolor: '#22c55e' }}>
            Новая задача
          </Button>
        )}
      </Box>

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
                <TaskRow
                  key={task.id}
                  task={task}
                  isChild={false}
                  isExpanded={expandedRows.has(task.id)}
                  onToggleExpand={toggleExpand}
                  onOpenFile={openFile}
                  onStart={handleStartTask}
                  onPause={handlePauseTask}
                  onResume={handleResumeTask}
                  onComplete={handleCompleteTask}
                  onEdit={() => {
                    console.log('Edit clicked for task:', task.id);
                    setEditingId(task.id);
                  }}
                  onDelete={handleDeleteRow}
                  onSplit={handleSplitTask}
                  onOpenComment={handleOpenComment}
                  canEdit={isAdmin}
                  canDelete={isAdmin}
                  canSplit={isAdmin}
                  canChangeStatus={true}
                />
              )
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={commentDialogOpen} onClose={() => setCommentDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Редактирование комментария</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Комментарий"
            fullWidth
            multiline
            rows={3}
            value={tempComment}
            onChange={(e) => setTempComment(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCommentDialogOpen(false)}>Отмена</Button>
          <Button onClick={handleSaveComment} variant="contained">Сохранить</Button>
        </DialogActions>
      </Dialog>

      <SplitTaskModal
        open={splitModalOpen}
        task={selectedTaskForSplit}
        onClose={() => setSplitModalOpen(false)}
        onSuccess={handleSplitSuccess}
      />
    </Paper>
  );
}