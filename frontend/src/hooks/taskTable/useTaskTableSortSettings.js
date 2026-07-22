import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchTaskTableSortSettings,
  saveTaskTableSortSettings
} from '../../services/taskTableSortSettingsApi';
import useUserPreference from '../useUserPreference';

export const TASK_TABLE_SORT_DEFAULTS = {
  deadlineSort: false,
  completedBottomSort: true,
  hideCompletedSort: false,
  hideCompletedInSharedSort: false,
  showFuss: false
};

function normalizeSortSettings(raw) {
  return {
    deadlineSort: Boolean(raw?.deadlineSort),
    completedBottomSort: raw?.completedBottomSort !== false,
    hideCompletedSort: Boolean(raw?.hideCompletedSort),
    hideCompletedInSharedSort: Boolean(raw?.hideCompletedInSharedSort),
    showFuss: Boolean(raw?.showFuss)
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
  const [hideCompletedInSharedSort, setHideCompletedInSharedSort] = useUserPreference(
    currentUser,
    'taskTable.hideCompletedInSharedSort',
    TASK_TABLE_SORT_DEFAULTS.hideCompletedInSharedSort
  );
  const [showFuss, setShowFuss] = useUserPreference(
    currentUser,
    'taskTable.showFuss',
    TASK_TABLE_SORT_DEFAULTS.showFuss
  );
  const [settingsReady, setSettingsReady] = useState(false);
  const saveTimerRef = useRef(null);
  const hydratedRef = useRef(false);
  const snapshotRef = useRef(normalizeSortSettings(TASK_TABLE_SORT_DEFAULTS));

  snapshotRef.current = normalizeSortSettings({
    deadlineSort,
    completedBottomSort,
    hideCompletedSort,
    hideCompletedInSharedSort,
    showFuss
  });

  const applySettings = useCallback((next) => {
    const normalized = normalizeSortSettings(next);
    setDeadlineSort(normalized.deadlineSort);
    setCompletedBottomSort(normalized.completedBottomSort);
    setHideCompletedSort(normalized.hideCompletedSort);
    setHideCompletedInSharedSort(normalized.hideCompletedInSharedSort);
    setShowFuss(normalized.showFuss);
    return normalized;
  }, [
    setCompletedBottomSort,
    setDeadlineSort,
    setHideCompletedSort,
    setHideCompletedInSharedSort,
    setShowFuss
  ]);

  const scheduleRemoteSave = useCallback((settings) => {
    if (!currentUser?.id || !hydratedRef.current) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void saveTaskTableSortSettings({
        deadlineSort: settings.deadlineSort,
        completedBottomSort: settings.completedBottomSort,
        hideCompletedSort: settings.hideCompletedSort,
        hideCompletedInSharedSort: settings.hideCompletedInSharedSort,
        showFuss: settings.showFuss
      }).catch(() => {});
    }, 300);
  }, [currentUser?.id]);

  const updateSetting = useCallback((key, next) => {
    const setter = key === 'deadlineSort'
      ? setDeadlineSort
      : key === 'completedBottomSort'
        ? setCompletedBottomSort
        : key === 'hideCompletedSort'
          ? setHideCompletedSort
          : key === 'showFuss'
            ? setShowFuss
            : setHideCompletedInSharedSort;

    setter((prev) => {
      const resolved = typeof next === 'function' ? next(prev) : next;
      const settings = normalizeSortSettings({
        ...snapshotRef.current,
        [key]: resolved
      });
      scheduleRemoteSave(settings);
      return resolved;
    });
  }, [
    scheduleRemoteSave,
    setCompletedBottomSort,
    setDeadlineSort,
    setHideCompletedSort,
    setHideCompletedInSharedSort,
    setShowFuss
  ]);

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
            hideCompletedSort: local.hideCompletedSort,
            hideCompletedInSharedSort: local.hideCompletedInSharedSort,
            showFuss: local.showFuss
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
    hideCompletedInSharedSort,
    setHideCompletedInSharedSort: (next) => updateSetting('hideCompletedInSharedSort', next),
    showFuss,
    setShowFuss: (next) => updateSetting('showFuss', next),
    settingsReady
  };
}
