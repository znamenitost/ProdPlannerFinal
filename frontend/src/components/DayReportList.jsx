import { useMemo } from 'react';
import { Paper, Typography, Box, Stack } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Summarize, AccessTime } from '@mui/icons-material';
import { sectionTitleRowSx } from '../theme/surfaces';
import useDailyReportQuery from '../hooks/queries/useDailyReportQuery';
import EmptyState from './ui/EmptyState';
import { formatDailyReportLine, formatPersonHoursRu } from '../utils/dailyReportFormat';
import { parseCalendarDayKey, toCalendarDayKey } from '../utils/calendarDayUtils';

function formatReportTitle(date, isToday) {
  if (isToday) return 'Отчёт за сегодня';
  return `Отчёт за ${date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}`;
}

function formatEmptyMessage(isToday) {
  return isToday
    ? 'Сегодня ещё не было работы по задачам'
    : 'За этот день не было работы по задачам';
}

export default function DayReportList({ employee, dateKey = null, embedded = false }) {
  const reportDate = useMemo(() => {
    if (!dateKey) return null;
    return parseCalendarDayKey(dateKey);
  }, [dateKey]);

  const todayKey = toCalendarDayKey(new Date());
  const isToday = !dateKey || dateKey === todayKey;
  const title = formatReportTitle(reportDate ?? new Date(), isToday);
  const { data } = useDailyReportQuery(employee, dateKey, Boolean(employee));
  const items = data?.items ?? [];
  const totalHours = data?.totalHours ?? 0;

  const content = (
    <>
      <Box sx={{ ...sectionTitleRowSx, mb: embedded ? 1.5 : 2 }}>
        <Summarize color="primary" fontSize={embedded ? 'small' : 'medium'} />
        <Typography variant={embedded ? 'subtitle1' : 'h2'} component="h2">
          {title}
        </Typography>
      </Box>

      {items.length === 0 ? (
        <EmptyState message={formatEmptyMessage(isToday)} icon={Summarize} />
      ) : (
        <>
          <Stack component="ul" spacing={1} sx={{ listStyle: 'none', m: 0, p: 0 }}>
            {items.map((item) => (
              <Box
                component="li"
                key={item.taskId}
                sx={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 1,
                  py: 0.75,
                  px: 1,
                  borderRadius: 1.5,
                  bgcolor: (theme) => (item.isCompleted
                    ? alpha(theme.palette.success.light, 0.25)
                    : alpha(theme.palette.info.light, 0.2)),
                  borderLeft: '3px solid',
                  borderLeftColor: item.isCompleted ? 'success.main' : 'info.main'
                }}
              >
                <Typography variant="body2" sx={{ flex: 1, minWidth: 0 }}>
                  {formatDailyReportLine(item)}
                </Typography>
              </Box>
            ))}
          </Stack>

          <Box
            sx={(theme) => ({
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 1,
              mt: 2,
              pt: 1.5,
              borderTop: `1px solid ${alpha(theme.palette.divider, 0.8)}`
            })}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AccessTime color="primary" fontSize="small" />
              <Typography variant="subtitle2" color="text.secondary">
                Итого за день
              </Typography>
            </Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
              {formatPersonHoursRu(totalHours)}
            </Typography>
          </Box>
        </>
      )}
    </>
  );

  if (embedded) {
    return <Box sx={{ mt: 2 }}>{content}</Box>;
  }

  return (
    <Paper variant="section" sx={{ mb: 3 }}>
      {content}
    </Paper>
  );
}
