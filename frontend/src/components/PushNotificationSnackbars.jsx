import { Snackbar, Alert, Box, Typography } from '@mui/material';
import { Assignment, AccessTime } from '@mui/icons-material';

const SNACKBAR_HEIGHT = 88;

const alertDarkSx = {
  width: '100%',
  minWidth: 280,
  maxWidth: 360,
  alignItems: 'flex-start',
  bgcolor: '#1e293b',
  color: '#f8fafc',
  '& .MuiAlert-icon': { color: '#9bb9d9', mt: 0.25 },
  '& .MuiAlert-message': { color: '#f8fafc', padding: 0 },
  '& .MuiAlert-action .MuiIconButton-root': {
    color: '#cbd5e1',
    '&:hover': { color: '#f8fafc', bgcolor: 'rgba(255,255,255,0.08)' }
  },
  '& .MuiTypography-root': { color: '#f8fafc' }
};

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
            zIndex: (theme) => theme.zIndex.snackbar + index
          }}
        >
          <Alert
            severity="info"
            variant="filled"
            onClose={() => onClose(notification.id)}
            icon={<Assignment fontSize="small" />}
            sx={alertDarkSx}
          >
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5, color: '#f8fafc' }}>
              {notification.title}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: '#e2e8f0' }}>
              <AccessTime sx={{ fontSize: 14, color: '#94a3b8' }} />
              <Typography variant="caption" sx={{ color: '#e2e8f0' }}>
                Дедлайн: {notification.deadline}
              </Typography>
            </Box>
          </Alert>
        </Snackbar>
      ))}
    </>
  );
}
