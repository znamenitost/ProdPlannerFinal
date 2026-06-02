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
  bgcolor: (theme) => theme.palette.grey[700],
  color: (theme) => theme.palette.common.white,
  border: (theme) => `1px solid ${alpha(theme.palette[color]?.main || theme.palette.primary.main, 0.7)}`,
  borderLeft: (theme) => `5px solid ${theme.palette[color]?.main || theme.palette.primary.main}`,
  boxShadow: (theme) => `0 14px 34px ${alpha(theme.palette.grey[700], 0.34)}`,
  '& .MuiAlert-icon': {
    color: (theme) => theme.palette[color]?.main || theme.palette.primary.main,
    mt: 0.25
  },
  '& .MuiAlert-message': { padding: 0 },
  '& .MuiAlert-action': { color: 'inherit' }
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
              variant="filled"
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
                  sx={(theme) => ({
                    height: 22,
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    color: theme.palette.common.white,
                    bgcolor: alpha(theme.palette[variant.color]?.main || theme.palette.primary.main, 0.18),
                    borderColor: alpha(theme.palette[variant.color]?.main || theme.palette.primary.main, 0.72)
                  })}
                />
              </Box>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                {notification.title}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'rgba(255, 255, 255, 0.78)' }}>
                <AccessTime sx={{ fontSize: 14, color: 'inherit' }} />
                <Typography variant="caption" sx={{ color: 'inherit' }}>
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
