import { forwardRef } from 'react';
import { Typography } from '@mui/material';
import { ConversationSubtitle } from '@mui/x-chat-headless';
import { formatChatPresenceLabel } from './chatPresenceLabel';

const PresenceSubtitleText = forwardRef(function PresenceSubtitleText(props, ref) {
  const { ownerState, className, sx, ...rest } = props;
  const conversation = ownerState?.conversation;
  const label = formatChatPresenceLabel(conversation);
  const peer = conversation?.participants?.find((p) => p.role !== 'user')
    ?? conversation?.participants?.[0];
  const isOnline = Boolean(peer?.isOnline);

  if (!label) return null;

  return (
    <Typography
      ref={ref}
      component="p"
      variant="caption"
      className={className}
      sx={[
        {
          m: 0,
          lineHeight: 1.3,
          color: isOnline ? 'success.main' : 'text.secondary'
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : [])
      ]}
      {...rest}
    >
      {label}
    </Typography>
  );
});

export default forwardRef(function ChatConversationHeaderSubtitle(props, ref) {
  return (
    <ConversationSubtitle
      ref={ref}
      {...props}
      slots={{
        ...props.slots,
        subtitle: PresenceSubtitleText
      }}
    />
  );
});
