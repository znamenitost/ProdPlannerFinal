import { Typography } from '@mui/material';
import { isOverdue } from '../../utils/taskHelpers';
import { cellDisplayTextSx } from '../../utils/taskTableStyles';

function formatDeadline(deadline) {
  if (!deadline) return '—';
  const d = new Date(deadline);
  return `${d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
}

export default function TaskDeadlineCell({ deadline, statusText }) {
  const overdue = isOverdue(deadline, statusText);
  return (
    <Typography variant="body2" sx={{ color: overdue ? '#dc2626' : 'inherit', ...cellDisplayTextSx }}>
      {formatDeadline(deadline)}
    </Typography>
  );
}
