import { useMemo } from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import { Comment as CommentIcon } from '@mui/icons-material';
import {
  commentNeedsTooltip,
  formatCommentForDisplay,
  getCommentDisplaySx
} from '../../utils/commentLimits';
import { useTextLimit } from '../../context/TextLimitContext';
import LazyTooltip from '../common/LazyTooltip';

export default function TaskCommentCell({ task, onOpenComment, iconButtonColor = 'primary' }) {
  const limit = useTextLimit();
  const sx = useMemo(
    () => ({
      color: 'text.secondary',
      ...getCommentDisplaySx(limit),
      maxWidth: '100%',
      cursor: 'default'
    }),
    [limit]
  );
  const comment = String(task.comment || '').trim();
  const displayText = formatCommentForDisplay(comment, limit);
  const showTooltip = commentNeedsTooltip(comment, limit);
  const commentEditedViaDialog = Boolean(task.commentEditedViaDialog);
  const text = (
    <Typography variant="body2" component="span" sx={{ ...sx, display: 'block' }}>
      {displayText}
    </Typography>
  );

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', width: '100%', minWidth: 0, gap: 0.5 }}>
      <Box sx={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        {showTooltip ? (
          <LazyTooltip title={comment} arrow placement="top">
            {text}
          </LazyTooltip>
        ) : text}
      </Box>
      <IconButton
        size="small"
        color={commentEditedViaDialog ? 'warning' : iconButtonColor}
        onClick={() => onOpenComment(task)}
        aria-label="Редактировать комментарий"
        sx={{ p: 0.5, flexShrink: 0 }}
      >
        <CommentIcon fontSize="small" sx={{ fontSize: 14 }} />
      </IconButton>
    </Box>
  );
}
