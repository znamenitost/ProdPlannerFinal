import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  cardsForWave,
  isUsableDayPlanDrop,
  maxWaveRank,
  planableUnplanned,
  pointerMovedEnough,
  resolveDayPlanDrop
} from '../src/utils/dayPlanBoard.js';
import { getTaskTypeVisual, DEFAULT_TASK_TYPE_VISUAL } from '../src/utils/taskTypeVisual.js';

describe('cardsForWave', () => {
  it('adds blocked tasks that are not already packed', () => {
    const cards = cardsForWave({
      rank: 1,
      blocks: [{ taskId: 1, hours: 1, lane: 0, task: { id: 1, type: 'Резка' } }],
      blocked: [
        { id: 1, remainingHours: 1 },
        { id: 2, remainingHours: 3, type: 'Сборка' }
      ]
    });
    assert.equal(cards.length, 2);
    assert.equal(cards[1].taskId, 2);
    assert.equal(cards[1].blocked, true);
    assert.equal(cards[1].hours, 3);
  });
});

describe('planableUnplanned', () => {
  it('skips fuss', () => {
    const list = planableUnplanned([
      { id: 1, isFuss: true },
      { id: 2, isFuss: false }
    ]);
    assert.deepEqual(list.map((t) => t.id), [2]);
  });
});

describe('maxWaveRank', () => {
  it('returns 0 when empty', () => {
    assert.equal(maxWaveRank([]), 0);
  });

  it('uses the highest wave number', () => {
    assert.equal(maxWaveRank([{ rank: 1 }, { rank: 3 }]), 3);
  });
});

describe('resolveDayPlanDrop', () => {
  it('joins a dragged task onto a card', () => {
    const change = resolveDayPlanDrop(
      { kind: 'task', taskId: 8, fromRank: null },
      { kind: 'card', taskId: 3, rank: 1 },
      1
    );
    assert.deepEqual(change, { taskId: 8, rank: 1, joinWave: true });
  });

  it('asks the server to append after every occupied rank', () => {
    const change = resolveDayPlanDrop(
      { kind: 'task', taskId: 8, fromRank: null },
      { kind: 'append' },
      2
    );
    assert.deepEqual(change, { taskId: 8, rank: null, joinWave: false, appendWave: true });
  });

  it('puts a task at the top as wave 1', () => {
    const change = resolveDayPlanDrop(
      { kind: 'task', taskId: 8, fromRank: 4 },
      { kind: 'insert', rank: 1 },
      4
    );
    assert.deepEqual(change, { taskId: 8, rank: 1, joinWave: false });
  });

  it('inserts with a shift, not a join', () => {
    const change = resolveDayPlanDrop(
      { kind: 'task', taskId: 8, fromRank: null },
      { kind: 'insert', rank: 2 },
      3
    );
    assert.deepEqual(change, { taskId: 8, rank: 2, joinWave: false });
  });

  it('clears rank when dropped on the unplanned tray', () => {
    const change = resolveDayPlanDrop(
      { kind: 'task', taskId: 8, fromRank: 1 },
      { kind: 'unplanned' },
      1
    );
    assert.deepEqual(change, { taskId: 8, rank: null, joinWave: false });
  });

  it('ignores dropping an unplanned task back on the tray', () => {
    assert.equal(
      resolveDayPlanDrop(
        { kind: 'task', taskId: 8, fromRank: null },
        { kind: 'unplanned' },
        0
      ),
      null
    );
  });

  it('ignores non-task drags', () => {
    assert.equal(
      resolveDayPlanDrop(
        { kind: 'rope', fromTaskId: 1, fromRank: 1, attach: 'side' },
        { kind: 'card', taskId: 2, rank: 3 },
        3
      ),
      null
    );
  });

  it('does not assign a card onto itself', () => {
    assert.equal(
      resolveDayPlanDrop(
        { kind: 'task', taskId: 1, fromRank: 1 },
        { kind: 'card', taskId: 1, rank: 2 },
        2
      ),
      null
    );
  });
});

describe('isUsableDayPlanDrop', () => {
  it('skips a ghost/unplanned card so the strip under it can receive the drop', () => {
    assert.equal(isUsableDayPlanDrop({ kind: 'card', taskId: 8, rank: null }), false);
    assert.equal(isUsableDayPlanDrop({ kind: 'append' }), true);
    assert.equal(isUsableDayPlanDrop({ kind: 'unplanned' }), true);
    assert.equal(isUsableDayPlanDrop({ kind: 'card', taskId: 3, rank: 2 }), true);
  });
});

describe('pointerMovedEnough', () => {
  it('stays idle under the threshold', () => {
    assert.equal(pointerMovedEnough({ x: 0, y: 0 }, { x: 3, y: 3 }), false);
  });

  it('starts a drag after the threshold', () => {
    assert.equal(pointerMovedEnough({ x: 0, y: 0 }, { x: 10, y: 0 }), true);
  });
});

describe('getTaskTypeVisual', () => {
  it('maps known types', () => {
    assert.equal(getTaskTypeVisual('Резка').icon, 'saw');
    assert.equal(getTaskTypeVisual('Сборка').icon, 'hands');
    assert.equal(getTaskTypeVisual('УФ Печать').icon, 'print');
    assert.equal(getTaskTypeVisual('УФ ДТФ').icon, 'sticker');
    assert.equal(getTaskTypeVisual('Гравировка FB').icon, 'laserFiber');
    assert.equal(getTaskTypeVisual('Гравировка CO2').icon, 'laserCo2');
    assert.equal(getTaskTypeVisual('Сублимация').icon, 'press');
    assert.equal(getTaskTypeVisual('Затирка').icon, 'paintCan');
    assert.equal(getTaskTypeVisual('3D печать').icon, 'printer3d');
    assert.equal(getTaskTypeVisual('Гравировка CO2, Резка').icon, 'laserCo2');
  });

  it('falls back for unknown types', () => {
    assert.equal(getTaskTypeVisual('').icon, DEFAULT_TASK_TYPE_VISUAL.icon);
    assert.equal(getTaskTypeVisual('Прочее').icon, DEFAULT_TASK_TYPE_VISUAL.icon);
  });
});
