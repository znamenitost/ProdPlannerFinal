import { Box, Button, Paper, Popper, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { CheckCircle, Comment as CommentIcon, FolderOpen, Groups, Pause, PlayArrow } from '@mui/icons-material';
import { useRef } from 'react';
import { getTaskHeading } from '../TaskTitleTwoLines';
import { getTaskBorderColor } from '../../utils/taskBorderColor';
import { TWIN_LINK_COLOR, splitGroupId } from '../../utils/dayPlanTwinLinks';
import { getDayPlanCardWorkflow } from '../../utils/dayPlanCardWorkflow';
import { getCdrPreviewRowHandlers } from '../../utils/cdrPreviewRowHandlers';
import { CdrPreviewFileMark } from '../taskTable/TaskFileNameCell';
import LazyTooltip from '../common/LazyTooltip';
import TaskTypeGlyph from './TaskTypeGlyph';
import DayPlanCardDetails from './DayPlanCardDetails';
import {
  formatDayPlanDeadlineLabel,
  getDayPlanDeadlineTone,
  getDayPlanFileLabel
} from '../../utils/dayPlanCardIdentity';

const DEADLINE_LABEL_H = 18;

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
  onOpenComment,
  onOpenAssignees,
  employee = '',
  isAdmin = false,
  onHover,
  onAction,
  showActions = false,
  actionPending = false,
  onShowCdrPreview,
  cdrPreviewBuilding = false,
  groupHighlighted = false,
  cardRef,
  droppable = true,
  compact = false,
  dimmed = false,
  detailsOpen = false
}) {
  const theme = useTheme();
  const rootRef = useRef(null);
  const task = card.task || {};
  const title = getTaskHeading({
    heading: task.title,
    folderPath: task.folderPath,
    fileName: task.fileName,
    isFuss: task.isFuss
  });
  const fileLabel = getDayPlanFileLabel(task);
  const deadline = formatDayPlanDeadlineLabel(task.deadline);
  const deadlineTone = getDayPlanDeadlineTone(task.deadline);
  const blocked = Boolean(card.blocked || task.blocked);
  const highlighted = dropTarget && dropTarget.kind === 'card' && dropTarget.taskId === card.taskId;
  const insertBefore = highlighted && dropTarget.edge === 'before';
  const insertAfter = highlighted && dropTarget.edge === 'after';
  const statusText = (task.statusText || '').trim();
  const fullFilePath = `${task.folderPath || ''}/${task.fileName || ''}`.replace(/\/\//g, '/');
  const hasFile = Boolean(String(task.fileName || '').trim());
  const canOpenFolder = Boolean(onOpenFolder && task.folderPath);
  const canOpenFile = Boolean(onOpenFile && (hasFile || task.folderPath));
  const commentBadgeCount = Math.max(0, Number(task.commentBadgeCount) || 0);
  const partners = Array.isArray(task.partnerNames) ? task.partnerNames : [];
  const groupId = splitGroupId(task);
  const workflow = getDayPlanCardWorkflow(task);
  const showActionBar = Boolean(showActions && !compact && workflow.visible && onAction);
  const previewHandlers = task.isFuss
    ? {}
    : getCdrPreviewRowHandlers({ task, onShowCdrPreview });
  const borderColor = getTaskBorderColor({ ...task, statusText }, theme);
  const PrimaryIcon = workflow.primaryAction === 'pause' ? Pause : PlayArrow;
  const setRootRef = (node) => {
    rootRef.current = node;
    if (typeof cardRef === 'function') cardRef(node);
  };

  return (
    <Box
      ref={setRootRef}
      data-day-plan-card={card.taskId}
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
        pt: `${DEADLINE_LABEL_H}px`,
        opacity: dragging ? 0.45 : dimmed ? 0.38 : blocked ? 0.78 : 1,
        zIndex: detailsOpen || selected ? 4 : 2,
        transition: 'opacity 160ms ease, transform 120ms ease',
        '&:hover': canEdit && !dimmed ? { transform: 'translateY(-1px)' } : undefined
      }}
    >
      {deadline ? (
        <Typography
          component="span"
          aria-label={`Дедлайн ${deadline}`}
          sx={{
            position: 'absolute',
            top: 0,
            left: 0,
            maxWidth: '100%',
            height: `${DEADLINE_LABEL_H}px`,
            lineHeight: `${DEADLINE_LABEL_H}px`,
            px: 0.25,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontSize: compact ? '0.68rem' : '0.72rem',
            fontWeight: 600,
            letterSpacing: 0.1,
            pointerEvents: 'none',
            userSelect: 'none',
            color: deadlineTone === 'overdue'
              ? 'error.dark'
              : deadlineTone === 'today'
                ? 'warning.dark'
                : 'text.secondary'
          }}
        >
          {deadline}
        </Typography>
      ) : null}
      <Box
        sx={{
          minHeight: compact ? 80 : showActionBar ? 120 : 88,
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          borderRadius: CARD_RADIUS,
          overflow: 'hidden',
          bgcolor: 'background.paper',
          borderLeft: '4px solid',
          borderLeftColor: borderColor,
          outline: groupHighlighted
            ? `2px solid ${TWIN_LINK_COLOR}`
            : detailsOpen
              ? `2px solid ${alpha(theme.palette.primary.dark, 0.45)}`
              : '2px solid transparent',
          outlineOffset: 2,
          boxShadow: highlighted
            ? `0 0 0 2px ${theme.palette.primary.main}, 0 8px 18px ${alpha(theme.palette.grey[600], 0.12)}`
            : groupHighlighted
              ? `0 0 0 2px ${TWIN_LINK_COLOR}, 0 8px 18px ${alpha(TWIN_LINK_COLOR, 0.3)}`
              : `0 6px 16px ${alpha(theme.palette.grey[600], 0.08)}`,
          '&::before': insertBefore
            ? {
                content: '""',
                position: 'absolute',
                top: 6,
                bottom: 6,
                left: 2,
                width: 4,
                borderRadius: 2,
                bgcolor: 'primary.main',
                zIndex: 2
              }
            : undefined,
          '&::after': insertAfter
            ? {
                content: '""',
                position: 'absolute',
                top: 6,
                bottom: 6,
                right: 2,
                width: 4,
                borderRadius: 2,
                bgcolor: 'primary.main',
                zIndex: 2
              }
            : undefined
        }}
      >
        <Box sx={{ flex: 1, minHeight: 0, display: 'flex', alignItems: 'stretch' }}>
          <LazyTooltip
            title={canOpenFile
              ? `Открыть файл: ${fullFilePath}. ПКМ — открыть папку в проводнике`
              : canOpenFolder
                ? `Открыть папку: ${task.folderPath}`
                : ''}
            arrow
          >
            <Box
              component="button"
              type="button"
              disabled={!canOpenFile && !canOpenFolder}
              aria-label={canOpenFile
                ? `Открыть файл: ${fullFilePath}. Правая кнопка — открыть папку`
                : canOpenFolder
                  ? `Открыть папку: ${task.folderPath}`
                  : 'Файл не указан'}
              onPointerDown={stopCardEvent}
              onClick={(event) => {
                event.stopPropagation();
                if (hasFile && onOpenFile) onOpenFile(task);
                else if (canOpenFolder) onOpenFolder(task);
              }}
              onContextMenu={(event) => {
                event.preventDefault();
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
                color: canOpenFile || canOpenFolder ? 'text.secondary' : alpha(theme.palette.text.secondary, 0.4),
                cursor: canOpenFile || canOpenFolder ? 'pointer' : 'default',
                appearance: 'none',
                p: 0,
                '&:hover': canOpenFile || canOpenFolder
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
            aria-pressed={selected || detailsOpen}
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
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0, minHeight: compact ? 18 : 22 }}>
                <Box sx={{ flex: 1, minWidth: 0, height: compact ? 18 : 22, overflow: 'hidden' }}>
                  <TaskTypeGlyph type={task.type} compact />
                </Box>
                {commentBadgeCount > 0 && (
                  <LazyTooltip title={`Непрочитанных комментариев: ${commentBadgeCount}`} arrow>
                    <Box
                      component="button"
                      type="button"
                      aria-label={`Непрочитанных комментариев: ${commentBadgeCount}`}
                      onPointerDown={stopCardEvent}
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpenComment?.(task);
                      }}
                      sx={{
                        flexShrink: 0,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.25,
                        border: 0,
                        p: 0,
                        bgcolor: 'transparent',
                        color: 'text.primary',
                        cursor: onOpenComment ? 'pointer' : 'default',
                        appearance: 'none'
                      }}
                    >
                      <CommentIcon sx={{ fontSize: compact ? 14 : 16 }} />
                      <Typography
                        component="span"
                        sx={{
                          color: 'common.black',
                          fontWeight: 800,
                          fontSize: '0.75rem',
                          lineHeight: 1,
                          userSelect: 'none'
                        }}
                      >
                        {`+${commentBadgeCount}`}
                      </Typography>
                    </Box>
                  </LazyTooltip>
                )}
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
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 0.75, minWidth: 0 }}>
                {!task.isFuss && (
                  <Box sx={{ mt: '0.35em' }}>
                    <CdrPreviewFileMark task={task} previewBuilding={cdrPreviewBuilding} />
                  </Box>
                )}
                {partners.length > 0 && (
                  <LazyTooltip title={`Общая задача с: ${partners.join(', ')}`} arrow>
                    <Box
                      component="span"
                      aria-label={`Общая задача с: ${partners.join(', ')}`}
                      sx={{
                        display: 'inline-flex',
                        mt: '0.2em',
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
                    lineHeight: 1.35,
                    height: compact ? '2.268em' : '2.43em',
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
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  minHeight: '1.2em'
                }}
              >
                {fileLabel || '\u00a0'}
              </Typography>
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

      <Popper
        open={detailsOpen && !dragging}
        anchorEl={rootRef.current}
        placement="right-start"
        modifiers={[
          { name: 'offset', options: { offset: [0, 10] } },
          { name: 'flip', options: { fallbackPlacements: ['left-start', 'bottom'] } },
          { name: 'preventOverflow', options: { padding: 8 } }
        ]}
        sx={{ zIndex: (zTheme) => zTheme.zIndex.tooltip }}
      >
        <Paper
          elevation={8}
          data-day-plan-card-details=""
          sx={{ p: 1.5, width: 320, maxWidth: 'calc(100vw - 24px)' }}
        >
          <DayPlanCardDetails
            task={task}
            employee={employee}
            isAdmin={isAdmin}
            onOpenComment={onOpenComment}
            onOpenAssignees={onOpenAssignees}
          />
        </Paper>
      </Popper>
    </Box>
  );
}
