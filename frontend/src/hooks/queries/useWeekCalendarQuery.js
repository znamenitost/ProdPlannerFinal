import { useQuery } from '@tanstack/react-query';
import { getWeekCalendar } from '../../services/api';
import { queryKeys } from '../../lib/queryKeys';

// Календарь содержит открытые интервалы и блоки простоя, которые «растут» вместе с
// текущим временем. Обновляемся раз в минуту, чтобы now-маркер и длины блоков
// двигались по таймлайну без ручного refresh.
const ONE_MINUTE_MS = 60_000;

export default function useWeekCalendarQuery(employee, weekStart) {
  const weekStartKey = weekStart ? weekStart.toISOString() : '';

  return useQuery({
    queryKey: queryKeys.weekCalendar(employee, weekStartKey),
    queryFn: ({ signal }) => getWeekCalendar(employee, weekStart, { signal }),
    enabled: Boolean(employee && weekStart),
    refetchInterval: ONE_MINUTE_MS,
    refetchOnWindowFocus: true
  });
}
