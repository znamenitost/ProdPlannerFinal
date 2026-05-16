import { Snackbar, Alert, Box, Typography } from '@mui/material';
import { Assignment, AccessTime } from '@mui/icons-material';

const SNACKBAR_HEIGHT = 88;

export default function PushNotificationSnackbars({ notifications, onClose }) {
  return (
    <>
      {notifications.map((notification, index) => (
        <Snackbar
          key={notification.id}
          open
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          sx={{
            bottom: { xs: 16 + index * SNACKBAR_HEIGHT, sm: 24 + index * SNACKBAR_HEIGHT },
            right: { xs: 16, sm: 24 },
            left: 'auto',
            zIndex: (theme) => theme.zIndex.snackbar + index,
          }}
        >
          <Alert
            severity="info"
            variant="filled"
            onClose={() => onClose(notification.id)}
            icon={<Assignment fontSize="small" />}
            sx={{
              width: '100%',
              minWidth: 280,
              maxWidth: 360,
              alignItems: 'flex-start',
              bgcolor: '#1e293b',
              '& .MuiAlert-icon': { color: '#7c9ebf', mt: 0.25 },
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 500, mb: 0.5 }}>
              {notification.title}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <AccessTime sx={{ fontSize: 14, opacity: 0.85 }} />
              <Typography variant="caption" sx={{ opacity: 0.9 }}>
                Дедлайн: {notification.deadline}
              </Typography>
            </Box>
          </Alert>
        </Snackbar>
      ))}
    </>
  );
}
