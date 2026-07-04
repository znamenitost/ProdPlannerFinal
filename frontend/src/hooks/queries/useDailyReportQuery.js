import { useQuery } from '@tanstack/react-query';
import { getDailyReport } from '../../services/api';
import { queryKeys } from '../../lib/queryKeys';
import { toCalendarDayKey } from '../../utils/calendarDayUtils';

const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Ключ кэша и параметр API для отчёта за день. */
export function resolveDailyReportDateKey(dateOrKey) {
  if (!dateOrKey) return 'today';
  if (typeof dateOrKey === 'string' && DAY_KEY_RE.test(dateOrKey)) return dateOrKey;
  const key = toCalendarDayKey(dateOrKey);
  return key || 'today';
}

export default function useDailyReportQuery(employee, dateOrKey = null, enabled = true) {
  const dateKey = resolveDailyReportDateKey(dateOrKey);
  const requestDate = dateOrKey ? dateKey : undefined;

  return useQuery({
    queryKey: queryKeys.dailyReport(employee, dateKey),
    queryFn: ({ signal }) => getDailyReport(employee, { signal, date: requestDate }),
    enabled: Boolean(employee) && enabled,
    staleTime: 30_000
  });
}
