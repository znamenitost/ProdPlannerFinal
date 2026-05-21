import { useState, useEffect, useCallback } from 'react';

export default function useTaskTableRows(api, { refreshTrigger, selectedEmployeeForHighlight, onCalendarRefresh }) {
  const [rows, setRows] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [editingId, setEditingId] = useState(null);
  const [newRow, setNewRow] = useState(null);
  const [highlightMyTasks, setHighlightMyTasks] = useState(false);

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

  const refresh = useCallback(async () => {
    await loadRows();
    onCalendarRefresh?.();
  }, [loadRows, onCalendarRefresh]);

  const patchRow = useCallback((id, patch) => {
    setRows((prev) =>
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row))
    );
  }, []);

  const removeRow = useCallback((id) => {
    setRows((prev) => prev.filter((row) => row.id !== id));
    setTotalCount((count) => Math.max(0, count - 1));
  }, []);

  const toggleHighlight = () => setHighlightMyTasks(prev => !prev);
  const handleChangePage = (_event, newPage) => setPage(newPage);
  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  return {
    rows,
    totalCount,
    page,
    rowsPerPage,
    editingId,
    setEditingId,
    newRow,
    setNewRow,
    highlightMyTasks,
    toggleHighlight,
    handleChangePage,
    handleChangeRowsPerPage,
    refresh,
    loadRows,
    patchRow,
    removeRow
  };
}
