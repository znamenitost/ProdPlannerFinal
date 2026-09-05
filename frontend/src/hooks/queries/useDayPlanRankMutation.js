import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { setPriorityRank } from '../../services/api';
import { queryKeys } from '../../lib/queryKeys';
import { useUiFeedback } from '../../context/UiFeedbackContext';
import { formatUserActionError } from '../../utils/actionError';

export default function useDayPlanRankMutation(employee) {
  const queryClient = useQueryClient();
  const { showError } = useUiFeedback();
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);

  const assign = useCallback(async (change) => {
    if (!change || change.taskId == null) return;
    if (pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    try {
      await setPriorityRank(change.taskId, change.rank, {
        joinWave: Boolean(change.joinWave),
        appendWave: Boolean(change.appendWave),
        beforeTaskId: change.beforeTaskId ?? null,
        afterTaskId: change.afterTaskId ?? null
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.dayPlanAll(employee) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.taskTableAll() }),
        queryClient.invalidateQueries({ queryKey: queryKeys.weekCalendarAll(employee) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.activeTasks(employee) })
      ]);
    } catch (err) {
      showError(formatUserActionError(err, 'Не удалось изменить очередь задачи'));
    } finally {
      pendingRef.current = false;
      setPending(false);
    }
  }, [employee, queryClient, showError]);

  return { assign, pending };
}
