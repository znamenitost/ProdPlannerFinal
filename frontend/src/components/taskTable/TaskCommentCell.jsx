import { useEffect, useMemo, useRef, useState } from 'react';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import { Comment as CommentIcon } from '@mui/icons-material';
import { formatCommentForDisplay, getCommentDisplaySx } from '../../utils/commentLimits';
import { useTextLimit } from '../../context/TextLimitContext';
import { needsTooltip } from '../../utils/taskTableStyles';
import CommentTooltipTitle from './CommentTooltipTitle';

export default function TaskCommentCell({
  task,
  onOpenComment,
  iconButtonColor = 'primary',
  forceTooltipOpen = false,
  onForceTooltipClose
}) {
  const limit = useTextLimit();
  const rootRef = useRef(null);
  const [hoverOpen, setHoverOpen] = useState(false);
  const sx = useMemo(
    () => ({
      color: 'text.secondary',
      ...getCommentDisplaySx(limit),
      maxWidth: '100%',
      cursor: 'default',
      whiteSpace: 'pre-line'
    }),
    [limit]
  );
  const comment = String(task.comment || '').trim();
  const displayText = formatCommentForDisplay(comment, limit);
  const commentEditedViaDialog = Boolean(task.commentEditedViaDialog);
  const badgeCount = Math.max(0, Number(task.commentBadgeCount) || 0);
  const showTooltip = Boolean(comment) && (
    needsTooltip(comment, limit)
    || comment.includes('\n')
    || comment.includes('→')
    || forceTooltipOpen
  );
  const tooltipOpen = forceTooltipOpen || hoverOpen;

  useEffect(() => {
    if (!forceTooltipOpen || !rootRef.current) return undefined;
    rootRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return undefined;
  }, [forceTooltipOpen]);

  useEffect(() => {
    if (!forceTooltipOpen) return undefined;
    const timer = window.setTimeout(() => {
      onForceTooltipClose?.();
    }, 10000);
    return () => window.clearTimeout(timer);
  }, [forceTooltipOpen, onForceTooltipClose]);

  const text = (
    <Typography variant="body2" sx={sx}>
      {displayText || (forceTooltipOpen ? ' ' : '')}
    </Typography>
  );

  return (
    <Box
      ref={rootRef}
      data-task-comment-cell={task.id}
      sx={{ display: 'flex', alignItems: 'center', width: '100%', minWidth: 0, gap: 0.5 }}
    >
      <Box sx={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        {showTooltip ? (
          <Tooltip
            arrow
            placement="top"
            open={tooltipOpen}
            onOpen={() => setHoverOpen(true)}
            onClose={() => {
              setHoverOpen(false);
              if (forceTooltipOpen) onForceTooltipClose?.();
            }}
            title={<CommentTooltipTitle preview={comment} />}
          >
            {text}
          </Tooltip>
        ) : (
          text
        )}
      </Box>
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          flexShrink: 0,
          gap: 0.25,
          overflow: 'visible'
        }}
      >
        <IconButton
          size="small"
          color={commentEditedViaDialog ? 'inherit' : iconButtonColor}
          onClick={() => onOpenComment(task)}
          aria-label="Открыть комментарии"
          sx={{
            p: 0.5,
            ...(commentEditedViaDialog ? { color: 'grey.700' } : null)
          }}
        >
          <CommentIcon
            fontSize="small"
            sx={{
              fontSize: 14,
              color: commentEditedViaDialog ? 'grey.700' : 'inherit'
            }}
          />
        </IconButton>
        {badgeCount > 0 ? (
          <Typography
            component="span"
            aria-label={`Непрочитанных комментариев: ${badgeCount}`}
            sx={{
              color: 'warning.dark',
              fontWeight: 800,
              fontSize: '0.75rem',
              lineHeight: 1,
              userSelect: 'none'
            }}
          >
            {`+${badgeCount}`}
          </Typography>
        ) : null}
      </Box>
    </Box>
  );
}
