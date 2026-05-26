import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  getColumnStorageKey,
  TASK_TABLE_DEFAULT_COLUMN_VISIBILITY,
  TASK_TABLE_DEFAULT_TEXT_LIMIT,
  TASK_TABLE_TOGGLEABLE_COLUMNS
} from '../../constants/taskTableColumnsConfig';

function loadStoredVisibility(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return { ...TASK_TABLE_DEFAULT_COLUMN_VISIBILITY };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      return { ...TASK_TABLE_DEFAULT_COLUMN_VISIBILITY };
    }
    const merged = { ...TASK_TABLE_DEFAULT_COLUMN_VISIBILITY };
    for (const { id } of TASK_TABLE_TOGGLEABLE_COLUMNS) {
      if (typeof parsed[id] === 'boolean') {
        merged[id] = parsed[id];
      }
    }
    return merged;
  } catch {
    return { ...TASK_TABLE_DEFAULT_COLUMN_VISIBILITY };
  }
}

function loadStoredTextLimit(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey + '.textLimit');
    if (raw == null) return TASK_TABLE_DEFAULT_TEXT_LIMIT;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n >= 10 && n <= 60 ? n : TASK_TABLE_DEFAULT_TEXT_LIMIT;
  } catch {
    return TASK_TABLE_DEFAULT_TEXT_LIMIT;
  }
}

function persistVisibility(storageKey, visibility) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(visibility));
  } catch { /* private mode / quota */ }
}

function persistTextLimit(storageKey, limit) {
  try {
    localStorage.setItem(storageKey + '.textLimit', String(limit));
  } catch { /* private mode / quota */ }
}

export default function useTaskTableColumnVisibility(currentUser) {
  const storageKey = getColumnStorageKey(currentUser);
  const prevKeyRef = useRef(storageKey);

  const [visibility, setVisibility] = useState(() => loadStoredVisibility(storageKey));
  const [textLimit, setTextLimitState] = useState(() => loadStoredTextLimit(storageKey));

  useEffect(() => {
    if (prevKeyRef.current !== storageKey) {
      prevKeyRef.current = storageKey;
      setVisibility(loadStoredVisibility(storageKey));
      setTextLimitState(loadStoredTextLimit(storageKey));
    }
  }, [storageKey]);

  const setColumnVisible = useCallback((columnId, visible) => {
    setVisibility((prev) => {
      const next = { ...prev, [columnId]: Boolean(visible) };
      persistVisibility(storageKey, next);
      return next;
    });
  }, [storageKey]);

  const setTextLimit = useCallback((limit) => {
    const clamped = Math.max(10, Math.min(60, Number(limit) || TASK_TABLE_DEFAULT_TEXT_LIMIT));
    setTextLimitState(clamped);
    persistTextLimit(storageKey, clamped);
  }, [storageKey]);

  const resetColumns = useCallback(() => {
    const next = { ...TASK_TABLE_DEFAULT_COLUMN_VISIBILITY };
    persistVisibility(storageKey, next);
    setVisibility(next);
    setTextLimitState(TASK_TABLE_DEFAULT_TEXT_LIMIT);
    persistTextLimit(storageKey, TASK_TABLE_DEFAULT_TEXT_LIMIT);
  }, [storageKey]);

  const visibleToggleableCount = useMemo(
    () => TASK_TABLE_TOGGLEABLE_COLUMNS.filter(({ id }) => visibility[id]).length,
    [visibility]
  );

  return {
    visibility,
    setColumnVisible,
    textLimit,
    setTextLimit,
    resetColumns,
    visibleToggleableCount
  };
}
