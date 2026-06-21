import { IconButton, Tooltip } from '@mui/material';
import { Notifications, NotificationsActive } from '@mui/icons-material';

export default function TaskMaxSubscribeButton({
  taskId,
  subscribed = false,
  disabled = false,
  onToggle
}) {
  const label = subscribed
    ? 'Отписаться от уведомлений MAX'
    : 'Подписаться на статус задачи в MAX';

  return (
    <Tooltip title={disabled && !subscribed ? 'Сначала привяжите MAX в меню пользователя' : label} arrow>
      <span>
        <IconButton
          size="small"
          color={subscribed ? 'primary' : 'default'}
          disabled={disabled}
          aria-label={label}
          onClick={(event) => {
            event.stopPropagation();
            onToggle?.(taskId, !subscribed);
          }}
          sx={{ p: 0.5 }}
        >
          {subscribed ? (
            <NotificationsActive fontSize="small" />
          ) : (
            <Notifications fontSize="small" />
          )}
        </IconButton>
      </span>
    </Tooltip>
  );
}
