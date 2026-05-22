import { Snackbar, Alert, Box, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Assignment, AccessTime } from '@mui/icons-material';

const SNACKBAR_HEIGHT = 88;

const alertSx = {
  width: '100%',
  minWidth: 280,
  maxWidth: 360,
  alignItems: 'flex-start',
  bgcolor: 'background.paper',
  color: 'text.primary',
  border: (theme) => `1px solid ${alpha(theme.palette.primary.main, 0.2)}`,
  boxShadow: (theme) => `0 4px 20px ${alpha(theme.palette.grey[600], 0.08)}`,
  '& .MuiAlert-icon': { color: 'info.main', mt: 0.25 },
  '& .MuiAlert-message': { padding: 0 }
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
            variant="outlined"
            onClose={() => onClose(notification.id)}
            icon={<Assignment fontSize="small" />}
            sx={alertSx}
          >
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
              {notification.title}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.secondary' }}>
              <AccessTime sx={{ fontSize: 14 }} color="action" />
              <Typography variant="caption" color="text.secondary">
                Дедлайн: {notification.deadline}
              </Typography>
            </Box>
          </Alert>
        </Snackbar>
      ))}
    </>
  );
}
