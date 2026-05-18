import { Box, Typography } from '@mui/material';
import {
  WORK_HOUR_MIN,
  WORK_HOUR_MAX,
  formatHourAsTime,
  parseTimeToHour
} from '../utils/dateTimeHelpers';

const HOURS = Array.from(
  { length: WORK_HOUR_MAX - WORK_HOUR_MIN + 1 },
  (_, i) => WORK_HOUR_MIN + i
);

const SIZE = 280;
const CENTER = SIZE / 2;
const RADIUS = 102;
const BUTTON_SIZE = 40;
const POINTER_LENGTH = RADIUS - 28;

function getHourPosition(index, total) {
  const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
  return {
    angle,
    x: CENTER + RADIUS * Math.cos(angle),
    y: CENTER + RADIUS * Math.sin(angle),
  };
}

export default function WorkHourDial({ value, onChange }) {
  const selectedHour = parseTimeToHour(value);
  const selectedIndex = HOURS.indexOf(selectedHour);
  const pointerAngle = (selectedIndex / HOURS.length) * 2 * Math.PI - Math.PI / 2;

  return (
    <Box
      sx={{
        position: 'relative',
        width: SIZE,
        height: SIZE,
        mx: 'auto',
        userSelect: 'none',
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          inset: 12,
          borderRadius: '50%',
          border: '1px solid',
          borderColor: 'divider',
          bgcolor: 'grey.50',
        }}
      />

      <Box
        sx={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: 2,
          height: POINTER_LENGTH,
          ml: '-1px',
          bgcolor: 'primary.main',
          transformOrigin: 'center bottom',
          transform: `translateY(-100%) rotate(${pointerAngle}rad)`,
          transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), height 0.2s',
          borderRadius: 1,
          zIndex: 0,
          pointerEvents: 'none',
        }}
      />

      <Box
        sx={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: 8,
          height: 8,
          ml: -0.5,
          mt: -0.5,
          borderRadius: '50%',
          bgcolor: 'primary.main',
          zIndex: 2,
          pointerEvents: 'none',
        }}
      />

      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      >
        <Typography variant="h5" fontWeight={700} color="primary.main">
          {formatHourAsTime(selectedHour)}
        </Typography>
      </Box>

      {HOURS.map((hour, index) => {
        const { x, y } = getHourPosition(index, HOURS.length);
        const selected = hour === selectedHour;
        const half = BUTTON_SIZE / 2;

        return (
          <Box
            key={hour}
            role="button"
            tabIndex={0}
            aria-label={`${hour}:00`}
            aria-pressed={selected}
            onClick={() => onChange(formatHourAsTime(hour))}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onChange(formatHourAsTime(hour));
              }
            }}
            sx={{
              position: 'absolute',
              left: x - half,
              top: y - half,
              width: BUTTON_SIZE,
              height: BUTTON_SIZE,
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: selected ? 700 : 500,
              bgcolor: selected ? 'primary.main' : 'background.paper',
              color: selected ? 'primary.contrastText' : 'text.primary',
              border: '1px solid',
              borderColor: selected ? 'primary.main' : 'divider',
              boxShadow: selected ? 2 : 0,
              transition: 'background-color 0.15s, color 0.15s, box-shadow 0.15s',
              zIndex: 3,
              '&:hover': {
                bgcolor: selected ? 'primary.dark' : 'action.hover',
              },
              '&:focus-visible': {
                outline: '2px solid',
                outlineColor: 'primary.main',
                outlineOffset: 2,
              },
            }}
          >
            {hour}
          </Box>
        );
      })}
    </Box>
  );
}
