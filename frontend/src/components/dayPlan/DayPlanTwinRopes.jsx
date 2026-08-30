import { useLayoutEffect, useState } from 'react';
import { Box } from '@mui/material';
import { collectTwinPairs, twinLinkPath, TWIN_LINK_COLOR, splitGroupId } from '../../utils/dayPlanTwinLinks';
import { parseDropPayload } from '../../utils/dayPlanBoard';
import { SUPPLY_MODE_INTERNAL } from '../../constants/taskStatuses';

const LINK_COLOR = TWIN_LINK_COLOR;

function isSequentialPair(aTask, bTask) {
  return aTask?.supplyMode === SUPPLY_MODE_INTERNAL
    && bTask?.supplyMode === SUPPLY_MODE_INTERNAL
    && ((aTask.sequenceOrder || 0) > 0 || (bTask.sequenceOrder || 0) > 0);
}

/**
 * Пунктирные верёвки между карточками-близнецами на двух досках.
 * По умолчанию рисуется только связь активной группы (hover/выбор),
 * showAll включает приглушённый показ всех связей.
 */
export default function DayPlanTwinRopes({
  containerRef,
  tasksById,
  activeGroupId,
  showAll,
  watch = []
}) {
  const [pairs, setPairs] = useState([]);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;

    const measure = () => {
      const box = container.getBoundingClientRect();
      const nodes = [...container.querySelectorAll('[data-day-plan-group]')].map((node) => {
        const rect = node.getBoundingClientRect();
        const drop = parseDropPayload(node.getAttribute('data-day-plan-drop'));
        return {
          group: splitGroupId({ parentRowNumber: node.getAttribute('data-day-plan-group') }),
          board: node.closest('[data-day-plan-board]')?.getAttribute('data-day-plan-board') || '',
          taskId: drop?.taskId ?? null,
          x: rect.left - box.left,
          y: rect.top - box.top,
          w: rect.width,
          h: rect.height
        };
      });
      setPairs(collectTwinPairs(nodes));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerRef, activeGroupId, showAll, ...watch]);

  const visible = pairs.filter((pair) => showAll || pair.group === splitGroupId({ parentRowNumber: activeGroupId }));
  if (visible.length === 0) return null;

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
        zIndex: 6
      }}
    >
      {visible.map((pair) => {
        const aTask = tasksById?.get(pair.a.taskId);
        const bTask = tasksById?.get(pair.b.taskId);
        const sequential = isSequentialPair(aTask, bTask);
        const ordered = sequential && (aTask.sequenceOrder || 0) > (bTask.sequenceOrder || 0)
          ? [pair.b, pair.a]
          : [pair.a, pair.b];
        const activeGroup = splitGroupId({ parentRowNumber: activeGroupId });
        const active = pair.group === activeGroup;
        return (
          <path
            key={`twin-${pair.group}`}
            d={twinLinkPath(ordered[0], ordered[1])}
            fill="none"
            stroke={LINK_COLOR}
            strokeWidth={active ? 2.6 : 1.6}
            strokeDasharray="7 5"
            strokeLinecap="round"
            opacity={active ? 0.95 : 0.62}
          />
        );
      })}
    </Box>
  );
}
