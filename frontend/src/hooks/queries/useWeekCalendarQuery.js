import { useQuery } from '@tanstack/react-query';
import { getWeekCalendar } from '../../services/api';
import { FIVE_MINUTES_MS } from '../../constants/pollIntervals';
import { queryKeys } from '../../lib/queryKeys';

export default function useWeekCalendarQuery(employee, weekStart) {
  const weekStartKey = weekStart ? weekStart.toISOString() : '';

  return useQuery({
    queryKey: queryKeys.weekCalendar(employee, weekStartKey),
    queryFn: ({ signal }) => getWeekCalendar(employee, weekStart, { signal }),
    enabled: Boolean(employee && weekStart),
    refetchInterval: FIVE_MINUTES_MS,
    refetchOnWindowFocus: true
  });
}
