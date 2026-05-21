import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import { Comment as CommentIcon } from '@mui/icons-material';
import { formatCommentForDisplay, commentDisplaySx } from '../../utils/commentLimits';

const commentTooltipSx = {
  bgcolor: '#1e293b',
  fontSize: '12px',
  padding: '8px 15px',
  maxWidth: '400px',
  borderRadius: 2
};

export default function TaskCommentCell({ task, onOpenComment, iconColor = '#7c9ebf', iconButtonColor }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'nowrap' }}>
      <Tooltip
        title={task.comment || 'Нет комментария'}
        arrow
        placement="top"
        slotProps={{ tooltip: { sx: commentTooltipSx } }}
      >
        <Typography variant="body2" sx={{ color: 'text.secondary', ...commentDisplaySx, cursor: 'default' }}>
          {formatCommentForDisplay(task.comment)}
        </Typography>
      </Tooltip>
      <IconButton
        size="small"
        color={iconButtonColor}
        onClick={() => onOpenComment(task)}
        sx={{ p: 0.5, flexShrink: 0 }}
      >
        <CommentIcon fontSize="small" sx={{ fontSize: 14, color: iconColor }} />
      </IconButton>
    </Box>
  );
}
