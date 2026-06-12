import { useCallback, useEffect, useState } from 'react';
import { getPlannedProgressStorageKey } from '../../constants/taskTableColumnsConfig';

function loadStoredShowPlannedProgress(storageKey) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw == null) return false;
    return JSON.parse(raw) === true;
  } catch {
    return false;
  }
}

function persistShowPlannedProgress(storageKey, value) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(Boolean(value)));
  } catch { /* private mode / quota */ }
}

export default function useTaskTablePlannedProgressPreference(currentUser) {
  const storageKey = getPlannedProgressStorageKey(currentUser);
  const [showPlannedProgress, setShowPlannedProgressState] = useState(
    () => loadStoredShowPlannedProgress(storageKey)
  );

  useEffect(() => {
    setShowPlannedProgressState(loadStoredShowPlannedProgress(storageKey));
  }, [storageKey]);

  const setShowPlannedProgress = useCallback((value) => {
    const next = Boolean(value);
    setShowPlannedProgressState(next);
    persistShowPlannedProgress(storageKey, next);
  }, [storageKey]);

  const toggleShowPlannedProgress = useCallback(() => {
    setShowPlannedProgress(!showPlannedProgress);
  }, [showPlannedProgress, setShowPlannedProgress]);

  return {
    showPlannedProgress,
    setShowPlannedProgress,
    toggleShowPlannedProgress
  };
}
