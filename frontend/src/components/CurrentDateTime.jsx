import { useState, useEffect } from 'react';
import { Box, Typography } from '@mui/material';
import { Schedule } from '@mui/icons-material';
import { metaPanelSx } from '../theme/surfaces';

const MOSCOW_TZ = 'Europe/Moscow';

function formatTime(date) {
  return date.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: MOSCOW_TZ,
  });
}

function formatDate(date) {
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    timeZone: MOSCOW_TZ,
  });
}

export default function CurrentDateTime() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <Box sx={metaPanelSx}>
      <Schedule color="primary" />
      <Box sx={{ textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
          {formatDate(now)}
        </Typography>
        <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
          {formatTime(now)}
        </Typography>
      </Box>
    </Box>
  );
}
