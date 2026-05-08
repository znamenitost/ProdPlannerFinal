import { useState, useCallback, useMemo } from 'react';

export default function useTaskTableApi() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleResponse = useCallback(async (response) => {
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `Ошибка ${response.status}`);
    }
    return response.json();
  }, []);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/tasks/table');
      const data = await handleResponse(response);
      return data;
    } catch (err) {
      setError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [handleResponse]);

  const createRow = useCallback(async (rowData) => {
    setLoading(true);
    try {
      const response = await fetch('/api/tasks/table/row', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderPath: rowData.folderPath,
          fileName: rowData.fileName,
          comment: rowData.comment,
          deadline: rowData.deadline,
          estimateHours: rowData.estimateHours,
          type: rowData.type,
          employeeName: rowData.employeeName,
          parentRowNumber: rowData.parentRowNumber || null
        })
      });
      return await handleResponse(response);
    } finally {
      setLoading(false);
    }
  }, [handleResponse]);

  const updateRow = useCallback(async (id, rowData) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/tasks/table/row/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folderPath: rowData.folderPath,
          fileName: rowData.fileName,
          comment: rowData.comment,
          deadline: rowData.deadline,
          estimateHours: rowData.estimateHours,
          type: rowData.type,
          employeeName: rowData.employeeName,
          parentRowNumber: rowData.parentRowNumber,
          statusText: rowData.statusText
        })
      });
      return await handleResponse(response);
    } finally {
      setLoading(false);
    }
  }, [handleResponse]);

  const deleteRow = useCallback(async (id) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/tasks/table/row/${id}`, {
        method: 'DELETE'
      });
      if (!response.ok) throw new Error('Ошибка удаления');
    } finally {
      setLoading(false);
    }
  }, []);

  const startTask = useCallback(async (rowId) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/tasks/${rowId}/start`, {
        method: 'POST'
      });
      return await handleResponse(response);
    } finally {
      setLoading(false);
    }
  }, [handleResponse]);

  const pauseTask = useCallback(async (rowId) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/tasks/${rowId}/pause`, {
        method: 'POST'
      });
      return await handleResponse(response);
    } finally {
      setLoading(false);
    }
  }, [handleResponse]);

  const resumeTask = useCallback(async (rowId) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/tasks/${rowId}/resume`, {
        method: 'POST'
      });
      return await handleResponse(response);
    } finally {
      setLoading(false);
    }
  }, [handleResponse]);

  const completeTask = useCallback(async (rowId) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/tasks/${rowId}/complete`, {
        method: 'POST'
      });
      return await handleResponse(response);
    } finally {
      setLoading(false);
    }
  }, [handleResponse]);

  const openFile = useCallback(async (row) => {
    const relativePath = `${row.folderPath || ''}/${row.fileName || ''}`.replace(/\\/g, '/').replace(/\/\//g, '/');
    if (!relativePath || relativePath === '/') {
      throw new Error('Путь к файлу не указан');
    }
    const response = await fetch('/api/files/open', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filePath: relativePath })
    });
    const data = await handleResponse(response);
    if (data.downloadUrl) {
      window.open(data.downloadUrl, '_blank');
    } else {
      throw new Error('Не удалось получить ссылку на файл');
    }
  }, [handleResponse]);

  const getTaskForSplit = useCallback(async (employeeName, taskId) => {
    const response = await fetch(`/api/tasks/active?employee=${encodeURIComponent(employeeName)}`);
    const tasks = await handleResponse(response);
    const task = tasks.find(t => t.id === taskId);
    if (!task) throw new Error('Не удалось найти задачу для разделения');
    return task;
  }, [handleResponse]);

  const splitTask = useCallback(async (parentTaskId, parts) => {
    setLoading(true);
    try {
      const response = await fetch('/api/tasks/split', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parentTaskId, parts })
      });
      return await handleResponse(response);
    } finally {
      setLoading(false);
    }
  }, [handleResponse]);

  const api = useMemo(() => ({
    loading,
    error,
    loadRows,
    createRow,
    updateRow,
    deleteRow,
    startTask,
    pauseTask,
    resumeTask,
    completeTask,
    openFile,
    getTaskForSplit,
    splitTask
  }), [
    loading, error, loadRows, createRow, updateRow, deleteRow,
    startTask, pauseTask, resumeTask, completeTask, openFile,
    getTaskForSplit, splitTask
  ]);

  return api;
}