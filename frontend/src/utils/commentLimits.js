/** Preview in table only; full text in tooltips and when editing. */
export const COMMENT_DISPLAY_MAX_LENGTH = 22;
export const COMMENT_DISPLAY_MAX_LINES = 2;

export function formatCommentForDisplay(value) {
  if (value == null || String(value).trim() === '') return '—';
  const text = String(value).trim();
  if (text.length <= COMMENT_DISPLAY_MAX_LENGTH) return text;
  return `${text.slice(0, COMMENT_DISPLAY_MAX_LENGTH)}…`;
}

export const commentDisplaySx = {
  fontSize: '0.875rem',
  display: '-webkit-box',
  WebkitLineClamp: COMMENT_DISPLAY_MAX_LINES,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
  wordBreak: 'break-word',
  whiteSpace: 'normal',
  lineHeight: 1.35,
  maxWidth: `${COMMENT_DISPLAY_MAX_LENGTH}ch`
};

export const commentInputFieldProps = {
  multiline: true,
  minRows: 3,
  maxRows: 8
};
