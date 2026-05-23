import { Box } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';

/**
 * Вертикальная сетка для дневного таймлайна (часы и опционально полчаса).
 */
export default function TimelineGridLines({ range, showHalfHours = true }) {
  const theme = useTheme();
  const span = range.end - range.start;
  const lines = [];

  for (let hour = range.start; hour <= range.end; hour += 1) {
    lines.push({
      key: `h-${hour}`,
      left: ((hour - range.start) / span) * 100,
      major: true
    });
  }

  if (showHalfHours) {
    for (let hour = range.start; hour < range.end; hour += 1) {
      lines.push({
        key: `half-${hour}`,
        left: ((hour + 0.5 - range.start) / span) * 100,
        major: false
      });
    }
  }

  return (
    <>
      {lines.map(({ key, left, major }) => (
        <Box
          key={key}
          sx={{
            position: 'absolute',
            left: `${left}%`,
            top: 0,
            bottom: 0,
            width: '1px',
            transform: 'translateX(-50%)',
            pointerEvents: 'none',
            bgcolor: major
              ? 'divider'
              : alpha(theme.palette.divider, 0.65),
            opacity: major ? 1 : 0.55
          }}
        />
      ))}
    </>
  );
}
