import { Box, Typography } from '@mui/material';
import { isOverdue } from '../../utils/taskHelpers';

function formatDeadlineParts(deadline) {
  if (!deadline) return { date: '—', time: null };
  const d = new Date(deadline);
  return {
    date: d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    time: d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  };
}

export default function TaskDeadlineCell({ deadline, statusText }) {
  const overdue = isOverdue(deadline, statusText);
  const { date, time } = formatDeadlineParts(deadline);
  const color = overdue ? 'error.dark' : 'inherit';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25, gap: 0.125 }}>
      <Typography variant="body2" sx={{ color, fontSize: '0.8125rem', fontWeight: 600, whiteSpace: 'nowrap' }}>
        {date}
      </Typography>
      {time ? (
        <Typography
          variant="caption"
          sx={{ color, fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap', opacity: 0.9 }}
        >
          {time}
        </Typography>
      ) : null}
    </Box>
  );
}
