import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchTaskTableSortSettings,
  saveTaskTableSortSettings
} from '../services/taskTableSortSettingsApi';
import useUserPreference from '../useUserPreference';

export const TASK_TABLE_SORT_DEFAULTS = {
  deadlineSort: false,
  completedBottomSort: true,
  hideCompletedSort: false
};

function normalizeSortSettings(raw) {
  return {
    deadlineSort: Boolean(raw?.deadlineSort),
    completedBottomSort: raw?.completedBottomSort !== false,
    hideCompletedSort: Boolean(raw?.hideCompletedSort)
  };
}

export default function useTaskTableSortSettings(currentUser) {
  const [deadlineSort, setDeadlineSort] = useUserPreference(
    currentUser,
    'taskTable.deadlineSort',
    TASK_TABLE_SORT_DEFAULTS.deadlineSort
  );
  const [completedBottomSort, setCompletedBottomSort] = useUserPreference(
    currentUser,
    'taskTable.completedBottomSort',
    TASK_TABLE_SORT_DEFAULTS.completedBottomSort
  );
  const [hideCompletedSort, setHideCompletedSort] = useUserPreference(
    currentUser,
    'taskTable.hideCompletedSort',
    TASK_TABLE_SORT_DEFAULTS.hideCompletedSort
  );
  const [settingsReady, setSettingsReady] = useState(false);
  const saveTimerRef = useRef(null);
  const hydratedRef = useRef(false);
  const snapshotRef = useRef(normalizeSortSettings(TASK_TABLE_SORT_DEFAULTS));

  snapshotRef.current = normalizeSortSettings({
    deadlineSort,
    completedBottomSort,
    hideCompletedSort
  });

  const applySettings = useCallback((next) => {
    const normalized = normalizeSortSettings(next);
    setDeadlineSort(normalized.deadlineSort);
    setCompletedBottomSort(normalized.completedBottomSort);
    setHideCompletedSort(normalized.hideCompletedSort);
    return normalized;
  }, [setCompletedBottomSort, setDeadlineSort, setHideCompletedSort]);

  const scheduleRemoteSave = useCallback((settings) => {
    if (!currentUser?.id || !hydratedRef.current) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void saveTaskTableSortSettings({
        deadlineSort: settings.deadlineSort,
        completedBottomSort: settings.completedBottomSort,
        hideCompletedSort: settings.hideCompletedSort
      }).catch(() => {});
    }, 300);
  }, [currentUser?.id]);

  const updateSetting = useCallback((key, next) => {
    const setter = key === 'deadlineSort'
      ? setDeadlineSort
      : key === 'completedBottomSort'
        ? setCompletedBottomSort
        : setHideCompletedSort;

    setter((prev) => {
      const resolved = typeof next === 'function' ? next(prev) : next;
      const settings = normalizeSortSettings({
        ...snapshotRef.current,
        [key]: resolved
      });
      scheduleRemoteSave(settings);
      return resolved;
    });
  }, [scheduleRemoteSave, setCompletedBottomSort, setDeadlineSort, setHideCompletedSort]);

  useEffect(() => {
    if (!currentUser?.id) {
      hydratedRef.current = false;
      setSettingsReady(false);
      return undefined;
    }

    let cancelled = false;

    async function hydrate() {
      try {
        const remote = await fetchTaskTableSortSettings();
        if (cancelled) return;

        const local = normalizeSortSettings(snapshotRef.current);

        if (remote != null && typeof remote === 'object') {
          applySettings(normalizeSortSettings(remote));
        } else {
          await saveTaskTableSortSettings({
            deadlineSort: local.deadlineSort,
            completedBottomSort: local.completedBottomSort,
            hideCompletedSort: local.hideCompletedSort
          });
        }
      } catch {
        // localStorage остаётся источником при недоступности API
      } finally {
        if (!cancelled) {
          hydratedRef.current = true;
          setSettingsReady(true);
        }
      }
    }

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [applySettings, currentUser?.id]);

  useEffect(() => () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
  }, []);

  return {
    deadlineSort,
    setDeadlineSort: (next) => updateSetting('deadlineSort', next),
    completedBottomSort,
    setCompletedBottomSort: (next) => updateSetting('completedBottomSort', next),
    hideCompletedSort,
    setHideCompletedSort: (next) => updateSetting('hideCompletedSort', next),
    settingsReady
  };
}
