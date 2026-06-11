import { Typography } from '@mui/material';
import LazyTooltip from '../common/LazyTooltip';
import { cellDisplayTextSx } from '../../utils/taskTableStyles';

export default function TaskHoursCell({
  estimateHours,
  requiresTestBeforeProduction = false,
  testEstimateHours = 0,
  productionEstimateHours = 0,
  fallback = '0.0'
}) {
  const showSplit = requiresTestBeforeProduction
    && testEstimateHours > 0
    && productionEstimateHours > 0;
  const value = showSplit
    ? `${testEstimateHours.toFixed(1)} + ${productionEstimateHours.toFixed(1)}`
    : (estimateHours != null ? estimateHours.toFixed(1) : fallback);
  const label = `${value} ч`;

  if (showSplit) {
    return (
      <LazyTooltip title={label} arrow>
        <Typography
          variant="body2"
          sx={{ ...cellDisplayTextSx, display: 'block', maxWidth: '8ch', mx: 'auto' }}
        >
          {label}
        </Typography>
      </LazyTooltip>
    );
  }

  return (
    <Typography variant="body2" sx={cellDisplayTextSx}>
      {label}
    </Typography>
  );
}
