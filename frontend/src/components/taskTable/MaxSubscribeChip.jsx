import { Box } from '@mui/material';
import { Notifications } from '@mui/icons-material';
import LazyTooltip from '../common/LazyTooltip';

/** Круглый маркер подписки MAX — стиль как у «через согласование». */
export function MaxSubscribeMark({ size = 22, iconSize = 13 }) {
  return (
    <Box
      component="span"
      sx={(theme) => ({
        width: size,
        height: size,
        minWidth: size,
        flexShrink: 0,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: '50%',
        bgcolor: theme.palette.grey[700],
        color: theme.palette.grey[50],
        verticalAlign: 'middle',
        lineHeight: 0
      })}
    >
      <Notifications sx={{ fontSize: iconSize }} />
    </Box>
  );
}

export default function MaxSubscribeChip({ subscribed = false }) {
  if (!subscribed) return null;

  return (
    <LazyTooltip title="Подписка на уведомления MAX" arrow>
      <Box component="span" aria-label="Подписка MAX">
        <MaxSubscribeMark />
      </Box>
    </LazyTooltip>
  );
}
