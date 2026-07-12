import dayjs from 'dayjs';
import 'dayjs/locale/ru';

dayjs.locale('ru');

export function formatChatPresenceLabel(conversation) {
  if (!conversation) return '';

  if (conversation.metadata?.type === 'Team') {
    return 'Вся команда';
  }

  const peer = conversation.participants?.find((p) => p.role !== 'user')
    ?? conversation.participants?.[0];
  const isOnline = Boolean(peer?.isOnline);

  if (isOnline) {
    return 'В сети';
  }

  const lastSeen = conversation.metadata?.peerLastSeenAt;
  if (!lastSeen) {
    return 'Не в сети';
  }

  const at = dayjs(lastSeen);
  if (!at.isValid()) {
    return 'Не в сети';
  }

  const now = dayjs();
  if (at.isSame(now, 'day')) {
    return `Был(а) в сети в ${at.format('HH:mm')}`;
  }
  if (at.isSame(now.subtract(1, 'day'), 'day')) {
    return `Был(а) в сети вчера в ${at.format('HH:mm')}`;
  }
  if (at.isAfter(now.subtract(7, 'day'))) {
    return `Был(а) в сети ${at.format('dddd')} в ${at.format('HH:mm')}`;
  }
  return `Был(а) в сети ${at.format('D MMMM YYYY')}`;
}
