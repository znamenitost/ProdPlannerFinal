import { useCallback, useMemo } from 'react';
import { openFileOnClient } from '../utils/openFileOnClient';
import { normalizePathForOpen } from '../utils/filePathForOpen';

export default function useTaskTableApi() {
  const handleResponse = useCallback(async (response) => {
    if (!response.ok) {
      const text = await response.text();
      let message = text || `Ошибка ${response.status}`;
      try {
        const body = JSON.parse(text);
        if (body?.error) message = body.error;
        if (response.status === 409) {
          const err = new Error(message);
          err.code = body?.code || 'concurrency_conflict';
          err.status = 409;
          throw err;
        }
      } catch (parseErr) {
        if (parseErr?.status === 409) throw parseErr;
      }
      const err = new Error(message);
      err.status = response.status;
      throw err;
    }
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return response.json();
    }
    return null;
  }, []);

  const fetchTableRow = useCallback(async (id, selectedEmployee = '') => {
    let url = `/api/tasks/table/row/${id}`;
    if (selectedEmployee) {
      url += `?employee=${encodeURIComponent(selectedEmployee)}`;
    }
    const response = await fetch(url);
    return handleResponse(response);
  }, [handleResponse]);

  const loadRows = useCallback(async (page = 1, pageSize = 50, selectedEmployee = '', options = {}) => {
    let url = `/api/tasks/table?page=${page}&pageSize=${pageSize}`;
    if (selectedEmployee) {
      url += `&employee=${encodeURIComponent(selectedEmployee)}`;
    }
    const response = await fetch(url, { signal: options.signal });
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
    if (rowData.supplyMode != null) {
      body.supplyMode = rowData.supplyMode;
    }
    if (rowData.requiresTestBeforeProduction) {
      body.requiresTestBeforeProduction = true;
      body.testEstimateHours = rowData.testEstimateHours;
      body.productionEstimateHours = rowData.productionEstimateHours;
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
        statusText: rowData.statusText,
        sequenceOverride: rowData.sequenceOverride ?? false
      })
    });
    return await handleResponse(response);
  }, [handleResponse]);

  const getIntervals = useCallback(async (taskId) => {
    const response = await fetch(`/api/tasks/table/row/${taskId}/intervals`);
    return await handleResponse(response);
  }, [handleResponse]);

  const updateIntervals = useCallback(async (taskId, intervals) => {
    const response = await fetch(`/api/tasks/table/row/${taskId}/intervals`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intervals })
    });
    return await handleResponse(response);
  }, [handleResponse]);

  const deleteRow = useCallback(async (id) => {
    let response = await fetch(`/api/tasks/table/row/${id}`, { method: 'DELETE' });
    if (response.status === 405) {
      response = await fetch(`/api/tasks/table/row/${id}/delete`, { method: 'POST' });
    }
    await handleResponse(response);
  }, [handleResponse]);

  const lifecycleUrl = useCallback((rowId, action, selectedEmployee = '') => {
    let url = `/api/tasks/${rowId}/${action}`;
    if (selectedEmployee) {
      url += `?employee=${encodeURIComponent(selectedEmployee)}`;
    }
    return url;
  }, []);

  const startTask = useCallback(async (rowId, selectedEmployee = '') => {
    const response = await fetch(lifecycleUrl(rowId, 'start', selectedEmployee), { method: 'POST' });
    return await handleResponse(response);
  }, [handleResponse, lifecycleUrl]);

  const pauseTask = useCallback(async (rowId, selectedEmployee = '') => {
    const response = await fetch(lifecycleUrl(rowId, 'pause', selectedEmployee), { method: 'POST' });
    return await handleResponse(response);
  }, [handleResponse, lifecycleUrl]);

  const resumeTask = useCallback(async (rowId, selectedEmployee = '') => {
    const response = await fetch(lifecycleUrl(rowId, 'resume', selectedEmployee), { method: 'POST' });
    return await handleResponse(response);
  }, [handleResponse, lifecycleUrl]);

  const completeTask = useCallback(async (rowId, selectedEmployee = '') => {
    const response = await fetch(lifecycleUrl(rowId, 'complete', selectedEmployee), { method: 'POST' });
    return await handleResponse(response);
  }, [handleResponse, lifecycleUrl]);

  const openFile = useCallback(async (row) => {
    const relativePath = normalizePathForOpen(row.folderPath, row.fileName);
    if (!relativePath || relativePath === '/') {
      throw new Error('Путь к файлу не указан');
    }
    const result = await openFileOnClient(relativePath, {
      folderPath: row.folderPath,
      fileName: row.fileName
    });
    if (!result.ok) {
      throw new Error(result.reason || 'Не удалось открыть файл');
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
    fetchTableRow,
    loadRows,
    loadChildren,
    createRow,
    updateRow,
    getIntervals,
    updateIntervals,
    deleteRow,
    startTask,
    pauseTask,
    resumeTask,
    completeTask,
    openFile,
    getTaskForSplit,
    splitTask
  }), [fetchTableRow, loadRows, loadChildren, createRow, updateRow, getIntervals, updateIntervals, deleteRow, startTask, pauseTask, resumeTask, completeTask, openFile, getTaskForSplit, splitTask]);

  return api;
}