import { Box, CircularProgress, Typography } from '@mui/material';

export function LoadingState({ message = 'Загрузка...', fullScreen = false, size = 40 }) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        py: fullScreen ? 0 : 4,
        ...(fullScreen && { minHeight: '100vh' }),
      }}
    >
      <CircularProgress size={size} color="primary" />
      {message && (
        <Typography variant="body2" color="text.secondary">
          {message}
        </Typography>
      )}
    </Box>
  );
}

export function CalendarLoadingState() {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 400,
        py: 6,
      }}
    >
      <CircularProgress size={48} color="primary" />
    </Box>
  );
}
