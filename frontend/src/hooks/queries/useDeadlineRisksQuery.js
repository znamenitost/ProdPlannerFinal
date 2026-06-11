import { useMemo } from 'react';
import { useClockMinuteTick } from '../../context/ClockContext';
import { mapActiveTasksToDeadlineRisks } from '../../utils/deadlineRisks';
import useActiveTasksQuery from './useActiveTasksQuery';

/** Риски по дедлайну из кэша активных задач — без отдельного API. */
export default function useDeadlineRisksQuery(employee) {
  const tick = useClockMinuteTick(Boolean(employee));
  const query = useActiveTasksQuery(employee);
  const tasks = query.data ?? [];

  const data = useMemo(
    () => mapActiveTasksToDeadlineRisks(tasks, new Date()),
    [tasks, tick]
  );

  return {
    data,
    isPending: query.isPending,
    isError: query.isError,
    isFetching: query.isFetching
  };
}
