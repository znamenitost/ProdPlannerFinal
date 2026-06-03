import { useMemo } from 'react';
import { Box, IconButton, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { Comment as CommentIcon } from '@mui/icons-material';
import { formatCommentForDisplay, getCommentDisplaySx } from '../../utils/commentLimits';
import { useTextLimit } from '../../context/TextLimitContext';
import LazyTooltip from '../common/LazyTooltip';

const commentTooltipSx = {
  bgcolor: (theme) => alpha(theme.palette.grey[900], 0.92),
  fontSize: '12px',
  padding: '8px 15px',
  maxWidth: '400px',
  borderRadius: 2
};

export default function TaskCommentCell({ task, onOpenComment, iconButtonColor = 'primary' }) {
  const limit = useTextLimit();
  const sx = useMemo(() => ({ color: 'text.secondary', ...getCommentDisplaySx(limit), cursor: 'default' }), [limit]);
  const comment = String(task.comment || '').trim();
  const displayText = formatCommentForDisplay(comment, limit);
  const text = (
    <Typography variant="body2" sx={sx}>
      {displayText}
    </Typography>
  );

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'nowrap' }}>
      {comment.length > limit ? (
        <LazyTooltip
          title={comment}
          arrow
          placement="top"
          slotProps={{ tooltip: { sx: commentTooltipSx } }}
        >
          {text}
        </LazyTooltip>
      ) : text}
      <IconButton
        size="small"
        color={iconButtonColor}
        onClick={() => onOpenComment(task)}
        aria-label="Редактировать комментарий"
        sx={{ p: 0.5, flexShrink: 0 }}
      >
        <CommentIcon fontSize="small" sx={{ fontSize: 14 }} />
      </IconButton>
    </Box>
  );
}
