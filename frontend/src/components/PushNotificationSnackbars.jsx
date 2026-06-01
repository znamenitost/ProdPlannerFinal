import { Snackbar, Alert, Box, Chip, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Assignment, AccessTime, CheckCircle, Inventory2, PlayArrow } from '@mui/icons-material';

const SNACKBAR_HEIGHT = 108;

const notificationVariants = {
  NewTask: {
    chip: 'Новая задача',
    severity: 'info',
    color: 'primary',
    icon: <Assignment fontSize="small" />
  },
  TaskApprovedReady: {
    chip: 'Согласовано',
    severity: 'success',
    color: 'success',
    icon: <CheckCircle fontSize="small" />
  },
  TaskInStockReady: {
    chip: 'В наличии',
    severity: 'success',
    color: 'success',
    icon: <Inventory2 fontSize="small" />
  },
  TaskReadyToStart: {
    chip: 'Можно начинать',
    severity: 'success',
    color: 'success',
    icon: <CheckCircle fontSize="small" />
  },
  SequentialStageReady: {
    chip: 'Этап доступен',
    severity: 'info',
    color: 'secondary',
    icon: <PlayArrow fontSize="small" />
  }
};

const getNotificationVariant = (type) => notificationVariants[type] || notificationVariants.NewTask;

const alertSx = (color) => ({
  width: '100%',
  minWidth: 280,
  maxWidth: 360,
  alignItems: 'flex-start',
  bgcolor: (theme) => alpha(theme.palette[color]?.main || theme.palette.primary.main, 0.08),
  color: 'text.primary',
  border: (theme) => `1px solid ${alpha(theme.palette[color]?.main || theme.palette.primary.main, 0.24)}`,
  boxShadow: (theme) => `0 4px 20px ${alpha(theme.palette.grey[600], 0.08)}`,
  '& .MuiAlert-icon': { color: `${color}.main`, mt: 0.25 },
  '& .MuiAlert-message': { padding: 0 }
});

export default function PushNotificationSnackbars({ notifications, onClose }) {
  return (
    <>
      {notifications.map((notification, index) => {
        const variant = getNotificationVariant(notification.type);
        return (
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
              severity={variant.severity}
              variant="outlined"
              onClose={() => onClose(notification.id)}
              icon={variant.icon}
              sx={alertSx(variant.color)}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                <Chip
                  size="small"
                  label={variant.chip}
                  color={variant.color}
                  variant="outlined"
                  sx={{ height: 22, fontSize: '0.68rem', fontWeight: 700 }}
                />
              </Box>
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
        );
      })}
    </>
  );
}
