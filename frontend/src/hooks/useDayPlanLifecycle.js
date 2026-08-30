import { useCallback, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { completeTask, pauseTask, resumeTask, startTask } from '../services/api';
import { queryKeys } from '../lib/queryKeys';
import { useUiFeedback } from '../context/UiFeedbackContext';
import { formatUserActionError } from '../utils/actionError';
import { offerPrintLabelsAfterReady } from '../utils/printLabelPrompt';

export default function useDayPlanLifecycle(employee) {
  const queryClient = useQueryClient();
  const { showError, showSuccess, promptInput } = useUiFeedback();
  const [pendingTaskId, setPendingTaskId] = useState(null);
  const pendingTaskIdRef = useRef(null);

  const refresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.dayPlanAll(employee) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.activeTasks(employee) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.weekCalendarAll(employee) }),
      queryClient.invalidateQueries({ queryKey: queryKeys.taskTableAll() })
    ]);
  }, [employee, queryClient]);

  const runAction = useCallback(async (task, action) => {
    if (!task?.id || pendingTaskIdRef.current != null) return;
    pendingTaskIdRef.current = task.id;
    setPendingTaskId(task.id);

    try {
      let completeResult = null;
      if (action === 'start') await startTask(task.id);
      else if (action === 'pause') await pauseTask(task.id);
      else if (action === 'resume') await resumeTask(task.id);
      else if (action === 'complete') completeResult = await completeTask(task.id);
      else return;
      await refresh();
      if (action === 'complete') {
        await offerPrintLabelsAfterReady(promptInput, task, {
          showSuccess,
          showError,
          parentTask: completeResult?.parentRow ?? null
        });
      }
    } catch (err) {
      console.error('Ошибка действия с задачей плана дня:', err);
      if (err?.code === 'concurrency_conflict') {
        await refresh();
      }
      showError(formatUserActionError(err, 'Не удалось выполнить действие'));
    } finally {
      pendingTaskIdRef.current = null;
      setPendingTaskId(null);
    }
  }, [promptInput, refresh, showError, showSuccess]);

  return { runAction, pendingTaskId };
}
