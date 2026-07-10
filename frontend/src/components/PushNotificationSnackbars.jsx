import { Snackbar, Alert, Box, Chip, Typography, Button } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { toastAlertThemeStyles } from '../theme/componentVariants';
import { Assignment, AccessTime, CheckCircle, Inventory2, PlayArrow, Chat } from '@mui/icons-material';

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
  },
  ChatMessage: {
    chip: 'Сообщение',
    severity: 'info',
    color: 'info',
    icon: <Chat fontSize="small" />
  }
};

const getNotificationVariant = (type) => notificationVariants[type] || notificationVariants.NewTask;

export default function PushNotificationSnackbars({ notifications, onClose, onOpen }) {
  let chatStackIndex = 0;
  let taskStackIndex = 0;

  return (
    <>
      {notifications.map((notification) => {
        const variant = getNotificationVariant(notification.type);
        const isChat = notification.type === 'ChatMessage';
        const stackIndex = isChat ? chatStackIndex++ : taskStackIndex++;

        return (
          <Snackbar
            key={notification.id}
            open
            autoHideDuration={isChat ? null : 8000}
            onClose={(_event, reason) => {
              if (reason === 'clickaway') return;
              // Chat toasts stay until explicit close / open — ignore timeout just in case.
              if (isChat && reason === 'timeout') return;
              onClose(notification.id);
            }}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: isChat ? 'left' : 'right'
            }}
            sx={{
              bottom: {
                xs: 16 + stackIndex * SNACKBAR_HEIGHT,
                sm: 24 + stackIndex * SNACKBAR_HEIGHT
              },
              ...(isChat
                ? { left: { xs: 16, sm: 24 }, right: 'auto' }
                : { right: { xs: 16, sm: 24 }, left: 'auto' }),
              zIndex: (theme) => theme.zIndex.snackbar + stackIndex
            }}
          >
            <Alert
              severity={variant.severity}
              variant="toast"
              onClose={() => onClose(notification.id)}
              icon={variant.icon}
              onClick={isChat && onOpen ? () => onOpen(notification) : undefined}
              sx={(theme) => ({
                ...toastAlertThemeStyles(theme, variant.color),
                minWidth: 280,
                maxWidth: 380,
                alignItems: 'flex-start',
                cursor: isChat && onOpen ? 'pointer' : 'default',
                '& .MuiAlert-message': { padding: 0, width: '100%' },
                '& .MuiAlert-icon': { mt: 0.25 }
              })}
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
              {isChat ? (
                <>
                  <Typography
                    variant="caption"
                    sx={{ color: 'rgba(255, 255, 255, 0.82)', display: 'block', mb: 1 }}
                  >
                    {notification.body}
                  </Typography>
                  {onOpen && (
                    <Button
                      size="small"
                      variant="outlined"
                      color="inherit"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpen(notification);
                      }}
                      sx={{
                        borderColor: 'rgba(255,255,255,0.35)',
                        color: 'common.white',
                        fontSize: '0.72rem',
                        py: 0.25,
                        '&:hover': {
                          borderColor: 'rgba(255,255,255,0.6)',
                          bgcolor: 'rgba(255,255,255,0.08)'
                        }
                      }}
                    >
                      Открыть чат
                    </Button>
                  )}
                </>
              ) : (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'rgba(255, 255, 255, 0.78)' }}>
                  <AccessTime sx={{ fontSize: 14, color: 'inherit' }} />
                  <Typography variant="caption" sx={{ color: 'inherit' }}>
                    Дедлайн: {notification.deadline}
                  </Typography>
                </Box>
              )}
            </Alert>
          </Snackbar>
        );
      })}
    </>
  );
}
