import { Typography } from '@mui/material';
import { cellDisplayTextSx } from '../../utils/taskTableStyles';

export default function TaskHoursCell({ estimateHours, fallback = '0.0' }) {
  const value = estimateHours != null ? estimateHours.toFixed(1) : fallback;
  return (
    <Typography variant="body2" sx={cellDisplayTextSx}>
      {value} ч
    </Typography>
  );
}
