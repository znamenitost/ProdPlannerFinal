import { Typography } from '@mui/material';

export default function DayHeader({ date }) {
  const d = new Date(date);
  return (
    <Typography variant="subtitle1" fontWeight={600} sx={{ textAlign: 'center', mb: 2, color: 'text.primary' }}>
      {d.toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric' })}
    </Typography>
  );
}
