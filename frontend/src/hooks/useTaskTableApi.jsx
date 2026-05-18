import { useCallback, useMemo } from 'react';
import { openFileOnClient } from '../utils/openFileOnClient';

export default function useTaskTableApi() {
  const handleResponse = useCallback(async (response) => {
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `Ошибка ${response.status}`);
    }
    return response.json();
  }, []);

  const loadRows = useCallback(async (page = 1, pageSize = 50, selectedEmployee = '') => {
    let url = `/api/tasks/table?page=${page}&pageSize=${pageSize}`;
    if (selectedEmployee) {
      url += `&employee=${encodeURIComponent(selectedEmployee)}`;
    }
    const response = await fetch(url);
    const data = await handleResponse(response);
    if (data.items && data.totalCount !== undefined) {
      return { items: data.items, totalCount: data.totalCount, page: data.page, pageSize: data.pageSize };
    }
    return { items: data, totalCount: data.length, page: 1, pageSize: data.length };
  }, [handleResponse]);

  const loadChildren = useCallback(async (parentId) => {
    const response = await fetch(`/api/tasks/split/children/${parentId}`);
    const children = await handleResponse(response);
    return children;
  }, [handleResponse]);

  const createRow = useCallback(async (rowData) => {
    const body = {
      folderPath: rowData.folderPath,
      fileName: rowData.fileName,
      comment: rowData.comment,
      deadline: rowData.deadline,
      estimateHours: rowData.estimateHours,
      type: rowData.type,
      employeeName: rowData.employeeName,
      parentRowNumber: rowData.parentRowNumber || null
    };
    if (rowData.parts?.length) {
      body.parts = rowData.parts;
    }
    const response = await fetch('/api/tasks/table/row', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return await handleResponse(response);
  }, [handleResponse]);

  const updateRow = useCallback(async (id, rowData) => {
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
  }, [handleResponse]);

  const deleteRow = useCallback(async (id) => {
    const response = await fetch(`/api/tasks/table/row/${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Ошибка удаления');
  }, []);

  const startTask = useCallback(async (rowId) => {
    const response = await fetch(`/api/tasks/${rowId}/start`, { method: 'POST' });
    return await handleResponse(response);
  }, [handleResponse]);

  const pauseTask = useCallback(async (rowId) => {
    const response = await fetch(`/api/tasks/${rowId}/pause`, { method: 'POST' });
    return await handleResponse(response);
  }, [handleResponse]);

  const resumeTask = useCallback(async (rowId) => {
    const response = await fetch(`/api/tasks/${rowId}/resume`, { method: 'POST' });
    return await handleResponse(response);
  }, [handleResponse]);

  const completeTask = useCallback(async (rowId) => {
    const response = await fetch(`/api/tasks/${rowId}/complete`, { method: 'POST' });
    return await handleResponse(response);
  }, [handleResponse]);

  const openFile = useCallback(async (row) => {
    const relativePath = `${row.folderPath || ''}/${row.fileName || ''}`.replace(/\\/g, '/').replace(/\/\//g, '/');
    if (!relativePath || relativePath === '/') {
      throw new Error('Путь к файлу не указан');
    }
    const result = openFileOnClient(relativePath);
    if (!result.ok) {
      throw new Error('Не удалось открыть файл');
    }
  }, []);

  const getTaskForSplit = useCallback(async (employeeName, taskId) => {
    const response = await fetch(`/api/tasks/active?employee=${encodeURIComponent(employeeName)}`);
    const tasks = await handleResponse(response);
    const task = tasks.find(t => t.id === taskId);
    if (!task) throw new Error('Не удалось найти задачу для разделения');
    return task;
  }, [handleResponse]);

  const splitTask = useCallback(async (parentTaskId, parts) => {
    const response = await fetch('/api/tasks/split', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentTaskId, parts })
    });
    return await handleResponse(response);
  }, [handleResponse]);

  const api = useMemo(() => ({
    loadRows,
    loadChildren,
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
  }), [loadRows, loadChildren, createRow, updateRow, deleteRow, startTask, pauseTask, resumeTask, completeTask, openFile, getTaskForSplit, splitTask]);

  return api;
}