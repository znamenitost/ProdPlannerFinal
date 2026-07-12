const BUBBLE_RADIUS = 12;
const BUBBLE_TAIL_RADIUS = 4;

/**
 * Telegram-style asymmetric bubble corners.
 * Order: top-left, top-right, bottom-right, bottom-left.
 */
export function getTelegramBubbleBorderRadius({ isOwn, isFirst, isLast }) {
  const R = BUBBLE_RADIUS;
  const r = BUBBLE_TAIL_RADIUS;

  if (isOwn) {
    if (isFirst && isLast) return `${R}px ${R}px ${r}px ${R}px`;
    if (isFirst) return `${R}px ${r}px ${r}px ${R}px`;
    if (isLast) return `${r}px ${r}px ${r}px ${R}px`;
    return `${r}px ${r}px ${r}px ${R}px`;
  }

  if (isFirst && isLast) return `${R}px ${R}px ${R}px ${r}px`;
  if (isFirst) return `${R}px ${R}px ${r}px ${r}px`;
  if (isLast) return `${r}px ${R}px ${R}px ${r}px`;
  return `${r}px ${R}px ${r}px ${r}px`;
}
