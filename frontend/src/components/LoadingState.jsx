import { Box, CircularProgress, Skeleton, Typography } from '@mui/material';

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

export function CalendarLoadingSkeleton() {
  return (
    <Box sx={{ py: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mb: 3 }}>
        <Skeleton variant="circular" width={40} height={40} />
        <Skeleton variant="text" width={220} height={32} />
        <Skeleton variant="circular" width={40} height={40} />
      </Box>
      <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} variant="rounded" width={160} height={320} sx={{ borderRadius: 2 }} />
        ))}
      </Box>
    </Box>
  );
}
