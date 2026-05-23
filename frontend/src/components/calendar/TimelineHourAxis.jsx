import { Box, Typography } from '@mui/material';
import { positionLeftTransitionSx } from '../../theme/motion';
import { DETAIL_AXIS_END_HOUR, DETAIL_AXIS_START_HOUR } from '../../utils/calendarDayUtils';

export default function TimelineHourAxis({
  startHour = DETAIL_AXIS_START_HOUR,
  endHour = DETAIL_AXIS_END_HOUR,
  nowLeft = null
}) {
  const hours = [];
  for (let h = startHour; h <= endHour; h += 1) {
    hours.push(h);
  }
  const span = endHour - startHour;

  return (
    <Box
      sx={{
        position: 'relative',
        height: 18,
        mt: 0.5,
        mb: 1,
        borderTop: '1px solid',
        borderColor: 'divider'
      }}
    >
      {hours.map((hour) => {
        const left = ((hour - startHour) / span) * 100;
        return (
          <Typography
            key={hour}
            variant="caption"
            sx={{
              position: 'absolute',
              left: `${left}%`,
              transform: 'translateX(-50%)',
              fontSize: '0.65rem',
              color: 'text.secondary',
              lineHeight: 1.2,
              userSelect: 'none'
            }}
          >
            {hour}:00
          </Typography>
        );
      })}
      {nowLeft != null && (
        <Box
          sx={{
            position: 'absolute',
            left: `${nowLeft}%`,
            top: '50%',
            transform: 'translate(-50%, -50%)',
            width: 10,
            height: 10,
            borderRadius: '50%',
            bgcolor: 'error.main',
            border: '2px solid',
            borderColor: 'background.paper',
            boxShadow: (theme) => `0 0 0 1px ${theme.palette.error.main}`,
            zIndex: 2,
            ...positionLeftTransitionSx
          }}
        />
      )}
    </Box>
  );
}
