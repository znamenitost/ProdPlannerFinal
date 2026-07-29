import { alpha, Avatar, Badge, IconButton, Tooltip } from '@mui/material';
import { Chat as ChatIcon } from '@mui/icons-material';

export default function ChatHeaderButton({ unreadCount, onClick }) {
  return (
    <Tooltip title="Чаты">
      <IconButton onClick={onClick} aria-label="Открыть чаты" sx={{ p: 0.75 }}>
        <Badge badgeContent={unreadCount} color="primary" max={99} overlap="circular">
          <Avatar
            variant="rounded"
            sx={{
              width: 40,
              height: 40,
              bgcolor: (t) => alpha(t.palette.primary.main, 0.12),
              color: 'primary.dark',
              borderRadius: 2.5
            }}
          >
            <ChatIcon fontSize="small" />
          </Avatar>
        </Badge>
      </IconButton>
    </Tooltip>
  );
}
