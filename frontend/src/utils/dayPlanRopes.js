/** Карточки волны: один блок на задачу (сегменты обеда склеиваются). */
export function uniqueCardsForWave(wave) {
  const byId = new Map();
  for (const block of wave?.blocks || []) {
    const id = block.taskId;
    if (id == null) continue;
    const existing = byId.get(id);
    if (!existing) {
      byId.set(id, {
        ...block,
        hours: Number(block.hours) || 0,
        lane: block.lane ?? 0
      });
      continue;
    }
    existing.hours += Number(block.hours) || 0;
    if (block.start && (!existing.start || new Date(block.start) < new Date(existing.start))) {
      existing.start = block.start;
    }
  }
  return [...byId.values()].sort((a, b) => a.lane - b.lane || a.taskId - b.taskId);
}

function round(n) {
  return Math.round(n * 10) / 10;
}

export function horizontalRopePath(x1, x2, y) {
  const left = Math.min(x1, x2);
  const right = Math.max(x1, x2);
  const mid = (left + right) / 2;
  const sag = Math.min(14, Math.max(6, (right - left) * 0.14));
  return `M ${round(left)} ${round(y)} Q ${round(mid)} ${round(y + sag)} ${round(right)} ${round(y)}`;
}

export function verticalRopePath(x1, y1, x2, y2) {
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const sag = Math.min(22, Math.max(10, Math.abs(x2 - x1) * 0.12 + Math.abs(y2 - y1) * 0.12));
  return `M ${round(x1)} ${round(y1)} Q ${round(midX + sag)} ${round(midY)} ${round(x2)} ${round(y2)}`;
}

function centerX(card) {
  return card.x + card.w / 2;
}

function midY(card) {
  return card.y + card.h / 2;
}

function bottomY(card) {
  return card.y + card.h;
}

/**
 * Верёвки по измеренным карточкам.
 * waves: [{ cards: [{ x, y, w, h }] }] в координатах контейнера.
 * Горизонтали — параллельные задачи волны; вертикали — переход
 * к следующей волне (она стартует после самой длинной задачи предыдущей).
 */
export function buildWaveRopes(waves) {
  const horizontals = [];
  const verticals = [];

  for (const wave of waves) {
    const cards = wave.cards || [];
    if (cards.length < 2) continue;
    for (let i = 0; i < cards.length - 1; i += 1) {
      const a = cards[i];
      const b = cards[i + 1];
      horizontals.push(horizontalRopePath(a.x + a.w, b.x, (midY(a) + midY(b)) / 2));
    }
  }

  for (let i = 0; i < waves.length - 1; i += 1) {
    const from = waves[i].cards || [];
    const to = waves[i + 1].cards || [];
    if (from.length === 0 || to.length === 0) continue;

    const fromX = from.reduce((sum, card) => sum + centerX(card), 0) / from.length;
    const toX = to.reduce((sum, card) => sum + centerX(card), 0) / to.length;
    const fromY = Math.max(...from.map(bottomY));
    const toY = Math.min(...to.map((card) => card.y));

    verticals.push(verticalRopePath(fromX, fromY, toX, toY));
  }

  return { horizontals, verticals };
}
