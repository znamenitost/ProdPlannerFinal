import { uniqueCardsForWave } from './dayPlanRopes.js';

export const DAY_PLAN_DRAG_THRESHOLD = 6;

export function maxWaveRank(waves = []) {
  const ranks = (Array.isArray(waves) ? waves : [])
    .map((wave) => Number(wave?.rank))
    .filter((rank) => Number.isInteger(rank) && rank > 0);
  return ranks.length ? Math.max(...ranks) : 0;
}

export function planableUnplanned(tasks = []) {
  return (Array.isArray(tasks) ? tasks : []).filter((task) => task?.id && !task.isFuss);
}

/** Карточки волны: рабочие блоки + заблокированные с тем же номером. */
export function cardsForWave(wave) {
  const fromBlocks = uniqueCardsForWave(wave);
  const seen = new Set(fromBlocks.map((card) => card.taskId));
  const extras = (wave?.blocked || [])
    .filter((task) => task?.id && !seen.has(task.id))
    .map((task, index) => ({
      taskId: task.id,
      rank: wave.rank,
      hours: Number(task.remainingHours) || 0,
      lane: 1000 + index,
      start: null,
      task,
      blocked: true
    }));
  return [...fromBlocks, ...extras];
}

/**
 * Жест доски → смена PriorityRank.
 * Перенос на карточку — встать в её волну параллельно (joinWave).
 * Край карточки / слот слева-справа — позиция внутри волны (календарь сверху вниз).
 * «В начало» — insert rank 1: задача становится волной 1, остальные сдвигаются.
 * «Новая волна» — appendWave: сервер ставит max(все занятые)+1, затем номера сжимаются в 1..N.
 */
export function resolveDayPlanDrop(drag, target, maxRank = 0) {
  if (!drag || !target) return null;
  if (drag.kind !== 'task') return null;

  const taskId = drag.taskId;
  if (taskId == null) return null;

  if (target.kind === 'unplanned') {
    if (drag.fromRank == null) return null;
    return { taskId, rank: null, joinWave: false };
  }

  if (target.kind === 'append' || target.kind === 'board') {
    return { taskId, rank: null, joinWave: false, appendWave: true };
  }

  if (target.kind === 'insert') {
    const rank = Number(target.rank);
    if (!Number.isInteger(rank) || rank < 1) return null;
    if (drag.fromRank === rank) return null;
    return { taskId, rank, joinWave: false };
  }

  if (target.kind === 'place') {
    const rank = Number(target.rank);
    if (!Number.isInteger(rank) || rank < 1) return null;
    const beforeTaskId = target.beforeTaskId ?? null;
    const afterTaskId = target.afterTaskId ?? null;
    if (beforeTaskId == null && afterTaskId == null) return null;
    if (beforeTaskId === taskId || afterTaskId === taskId) return null;
    return {
      taskId,
      rank,
      joinWave: true,
      beforeTaskId,
      afterTaskId
    };
  }

  if (target.kind === 'card') {
    if (target.taskId === taskId) return null;
    const rank = Number(target.rank);
    if (!Number.isInteger(rank) || rank < 1) return null;
    if (target.edge === 'before' || target.edge === 'after') {
      return {
        taskId,
        rank,
        joinWave: true,
        beforeTaskId: target.edge === 'before' ? target.taskId : null,
        afterTaskId: target.edge === 'after' ? target.taskId : null
      };
    }
    if (drag.fromRank === rank) return null;
    return { taskId, rank, joinWave: true };
  }

  return null;
}

export function pointerMovedEnough(start, current, threshold = DAY_PLAN_DRAG_THRESHOLD) {
  if (!start || !current) return false;
  const dx = current.x - start.x;
  const dy = current.y - start.y;
  return (dx * dx) + (dy * dy) >= threshold * threshold;
}

export function parseDropPayload(value) {
  if (!value) return null;
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Карточка без номера очереди — не цель drop (призрак / «Не в плане»). */
export function isUsableDayPlanDrop(parsed) {
  if (!parsed || typeof parsed !== 'object' || !parsed.kind) return false;
  if (parsed.kind === 'card') {
    const rank = Number(parsed.rank);
    return Number.isInteger(rank) && rank > 0;
  }
  if (parsed.kind === 'place') {
    const rank = Number(parsed.rank);
    return Number.isInteger(rank) && rank > 0
      && (parsed.beforeTaskId != null || parsed.afterTaskId != null);
  }
  return true;
}

export function findDropTarget(clientX, clientY) {
  if (typeof document === 'undefined' || typeof document.elementsFromPoint !== 'function') {
    return null;
  }
  const stack = document.elementsFromPoint(clientX, clientY);
  for (const el of stack) {
    if (el.closest?.('[data-day-plan-ghost]')) continue;
    let node = el.closest?.('[data-day-plan-drop]');
    while (node) {
      if (node.closest?.('[data-day-plan-ghost]')) break;
      const parsed = parseDropPayload(node.getAttribute('data-day-plan-drop'));
      if (isUsableDayPlanDrop(parsed)) {
        if (parsed.kind === 'card') {
          const rect = node.getBoundingClientRect();
          parsed.edge = clientX < rect.left + rect.width / 2 ? 'before' : 'after';
        }
        return parsed;
      }
      const parent = node.parentElement;
      node = parent?.closest?.('[data-day-plan-drop]') ?? null;
    }
  }
  return null;
}
