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

const SHARED_GROUP_STRIPE_WIDTH = '4px';
const SHARED_GROUP_STRIPE_RADIUS = 8;

/**
 * Continuous left stripe for a shared-task group (parent + expanded children).
 * Apply via TableRow sx; colors the first TableCell.
 */
export function getSharedGroupStripeRowSx(theme, task, { isFirst, isLast }) {
  const color = getTaskBorderColor(task, theme);
  return {
    '& > td:first-of-type': {
      borderLeft: `${SHARED_GROUP_STRIPE_WIDTH} solid`,
      borderLeftColor: color,
      ...(isFirst && { borderTopLeftRadius: SHARED_GROUP_STRIPE_RADIUS }),
      ...(isLast && { borderBottomLeftRadius: SHARED_GROUP_STRIPE_RADIUS })
    }
  };
}
