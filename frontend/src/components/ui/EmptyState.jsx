import { Box, Typography } from '@mui/material';
import { InboxOutlined } from '@mui/icons-material';

export default function EmptyState({ message = 'Нет данных', icon: Icon = InboxOutlined }) {
  return (
    <Box sx={{ textAlign: 'center', py: 5, px: 2 }}>
      <Icon sx={{ fontSize: 48, opacity: 0.35, mb: 1, color: 'text.secondary' }} />
      <Typography variant="body1" color="text.secondary">{message}</Typography>
    </Box>
  );
}
