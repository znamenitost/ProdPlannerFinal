import { Box, Button, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { CheckCircle, FolderOpen, Groups, Pause, PlayArrow } from '@mui/icons-material';
import { getTaskHeading } from '../TaskTitleTwoLines';
import { getTaskBorderColor } from '../../utils/taskBorderColor';
import { TWIN_LINK_COLOR, splitGroupId } from '../../utils/dayPlanTwinLinks';
import { getDayPlanCardWorkflow } from '../../utils/dayPlanCardWorkflow';
import { getCdrPreviewRowHandlers } from '../../utils/cdrPreviewRowHandlers';
import { CdrPreviewFileMark } from '../taskTable/TaskFileNameCell';
import LazyTooltip from '../common/LazyTooltip';
import TaskTypeGlyph from './TaskTypeGlyph';

const CARD_RADIUS = '8px';

function hoursLabel(card) {
  const hours = Number(card?.task?.remainingHours ?? card?.hours) || 0;
  return `${hours.toFixed(1)} ч`;
}

function stopCardEvent(event) {
  event.stopPropagation();
}

export default function DayPlanCard({
  card,
  selected,
  canEdit,
  dragging,
  dropTarget,
  onSelect,
  onPointerDown,
  onHtmlDragStart,
  onOpenFolder,
  onOpenFile,
  onHover,
  onAction,
  showActions = false,
  actionPending = false,
  onShowCdrPreview,
  cdrPreviewBuilding = false,
  groupHighlighted = false,
  cardRef,
  droppable = true,
  compact = false
}) {
  const theme = useTheme();
  const task = card.task || {};
  const title = getTaskHeading({
    heading: task.title,
    folderPath: task.folderPath,
    fileName: task.fileName,
    isFuss: task.isFuss
  });
  const blocked = Boolean(card.blocked || task.blocked);
  const highlighted = dropTarget && dropTarget.kind === 'card' && dropTarget.taskId === card.taskId;
  const statusText = (task.statusText || '').trim();
  const canOpenFolder = Boolean(onOpenFolder && task.folderPath);
  const canOpenFile = Boolean(onOpenFile && (task.fileName || task.folderPath));
  const partners = Array.isArray(task.partnerNames) ? task.partnerNames : [];
  const groupId = splitGroupId(task);
  const workflow = getDayPlanCardWorkflow(task);
  const showActionBar = Boolean(showActions && !compact && workflow.visible && onAction);
  const previewHandlers = task.isFuss
    ? {}
    : getCdrPreviewRowHandlers({ task, onShowCdrPreview });
  const borderColor = getTaskBorderColor({ ...task, statusText }, theme);
  const PrimaryIcon = workflow.primaryAction === 'pause' ? Pause : PlayArrow;

  return (
    <Box
      ref={cardRef}
      data-day-plan-drop={droppable
        ? JSON.stringify({ kind: 'card', taskId: card.taskId, rank: card.rank })
        : undefined}
      data-day-plan-group={groupId ?? undefined}
      {...previewHandlers}
      onPointerEnter={onHover ? () => onHover(card) : undefined}
      onPointerLeave={onHover ? () => onHover(null) : undefined}
      sx={{
        position: 'relative',
        flex: '0 0 auto',
        width: compact
          ? 252
          : 'min(300px, calc((100% - 2 * var(--day-plan-gap, 64px)) / 3))',
        maxWidth: '100%',
        opacity: dragging ? 0.45 : blocked ? 0.72 : 1,
        zIndex: 2,
        transition: 'transform 120ms ease',
        '&:hover': canEdit ? { transform: 'translateY(-1px)' } : undefined
      }}
    >
      <Box
        sx={{
          minHeight: compact ? 80 : showActionBar ? 120 : 88,
          display: 'flex',
          flexDirection: 'column',
          borderRadius: CARD_RADIUS,
          overflow: 'hidden',
          bgcolor: 'background.paper',
          borderLeft: '4px solid',
          borderLeftColor: borderColor,
          outline: groupHighlighted ? `2px solid ${TWIN_LINK_COLOR}` : '2px solid transparent',
          outlineOffset: 2,
          boxShadow: highlighted
            ? `0 0 0 2px ${theme.palette.primary.main}, 0 8px 18px ${alpha(theme.palette.grey[600], 0.12)}`
            : groupHighlighted
              ? `0 0 0 2px ${TWIN_LINK_COLOR}, 0 8px 18px ${alpha(TWIN_LINK_COLOR, 0.3)}`
              : selected
                ? `0 0 0 2px ${alpha(theme.palette.text.primary, 0.45)}, 0 8px 18px ${alpha(theme.palette.grey[600], 0.1)}`
                : `0 6px 16px ${alpha(theme.palette.grey[600], 0.08)}`
        }}
      >
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'stretch' }}>
          <LazyTooltip title={canOpenFolder ? `Открыть папку: ${task.folderPath}` : ''} arrow>
            <Box
              component="button"
              type="button"
              disabled={!canOpenFolder}
              aria-label={canOpenFolder ? `Открыть папку: ${task.folderPath}` : 'Папка не указана'}
              onPointerDown={stopCardEvent}
              onClick={(event) => {
                event.stopPropagation();
                if (canOpenFolder) onOpenFolder(task);
              }}
              sx={{
                width: compact ? 38 : 44,
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                alignSelf: 'stretch',
                border: 0,
                borderRight: '1px solid',
                borderRightColor: 'divider',
                bgcolor: alpha(theme.palette.grey[500], 0.06),
                color: canOpenFolder ? 'text.secondary' : alpha(theme.palette.text.secondary, 0.4),
                cursor: canOpenFolder ? 'pointer' : 'default',
                appearance: 'none',
                p: 0,
                '&:hover': canOpenFolder
                  ? { color: 'text.primary', bgcolor: alpha(theme.palette.grey[500], 0.12) }
                  : undefined
              }}
            >
              <FolderOpen sx={{ fontSize: compact ? 20 : 22 }} />
            </Box>
          </LazyTooltip>

          <Box
            role="button"
            tabIndex={0}
            draggable={false}
            aria-pressed={selected}
            aria-label={title}
            onClick={() => onSelect?.(card)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                onSelect?.(card);
              }
            }}
            onPointerDown={(event) => onPointerDown?.(event, card)}
            onDragStart={(event) => onHtmlDragStart?.(event, card)}
            onDoubleClick={(event) => {
              if (!canOpenFile) return;
              event.preventDefault();
              event.stopPropagation();
              onOpenFile(task);
            }}
            sx={{
              flex: 1,
              minWidth: 0,
              minHeight: 0,
              display: 'flex',
              alignItems: 'stretch',
              border: 0,
              p: 0,
              color: 'text.primary',
              cursor: canEdit ? 'grab' : 'pointer',
              touchAction: canEdit ? 'none' : 'auto',
              userSelect: 'none'
            }}
          >
            <Box
              sx={{
                minWidth: 0,
                flex: 1,
                px: 1.75,
                py: compact ? 1.25 : 1.5,
                display: 'flex',
                flexDirection: 'column',
                gap: 1.25,
                justifyContent: 'flex-start'
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <TaskTypeGlyph type={task.type} compact={compact} />
                </Box>
                <Typography
                  variant="caption"
                  sx={{
                    flexShrink: 0,
                    color: 'text.secondary',
                    fontWeight: 600,
                    fontSize: '0.75rem',
                    lineHeight: compact ? '18px' : '22px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {hoursLabel(card)}
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0 }}>
                {!task.isFuss && (
                  <CdrPreviewFileMark task={task} previewBuilding={cdrPreviewBuilding} />
                )}
                {partners.length > 0 && (
                  <LazyTooltip title={`Общая задача с: ${partners.join(', ')}`} arrow>
                    <Box
                      component="span"
                      aria-label={`Общая задача с: ${partners.join(', ')}`}
                      sx={{
                        display: 'inline-flex',
                        lineHeight: 0,
                        color: groupHighlighted ? TWIN_LINK_COLOR : 'text.secondary'
                      }}
                    >
                      <Groups sx={{ fontSize: 16 }} />
                    </Box>
                  </LazyTooltip>
                )}
                <Typography
                  variant="subtitle1"
                  sx={{
                    fontWeight: 600,
                    fontSize: compact ? '0.84rem' : '0.9rem',
                    lineHeight: 1.45,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    minWidth: 0,
                    flex: '1 1 auto'
                  }}
                >
                  {title}
                </Typography>
              </Box>
            </Box>
          </Box>
        </Box>

        {showActionBar && (
          <Box
            onPointerDown={stopCardEvent}
            onClick={stopCardEvent}
            sx={{
              display: 'flex',
              borderTop: '1px solid',
              borderTopColor: 'divider',
              bgcolor: alpha(theme.palette.grey[500], 0.06)
            }}
          >
            <Button
              size="small"
              color={workflow.primaryAction === 'pause' ? 'warning' : 'success'}
              disabled={actionPending || !workflow.primaryEnabled}
              onClick={() => onAction(task, workflow.primaryAction)}
              startIcon={<PrimaryIcon sx={{ fontSize: 18 }} />}
              sx={{
                flex: 1,
                minWidth: 0,
                width: '100%',
                borderRadius: 0,
                py: 1,
                px: 1,
                fontSize: '0.75rem',
                fontWeight: 600,
                lineHeight: 1.4,
                color: workflow.primaryAction === 'pause' ? 'warning.dark' : 'success.dark',
                '& .MuiButton-startIcon': { mr: 0.6 }
              }}
            >
              {workflow.primaryLabel}
            </Button>
            <Button
              size="small"
              color="primary"
              disabled={actionPending || !workflow.canComplete}
              onClick={() => onAction(task, 'complete')}
              startIcon={<CheckCircle sx={{ fontSize: 18 }} />}
              sx={{
                flex: 1,
                minWidth: 0,
                width: '100%',
                borderRadius: 0,
                py: 1,
                px: 1,
                fontSize: '0.75rem',
                fontWeight: 600,
                lineHeight: 1.4,
                borderLeft: '1px solid',
                borderLeftColor: 'divider',
                '& .MuiButton-startIcon': { mr: 0.6 }
              }}
            >
              Готово
            </Button>
          </Box>
        )}
      </Box>
    </Box>
  );
}
