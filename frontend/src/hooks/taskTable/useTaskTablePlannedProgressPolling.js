import { useEffect, useRef } from 'react';
import { FIVE_MINUTES_MS } from '../../constants/pollIntervals';
import {
  collectInProgressProgressTaskIds,
  isTaskStatusInProgress,
  pickPlannedProgressPatch
} from '../../utils/taskTablePlannedProgress';

/**
 * Раз в 5 минут точечно обновляет plannedTimeProgress только у видимых задач «Начал».
 * Только если пользователь включил отображение прогресс-бара.
 */
export default function useTaskTablePlannedProgressPolling({
  enabled,
  api,
  rows,
  childrenCache,
  expandedRows,
  autoExpandIds,
  selectedEmployeeForHighlight,
  patchRow,
  patchChildInCache
}) {
  const ctxRef = useRef({});
  ctxRef.current = {
    rows,
    childrenCache,
    expandedRows,
    autoExpandIds,
    selectedEmployeeForHighlight,
    patchRow,
    patchChildInCache
  };

  useEffect(() => {
    if (!enabled) return undefined;

    const tick = async () => {
      const {
        rows: currentRows,
        childrenCache: cache,
        expandedRows: expanded,
        autoExpandIds: autoExpand,
        selectedEmployeeForHighlight: employeeFilter,
        patchRow: patchParent,
        patchChildInCache: patchChild
      } = ctxRef.current;

      const targets = collectInProgressProgressTaskIds({
        rows: currentRows,
        childrenCache: cache,
        expandedRows: expanded,
        autoExpandIds: autoExpand ?? new Set()
      });
      if (targets.length === 0) return;

      const employee = employeeFilter || '';
      await Promise.all(
        targets.map(async ({ id, isChild }) => {
          try {
            const updated = await api.fetchTableRow(id, employee);
            if (!updated || !isTaskStatusInProgress(updated)) return;

            const patch = pickPlannedProgressPatch(updated);
            if (isChild) {
              patchChild(id, patch);
              return;
            }
            if (currentRows.some((row) => row.id === id)) {
              patchParent(id, patch);
            }
          } catch (err) {
            console.warn('Planned progress poll failed for task', id, err);
          }
        })
      );
    };

    const intervalId = window.setInterval(tick, FIVE_MINUTES_MS);
    return () => window.clearInterval(intervalId);
  }, [enabled, api]);
}
