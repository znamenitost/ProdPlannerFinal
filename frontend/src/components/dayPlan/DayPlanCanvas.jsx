import { Box, Typography } from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { tokens } from '../../theme/paletteTokens';
import {
  cardsForWave,
  findDropTarget,
  maxWaveRank,
  parseDropPayload,
  pointerMovedEnough,
  resolveDayPlanDrop
} from '../../utils/dayPlanBoard';
import { buildWaveRopes } from '../../utils/dayPlanRopes';
import { isTwinGroupHighlighted } from '../../utils/dayPlanTwinLinks';
import DayPlanCard from './DayPlanCard';

const BOARD_BG = tokens.track;
const ROPE_COLOR = tokens.secondary.main;
const MUTED = tokens.neutral[600];

function isGroupHighlighted(card, highlightedGroupId, twinGroupIds, showAllTwins) {
  return isTwinGroupHighlighted(card?.task, {
    activeGroupId: highlightedGroupId,
    twinGroupIds,
    showAll: showAllTwins
  });
}

function RopeLayer({ ropes, color }) {
  if (!ropes) return null;
  return (
    <Box
      component="svg"
      aria-hidden
      sx={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        overflow: 'visible',
        pointerEvents: 'none',
        zIndex: 1
      }}
    >
      {(ropes?.horizontals || []).map((d, idx) => (
        <path key={`h-${idx}`} d={d} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
      ))}
      {(ropes?.verticals || []).map((d, idx) => (
        <path key={`v-${idx}`} d={d} fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
      ))}
    </Box>
  );
}

function DropStrip({ payload, label, active, minHeight = 36, showLabel = false }) {
  return (
    <Box
      data-day-plan-drop={JSON.stringify(payload)}
      sx={{
        position: 'relative',
        zIndex: 2,
        minHeight,
        mx: 6,
        my: 0.5,
        borderRadius: 3,
        border: active || showLabel ? `1.5px dashed ${ROPE_COLOR}` : '1.5px solid transparent',
        bgcolor: active ? alpha(ROPE_COLOR, 0.18) : 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'auto'
      }}
    >
      {(active || showLabel) && label ? (
        <Typography variant="caption" sx={{ color: alpha(MUTED, 0.85), fontWeight: 600 }}>
          {label}
        </Typography>
      ) : null}
    </Box>
  );
}

export default function DayPlanCanvas({
  plan,
  unplanned = [],
  selectedTaskId,
  onSelectBlock,
  canEdit = false,
  onAssign,
  onOpenFolder,
  onOpenFile,
  onHoverBlock,
  onAction,
  showActions = false,
  pendingTaskId = null,
  onShowCdrPreview,
  isCdrPreviewBuilding,
  highlightedGroupId = null,
  twinGroupIds = null,
  showAllTwins = false,
  boardId = 'main',
  pending = false
}) {
  const theme = useTheme();
  const containerRef = useRef(null);
  const cardRefs = useRef(new Map());
  const dragRef = useRef(null);
  const maxRankRef = useRef(0);
  const onAssignRef = useRef(onAssign);
  const onSelectRef = useRef(onSelectBlock);
  const [ropes, setRopes] = useState(null);
  const [drag, setDrag] = useState(null);

  const waves = useMemo(
    () => (plan?.waves || [])
      .map((wave) => ({
        rank: wave.rank,
        cards: cardsForWave(wave)
      }))
      .filter((wave) => wave.cards.length > 0),
    [plan]
  );
  const maxRank = useMemo(() => maxWaveRank(waves), [waves]);
  const interactive = canEdit && !pending;
  maxRankRef.current = maxRank;
  onAssignRef.current = onAssign;
  onSelectRef.current = onSelectBlock;

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const measure = () => {
      const box = container.getBoundingClientRect();
      const layouts = waves.map((wave) => ({
        cards: wave.cards
          .map((card) => {
            const node = cardRefs.current.get(`${wave.rank}-${card.taskId}`);
            if (!node) return null;
            const rect = node.getBoundingClientRect();
            return {
              x: rect.left - box.left,
              y: rect.top - box.top,
              w: rect.width,
              h: rect.height
            };
          })
          .filter(Boolean)
      }));
      setRopes(buildWaveRopes(layouts));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, [waves, selectedTaskId, unplanned.length]);

  const setCardRef = (key) => (node) => {
    if (node) cardRefs.current.set(key, node);
    else cardRefs.current.delete(key);
  };

  const onPointerMove = useCallback((event) => {
    const current = dragRef.current;
    if (!current) return;
    const point = { x: event.clientX, y: event.clientY };
    if (!current.active && current.kind === 'task' && !pointerMovedEnough(current.start, point)) {
      return;
    }
    current.active = true;
    current.x = point.x;
    current.y = point.y;
    current.target = findDropTarget(point.x, point.y);
    setDrag({ ...current });
  }, []);

  const onPointerUp = useCallback((event) => {
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    const current = dragRef.current;
    dragRef.current = null;
    setDrag(null);
    if (!current) return;

    if (!current.active) {
      if (current.card) onSelectRef.current?.(current.card);
      return;
    }

    const target = findDropTarget(event.clientX, event.clientY);
    const change = resolveDayPlanDrop(current, target, maxRankRef.current);
    if (change) onAssignRef.current?.(change);
  }, [onPointerMove]);

  useEffect(() => () => {
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
  }, [onPointerMove, onPointerUp]);

  useLayoutEffect(() => {
    const node = containerRef.current;
    if (!node) return undefined;
    const over = (event) => {
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
      const target = findDropTarget(event.clientX, event.clientY);
      setDrag((prev) => (prev ? { ...prev, x: event.clientX, y: event.clientY, target, active: true } : prev));
    };
    const drop = (event) => {
      event.preventDefault();
      const payload = parseDropPayload(event.dataTransfer?.getData('text/plain'));
      const target = findDropTarget(event.clientX, event.clientY);
      setDrag(null);
      const change = resolveDayPlanDrop(payload, target, maxRankRef.current);
      if (change) onAssignRef.current?.(change);
    };
    node.addEventListener('dragover', over, true);
    node.addEventListener('drop', drop, true);
    return () => {
      node.removeEventListener('dragover', over, true);
      node.removeEventListener('drop', drop, true);
    };
  }, []);

  const startTaskDrag = (event, card, fromRank) => {
    if (!interactive) return;
    if (event.button != null && event.button !== 0) return;
    event.preventDefault();
    dragRef.current = {
      kind: 'task',
      taskId: card.taskId,
      fromRank: fromRank ?? null,
      start: { x: event.clientX, y: event.clientY },
      active: false,
      card
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  };

  const onHtmlDragStart = (event, card) => {
    if (!interactive) {
      event.preventDefault();
      return;
    }
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    dragRef.current = null;
    const payload = {
      kind: 'task',
      taskId: card.taskId,
      fromRank: card.rank ?? null
    };
    event.dataTransfer.setData('text/plain', JSON.stringify(payload));
    event.dataTransfer.effectAllowed = 'move';
    setDrag({
      ...payload,
      card,
      active: true,
      x: event.clientX,
      y: event.clientY
    });
  };

  const dropTarget = drag?.target || null;

  return (
    <Box
      ref={containerRef}
      data-day-plan-board={boardId}
      onDragEnd={() => setDrag(null)}
      sx={{
        position: 'relative',
        px: { xs: 1.5, sm: 3 },
        py: 2,
        borderRadius: 3,
        bgcolor: BOARD_BG,
        minHeight: 280,
        userSelect: 'none',
        boxShadow: `inset 0 0 0 1px ${alpha(tokens.neutral[300], 0.95)}`,
        '--day-plan-gap': { xs: '40px', sm: '64px' }
      }}
    >
      <RopeLayer ropes={ropes} color={ROPE_COLOR} />

      <Box
        sx={{
          position: 'relative',
          zIndex: 2,
          minHeight: waves.length ? undefined : 160
        }}
      >
        {waves.length === 0 && (
          <Box
            data-day-plan-drop={JSON.stringify({ kind: 'append' })}
            sx={{
              py: 6,
              textAlign: 'center',
              minHeight: 160,
              borderRadius: 3,
              bgcolor: dropTarget?.kind === 'append' || dropTarget?.kind === 'board'
                ? alpha(ROPE_COLOR, 0.18)
                : 'transparent'
            }}
          >
            <Typography variant="body2" sx={{ color: alpha(MUTED, 0.85) }}>
              {interactive
                ? 'Перетащите задачу из «Не в плане» на доску'
                : 'Нет задач с номером очереди на этот день'}
            </Typography>
          </Box>
        )}

        {waves.length > 0 && (
          <DropStrip
            payload={{ kind: 'insert', rank: 1 }}
            label="В начало"
            active={dropTarget?.kind === 'insert' && dropTarget.rank === 1}
            minHeight={48}
          />
        )}

        {waves.map((wave, waveIndex) => (
          <Box key={`wave-${wave.rank}`}>
            <Box
              sx={{
                position: 'relative',
                zIndex: 2,
                display: 'flex',
                justifyContent: 'center',
                flexWrap: 'nowrap',
                gap: 'var(--day-plan-gap)',
                px: 1,
                py: 1.5,
                overflowX: 'auto'
              }}
            >
              {wave.cards.map((card) => (
                <DayPlanCard
                  key={`card-${wave.rank}-${card.taskId}`}
                  card={card}
                  selected={selectedTaskId === card.taskId}
                  canEdit={interactive}
                  dragging={drag?.kind === 'task' && drag.taskId === card.taskId && drag.active}
                  dropTarget={dropTarget}
                  onSelect={interactive ? undefined : onSelectBlock}
                  onPointerDown={(event, item) => startTaskDrag(event, item, item.rank)}
                  onHtmlDragStart={onHtmlDragStart}
                  onOpenFolder={onOpenFolder}
                  onOpenFile={onOpenFile}
                  onHover={onHoverBlock}
                  onAction={onAction}
                  showActions={showActions}
                  actionPending={pending || pendingTaskId === card.taskId}
                  onShowCdrPreview={onShowCdrPreview}
                  cdrPreviewBuilding={Boolean(isCdrPreviewBuilding?.(card.taskId))}
                  groupHighlighted={isGroupHighlighted(card, highlightedGroupId, twinGroupIds, showAllTwins)}
                  cardRef={setCardRef(`${wave.rank}-${card.taskId}`)}
                />
              ))}
            </Box>
            {waveIndex < waves.length - 1 && (
              <DropStrip
                payload={{ kind: 'insert', rank: waves[waveIndex + 1].rank }}
                label="Вставить волну"
                active={dropTarget?.kind === 'insert' && dropTarget.rank === waves[waveIndex + 1].rank}
                minHeight={56}
              />
            )}
          </Box>
        ))}

        {waves.length > 0 && (
          <DropStrip
            payload={{ kind: 'append' }}
            label={interactive ? 'Новая волна' : ''}
            active={interactive && (dropTarget?.kind === 'append' || dropTarget?.kind === 'board')}
            showLabel={interactive}
            minHeight={48}
          />
        )}
      </Box>

      <Box
        data-day-plan-drop={JSON.stringify({ kind: 'unplanned' })}
        sx={{
          position: 'relative',
          zIndex: 2,
          mt: 2.5,
          pt: 2,
          borderTop: `1px dashed ${alpha(ROPE_COLOR, 0.7)}`,
          ...(dropTarget?.kind === 'unplanned'
            ? { bgcolor: alpha(ROPE_COLOR, 0.18), borderRadius: 2 }
            : {})
        }}
      >
        <Typography variant="caption" sx={{ color: alpha(MUTED, 0.85), fontWeight: 700, letterSpacing: 0.3 }}>
          Не в плане
        </Typography>
        {unplanned.length === 0 ? (
          <Typography variant="body2" sx={{ color: alpha(MUTED, 0.7), mt: 1 }}>
            {waves.length ? 'Все задачи уже на доске' : 'Нет задач, которые можно перенести на доску'}
          </Typography>
        ) : (
          <Box
            sx={{
              display: 'flex',
              gap: 2,
              mt: 1.25,
              pb: 0.5,
              overflowX: 'auto'
            }}
          >
            {unplanned.map((task) => {
              const card = {
                taskId: task.id,
                rank: null,
                hours: Number(task.remainingHours) || 0,
                task
              };
              return (
                <DayPlanCard
                  key={`unplanned-${task.id}`}
                  compact
                  card={card}
                  selected={selectedTaskId === task.id}
                  canEdit={interactive}
                  dragging={drag?.kind === 'task' && drag.taskId === task.id && drag.active}
                  dropTarget={null}
                  onSelect={interactive ? undefined : onSelectBlock}
                  onPointerDown={(event, item) => startTaskDrag(event, item, null)}
                  onHtmlDragStart={onHtmlDragStart}
                  onOpenFolder={onOpenFolder}
                  onOpenFile={onOpenFile}
                  onHover={onHoverBlock}
                  onShowCdrPreview={onShowCdrPreview}
                  cdrPreviewBuilding={Boolean(isCdrPreviewBuilding?.(task.id))}
                  groupHighlighted={isGroupHighlighted(card, highlightedGroupId, twinGroupIds, showAllTwins)}
                />
              );
            })}
          </Box>
        )}
      </Box>

      {drag?.active && drag.kind === 'task' && (
        <Box
          data-day-plan-ghost=""
          sx={{
            position: 'fixed',
            left: drag.x + 12,
            top: drag.y + 12,
            pointerEvents: 'none',
            zIndex: theme.zIndex.tooltip,
            transform: 'rotate(-2deg)'
          }}
        >
          <DayPlanCard
            compact
            droppable={false}
            card={drag.card}
            selected={false}
            canEdit={false}
          />
        </Box>
      )}
    </Box>
  );
}
