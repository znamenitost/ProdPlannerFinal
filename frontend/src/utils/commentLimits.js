import { CELL_TEXT_MAX_LENGTH } from './taskTableStyles';

/** Preview in table only; full text in tooltips and when editing. */
export const COMMENT_DISPLAY_MAX_LENGTH = CELL_TEXT_MAX_LENGTH;
export const COMMENT_DISPLAY_MAX_LINES = 2;

export function formatCommentForDisplay(value, max = COMMENT_DISPLAY_MAX_LENGTH) {
  if (value == null || String(value).trim() === '') return '—';
  const text = String(value).trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

/** Tooltip only when the table text-limit setting truncates the comment preview. */
export function commentNeedsTooltip(value, max = COMMENT_DISPLAY_MAX_LENGTH) {
  const text = String(value ?? '').trim();
  if (!text) return false;
  return text.length > max;
}

export function getCommentDisplaySx(max = COMMENT_DISPLAY_MAX_LENGTH) {
  return {
    fontSize: '0.875rem',
    display: '-webkit-box',
    WebkitLineClamp: COMMENT_DISPLAY_MAX_LINES,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    wordBreak: 'break-word',
    whiteSpace: 'normal',
    lineHeight: 1.35,
    maxWidth: `${max}ch`
  };
}

export const commentDisplaySx = getCommentDisplaySx();

export const commentInputFieldProps = {
  multiline: true,
  minRows: 3,
  maxRows: 8
};
