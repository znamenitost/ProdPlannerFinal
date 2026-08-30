import { tokens } from '../theme/paletteTokens.js';

export const TWIN_LINK_COLOR = tokens.primary.dark;

/** Id родительской строки сплита. 0/пусто — не группа. Строка «10» и число 10 совпадают. */
export function splitGroupId(task) {
  const raw = task?.parentRowNumber ?? task?.ParentRowNumber;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function visitPlanTasks(plan, visit) {
  for (const wave of plan?.waves || []) {
    for (const block of wave.blocks || []) visit(block?.task);
    for (const task of wave.blocked || []) visit(task);
  }
  for (const task of plan?.unplanned || []) visit(task);
}

export function collectTwinGroupIds(planA, planB) {
  const groupsA = new Set();
  const groupsB = new Set();
  visitPlanTasks(planA, (task) => {
    const id = splitGroupId(task);
    if (id != null) groupsA.add(id);
  });
  visitPlanTasks(planB, (task) => {
    const id = splitGroupId(task);
    if (id != null) groupsB.add(id);
  });
  const twins = new Set();
  for (const id of groupsA) {
    if (groupsB.has(id)) twins.add(id);
  }
  return twins;
}

export function isTwinGroupHighlighted(task, { activeGroupId, twinGroupIds, showAll } = {}) {
  const group = splitGroupId(task);
  if (group == null) return false;
  if (showAll && twinGroupIds?.has(group)) return true;
  const active = splitGroupId({ parentRowNumber: activeGroupId });
  return active != null && group === active;
}

/**
 * Связи-близнецы между двумя досками плана: одна группа сплита (parentRowNumber)
 * живёт на обеих досках как отдельные карточки. Пара — карточки разных досок.
 */
export function collectTwinPairs(nodes) {
  const byGroup = new Map();
  for (const node of nodes || []) {
    const group = splitGroupId({ parentRowNumber: node?.group });
    if (group == null || !node.board) continue;
    if (!byGroup.has(group)) byGroup.set(group, []);
    byGroup.get(group).push({ ...node, group });
  }

  const pairs = [];
  for (const [group, groupNodes] of byGroup) {
    const byBoard = new Map();
    for (const node of groupNodes) {
      if (!byBoard.has(node.board)) byBoard.set(node.board, node);
    }
    if (byBoard.size < 2) continue;
    const [a, b] = [...byBoard.values()];
    pairs.push({ group, a, b });
  }
  return pairs;
}

function round(n) {
  return Math.round(n * 10) / 10;
}

/**
 * Bezier от края карточки `from` к краю карточки `to`.
 */
export function twinLinkPath(from, to) {
  const fromCx = from.x + from.w / 2;
  const toCx = to.x + to.w / 2;
  const fromY = from.y + from.h / 2;
  const toY = to.y + to.h / 2;
  const forward = toCx >= fromCx;
  const x1 = forward ? from.x + from.w : from.x;
  const x2 = forward ? to.x : to.x + to.w;
  const bend = Math.max(24, Math.abs(x2 - x1) * 0.45) * (forward ? 1 : -1);
  return `M ${round(x1)} ${round(fromY)} C ${round(x1 + bend)} ${round(fromY)}, ${round(x2 - bend)} ${round(toY)}, ${round(x2)} ${round(toY)}`;
}
