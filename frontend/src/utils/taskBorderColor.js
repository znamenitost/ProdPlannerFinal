import { alpha } from '@mui/material/styles';
import {
  isPendingApprovalCalendar,
  STATUS_NO_ITEMS,
  STATUS_PENDING_APPROVAL
} from '../constants/taskStatuses';

export function getTaskBorderColor(task, theme) {
  const text = task.statusText ?? task.statusLabel ?? '';
  if (text === STATUS_PENDING_APPROVAL || isPendingApprovalCalendar(text)) {
    return theme.palette.warning.main;
  }
  if (text === STATUS_NO_ITEMS) return theme.palette.error.main;
  if (task.status === 1) return theme.palette.info.main;
  if (task.status === 2) return theme.palette.warning.main;
  return theme.palette.divider;
}

/** Fixed accent for expanded shared-task groups (not status-colored). */
export function getSharedGroupAccentColor(theme) {
  return theme.palette.info.main;
}

const SHARED_GROUP_STRIPE_WIDTH = '6px';
const SHARED_GROUP_STRIPE_RADIUS = 8;

/**
 * Visual block for a shared-task group (parent + expanded children):
 * continuous left stripe + soft band. Parent is slightly stronger than children.
 * Apply via TableRow sx; stripe colors the first TableCell.
 */
export function getSharedGroupStripeRowSx(theme, { isFirst, isLast, role = 'child' }) {
  const accent = getSharedGroupAccentColor(theme);
  const isParent = role === 'parent';
  const band = alpha(accent, isParent ? 0.12 : 0.06);
  const bandHover = alpha(accent, isParent ? 0.17 : 0.1);

  return {
    bgcolor: band,
    '&:hover': { bgcolor: bandHover },
    '& > td:first-of-type': {
      borderLeft: `${SHARED_GROUP_STRIPE_WIDTH} solid`,
      borderLeftColor: accent,
      ...(isFirst && { borderTopLeftRadius: SHARED_GROUP_STRIPE_RADIUS }),
      ...(isLast && { borderBottomLeftRadius: SHARED_GROUP_STRIPE_RADIUS })
    }
  };
}
