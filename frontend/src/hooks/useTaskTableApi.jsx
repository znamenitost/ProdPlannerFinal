import { useCallback, useMemo } from 'react';
import { openFileOnClient, openFolderOnClient } from '../utils/openFileOnClient';
import { normalizePathForOpen, normalizeFolderPathForOpen } from '../utils/filePathForOpen';
import {
  ensureFileOpenSettingsLoaded,
  getFileOpenShareName
} from '../utils/fileOpenSettingsCache';
import {
  createTimeoutSignal,
  formatHttpError,
  formatUserActionError,
  MUTATION_TIMEOUT_MS
} from '../utils/actionError';

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
      const err = new Error(formatHttpError(response.status, message, `Ошибка ${response.status}`));
      err.status = response.status;
      throw err;
    }
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return response.json();
    }
    return null;
  }, []);

  const request = useCallback(async (url, options = {}) => {
    const { timeoutMs, ...fetchOptions } = options;
    const timeout = timeoutMs && !fetchOptions.signal
      ? createTimeoutSignal(timeoutMs)
      : null;
    try {
      const response = await fetch(url, {
        ...fetchOptions,
        signal: fetchOptions.signal || timeout?.signal
      });
      return await handleResponse(response);
    } catch (err) {
      if (err?.status != null) throw err;
      const wrapped = new Error(formatUserActionError(err, 'Нет связи с сервером'));
      wrapped.cause = err;
      wrapped.code = err?.name === 'AbortError' ? 'timeout' : 'network';
      throw wrapped;
    } finally {
      timeout?.clear();
    }
  }, [handleResponse]);

  const fetchTableRow = useCallback(async (id, selectedEmployee = '') => {
    let url = `/api/tasks/table/row/${id}`;
    if (selectedEmployee) {
      url += `?employee=${encodeURIComponent(selectedEmployee)}`;
    }
    return request(url);
  }, [request]);

  const loadRows = useCallback(async (page = 1, pageSize = 50, selectedEmployee = '', options = {}) => {
    let url = `/api/tasks/table?page=${page}&pageSize=${pageSize}`;
    if (selectedEmployee) {
      url += `&employee=${encodeURIComponent(selectedEmployee)}`;
    }
    if (options.excludeCompleted) {
      url += '&excludeCompleted=true';
    }
    if (options.showFuss) {
      url += '&showFuss=true';
    }
    if (options.pickupMode) {
      url += '&pickupMode=true';
    }
    const search = String(options.search ?? '').trim();
    if (search) {
      url += `&search=${encodeURIComponent(search)}`;
    }
    const data = await request(url, { signal: options.signal });
    if (data.items && data.totalCount !== undefined) {
      return { items: data.items, totalCount: data.totalCount, page: data.page, pageSize: data.pageSize };
    }
    return { items: data, totalCount: data.length, page: 1, pageSize: data.length };
  }, [request]);

  const loadChildren = useCallback(async (parentId) => {
    return request(`/api/tasks/split/children/${parentId}`);
  }, [request]);

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
    return request('/api/tasks/table/row', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      timeoutMs: MUTATION_TIMEOUT_MS
    });
  }, [request]);

  const updateRow = useCallback(async (id, rowData) => {
    return request(`/api/tasks/table/row/${id}`, {
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
        priorityMarked: rowData.priorityMarked ?? null,
        sequenceOverride: rowData.sequenceOverride ?? false,
        expectedUpdatedAt: rowData.expectedUpdatedAt ?? null,
        commentEditedViaDialog: rowData.commentEditedViaDialog ?? null
      }),
      timeoutMs: MUTATION_TIMEOUT_MS
    });
  }, [request]);

  const getIntervals = useCallback(async (taskId) => {
    return request(`/api/tasks/table/row/${taskId}/intervals`);
  }, [request]);

  const updateIntervals = useCallback(async (taskId, intervals) => {
    return request(`/api/tasks/table/row/${taskId}/intervals`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intervals }),
      timeoutMs: MUTATION_TIMEOUT_MS
    });
  }, [request]);

  const deleteRow = useCallback(async (id) => {
    try {
      await request(`/api/tasks/table/row/${id}`, {
        method: 'DELETE',
        timeoutMs: MUTATION_TIMEOUT_MS
      });
    } catch (err) {
      if (err?.status !== 405) throw err;
      await request(`/api/tasks/table/row/${id}/delete`, {
        method: 'POST',
        timeoutMs: MUTATION_TIMEOUT_MS
      });
    }
  }, [request]);

  const lifecycleUrl = useCallback((rowId, action, selectedEmployee = '') => {
    let url = `/api/tasks/${rowId}/${action}`;
    if (selectedEmployee) {
      url += `?employee=${encodeURIComponent(selectedEmployee)}`;
    }
    return url;
  }, []);

  const startTask = useCallback(async (rowId, selectedEmployee = '', comment = null) => {
    return request(lifecycleUrl(rowId, 'start', selectedEmployee), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(comment ? { comment } : {}),
      timeoutMs: MUTATION_TIMEOUT_MS
    });
  }, [request, lifecycleUrl]);

  const pauseTask = useCallback(async (rowId, selectedEmployee = '') => {
    return request(lifecycleUrl(rowId, 'pause', selectedEmployee), {
      method: 'POST',
      timeoutMs: MUTATION_TIMEOUT_MS
    });
  }, [request, lifecycleUrl]);

  const resumeTask = useCallback(async (rowId, selectedEmployee = '') => {
    return request(lifecycleUrl(rowId, 'resume', selectedEmployee), {
      method: 'POST',
      timeoutMs: MUTATION_TIMEOUT_MS
    });
  }, [request, lifecycleUrl]);

  const completeTask = useCallback(async (rowId, selectedEmployee = '') => {
    return request(lifecycleUrl(rowId, 'complete', selectedEmployee), {
      method: 'POST',
      timeoutMs: MUTATION_TIMEOUT_MS
    });
  }, [request, lifecycleUrl]);

  const openFile = useCallback(async (row) => {
    await ensureFileOpenSettingsLoaded();
    const relativePath = normalizePathForOpen(row.folderPath, row.fileName, getFileOpenShareName());
    if (!relativePath || relativePath === '/') {
      throw new Error('Путь к файлу не указан');
    }
    const result = await openFileOnClient(relativePath);
    if (!result.ok) {
      throw new Error(result.reason || 'Не удалось открыть файл');
    }
  }, []);

  const openFolder = useCallback(async (row) => {
    await ensureFileOpenSettingsLoaded();
    const relativePath = normalizeFolderPathForOpen(row.folderPath, getFileOpenShareName());
    if (!relativePath || relativePath === '/') {
      throw new Error('Путь к папке не указан');
    }
    const result = await openFolderOnClient(relativePath);
    if (!result.ok) {
      throw new Error(result.reason || 'Не удалось открыть папку');
    }
  }, []);

  const getTaskForSplit = useCallback(async (employeeName, taskId) => {
    const tasks = await request(`/api/tasks/active?employee=${encodeURIComponent(employeeName)}`);
    const task = tasks.find(t => t.id === taskId);
    if (!task) throw new Error('Не удалось найти задачу для разделения');
    return task;
  }, [request]);

  const splitTask = useCallback(async (parentTaskId, parts) => {
    return request('/api/tasks/split', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentTaskId, parts }),
      timeoutMs: MUTATION_TIMEOUT_MS
    });
  }, [request]);

  const setPriorityRank = useCallback(async (id, rank) => {
    return request(`/api/tasks/table/row/${id}/priority-rank`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rank: rank ?? null }),
      timeoutMs: MUTATION_TIMEOUT_MS
    });
  }, [request]);

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
    openFolder,
    getTaskForSplit,
    splitTask,
    setPriorityRank
  }), [fetchTableRow, loadRows, loadChildren, createRow, updateRow, getIntervals, updateIntervals, deleteRow, startTask, pauseTask, resumeTask, completeTask, openFile, openFolder, getTaskForSplit, splitTask, setPriorityRank]);

  return api;
}