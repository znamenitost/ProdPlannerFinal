import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  uniqueCardsForWave,
  horizontalRopePath,
  verticalRopePath,
  buildWaveRopes
} from '../src/utils/dayPlanRopes.js';

describe('dayPlanRopes', () => {
  it('merges lunch-split segments of the same task', () => {
    const cards = uniqueCardsForWave({
      blocks: [
        { taskId: 1, hours: 1, lane: 0, start: '2026-08-25T10:00:00' },
        { taskId: 1, hours: 0.5, lane: 0, start: '2026-08-25T13:30:00' },
        { taskId: 2, hours: 2, lane: 1, start: '2026-08-25T10:00:00' }
      ]
    });
    assert.equal(cards.length, 2);
    assert.equal(cards[0].hours, 1.5);
    assert.equal(cards[1].taskId, 2);
  });

  it('draws a sagging horizontal rope between parallel cards', () => {
    const d = horizontalRopePath(100, 200, 40);
    assert.match(d, /^M 100 40 Q 150 \d+(\.\d+)? 200 40$/);
  });

  it('links waves with a sagging vertical rope from wave center to wave center', () => {
    const ropes = buildWaveRopes([
      {
        cards: [
          { x: 0, y: 0, w: 100, h: 80 },
          { x: 160, y: 0, w: 100, h: 80 }
        ]
      },
      {
        cards: [{ x: 80, y: 160, w: 100, h: 80 }]
      }
    ]);

    assert.equal(ropes.horizontals.length, 1);
    assert.equal(ropes.verticals.length, 1);
    assert.match(ropes.verticals[0], /^M 130 80 Q /);
    assert.match(ropes.verticals[0], / 130 160$/);
  });

  it('draws a sagging vertical rope between stacked cards', () => {
    const d = verticalRopePath(130, 80, 130, 160);
    assert.match(d, /^M 130 80 Q \d+(\.\d+)? 120 130 160$/);
  });

  it('draws nothing for a single wave', () => {
    const ropes = buildWaveRopes([
      { cards: [{ x: 0, y: 0, w: 100, h: 80 }] }
    ]);

    assert.equal(ropes.horizontals.length, 0);
    assert.equal(ropes.verticals.length, 0);
  });
});
