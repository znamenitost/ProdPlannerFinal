import { Paper, Typography, Box, Stack, Chip } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Summarize } from '@mui/icons-material';
import { sectionTitleRowSx } from '../theme/surfaces';
import useDailyReportQuery from '../hooks/queries/useDailyReportQuery';
import EmptyState from './ui/EmptyState';
import { formatDailyReportLine, formatHoursRu } from '../utils/dailyReportFormat';

export default function DayReportList({ employee }) {
  const { data } = useDailyReportQuery(employee, Boolean(employee));
  const items = data?.items ?? [];
  const totalHours = data?.totalHours ?? 0;

  return (
    <Paper variant="section" sx={{ mb: 3 }}>
      <Box sx={{ ...sectionTitleRowSx, mb: 2 }}>
        <Summarize color="primary" />
        <Typography variant="h2" component="h2">
          Отчёт за сегодня
        </Typography>
        {items.length > 0 && (
          <Chip
            size="small"
            label={`Итого: ${formatHoursRu(totalHours)}`}
            color="primary"
            variant="outlined"
            sx={{ ml: 'auto' }}
          />
        )}
      </Box>

      {items.length === 0 ? (
        <EmptyState message="Сегодня ещё не было работы по задачам" icon={Summarize} />
      ) : (
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
      )}
    </Paper>
  );
}
