import { Badge, Box } from '@mui/material';
import { ConversationListItemAvatar } from '@mui/x-chat-headless';
import { TEAM_CHAT_AVATAR_URL } from './createProductionChatAdapter';

/**
 * Conversation list avatar with Telegram-style online/offline dot for direct chats.
 */
export default function ChatConversationOnlineAvatar(props) {
  const { conversation } = props;
  const isTeam = conversation?.metadata?.type === 'Team';
  const peer = conversation?.participants?.find((p) => p.role !== 'user')
    ?? conversation?.participants?.[0];
  const isDirect = !isTeam && (
    conversation?.metadata?.type === 'Direct'
    || Boolean(conversation?.metadata?.peerUserId)
    || Boolean(peer)
  );
  const isOnline = Boolean(peer?.isOnline);

  return (
    <Badge
      overlap="circular"
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      variant="dot"
      invisible={!isDirect}
      sx={{
        '& .MuiBadge-badge': {
          width: 11,
          height: 11,
          borderRadius: '50%',
          bgcolor: isOnline ? 'success.main' : 'grey.400',
          boxShadow: (t) => `0 0 0 2px ${t.palette.background.paper}`,
          // Keep the dot outside the clipped avatar circle.
          bottom: 2,
          right: 2
        }
      }}
    >
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          overflow: 'hidden',
          flexShrink: 0,
          bgcolor: (t) => (isTeam ? t.palette.background.paper : t.palette.grey[300]),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <ConversationListItemAvatar
          {...props}
          conversation={isTeam
            ? { ...conversation, avatarUrl: TEAM_CHAT_AVATAR_URL }
            : conversation}
          slots={{
            ...props.slots,
            root: 'div'
          }}
          slotProps={{
            ...props.slotProps,
            root: {
              ...props.slotProps?.root,
              style: {
                width: '100%',
                height: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                borderRadius: '50%',
                ...props.slotProps?.root?.style
              }
            },
            image: {
              ...props.slotProps?.image,
              style: {
                width: '100%',
                height: '100%',
                objectFit: isTeam ? 'contain' : 'cover',
                padding: isTeam ? '7px' : 0,
                boxSizing: 'border-box',
                ...props.slotProps?.image?.style
              }
            }
          }}
        />
      </Box>
    </Badge>
  );
}
