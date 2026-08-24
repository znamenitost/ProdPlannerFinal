import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getPriorityRankOptions,
  getPriorityRankSortValue,
  getTaskPriorityRank,
  getVisiblePriorityRanks,
  sortActiveTasksForEmployeeStack
} from '../src/utils/taskPriorityRank.js';

describe('getVisiblePriorityRanks', () => {
  it('shows 1-2-3 when queue is empty', () => {
    assert.deepEqual(getVisiblePriorityRanks([]), [1, 2, 3]);
  });

  it('adds three next numbers after occupied 1 and 2', () => {
    assert.deepEqual(
      getVisiblePriorityRanks([{ rank: 1 }, { rank: 2 }]),
      [1, 2, 3, 4, 5]
    );
  });
});

describe('getPriorityRankOptions', () => {
  it('marks occupied as selected (filled) and free as outline', () => {
    const options = getPriorityRankOptions([{ rank: 1, label: 'A' }, { rank: 2, label: 'B' }]);
    assert.equal(options.find((o) => o.rank === 1).selected, true);
    assert.equal(options.find((o) => o.rank === 2).selected, true);
    assert.equal(options.find((o) => o.rank === 3).selected, false);
    assert.equal(options.find((o) => o.rank === 4).selected, false);
    assert.equal(options.find((o) => o.rank === 5).selected, false);
  });

  it('blocks occupied numbers for a new assignment', () => {
    const options = getPriorityRankOptions([{ rank: 1 }, { rank: 2 }]);
    assert.equal(options.find((o) => o.rank === 1).assignable, false);
    assert.equal(options.find((o) => o.rank === 3).assignable, true);
  });

  it('treats the current rank as selected even if queue is missing', () => {
    const options = getPriorityRankOptions([], 5);
    assert.equal(options.find((o) => o.rank === 5).selected, true);
    assert.equal(options.find((o) => o.rank === 5).current, true);
  });
});

describe('getTaskPriorityRank', () => {
  it('returns null without a rank', () => {
    assert.equal(getTaskPriorityRank({ isPriorityMarked: true }), null);
  });

  it('returns a positive rank', () => {
    assert.equal(getTaskPriorityRank({ priorityRank: 3 }), 3);
  });
});

describe('sortActiveTasksForEmployeeStack', () => {
  it('puts ranked tasks first from 1 to N, unranked last', () => {
    const sorted = sortActiveTasksForEmployeeStack([
      { id: 4, priorityRank: null, deadline: '2026-08-20T10:00:00' },
      { id: 3, priorityRank: 3, deadline: '2026-08-21T10:00:00' },
      { id: 1, priorityRank: 1, deadline: '2026-08-25T10:00:00' },
      { id: 2, priorityRank: 2, deadline: '2026-08-19T10:00:00' }
    ]);
    assert.deepEqual(sorted.map((task) => task.id), [1, 2, 3, 4]);
  });

  it('keeps deadline order among tasks without a rank', () => {
    const sorted = sortActiveTasksForEmployeeStack([
      { id: 'late', deadline: '2026-08-22T10:00:00' },
      { id: 'early', deadline: '2026-08-20T10:00:00' }
    ]);
    assert.deepEqual(sorted.map((task) => task.id), ['early', 'late']);
  });

  it('keeps a ranked task above a blocked unranked task', () => {
    const sorted = sortActiveTasksForEmployeeStack(
      [
        { id: 'blocked', deadline: '2026-08-18T10:00:00' },
        { id: 'ranked', priorityRank: 2, deadline: '2026-08-25T10:00:00' }
      ],
      { blockedBottomSort: true, isBlocked: (task) => task.id === 'blocked' }
    );
    assert.deepEqual(sorted.map((task) => task.id), ['ranked', 'blocked']);
  });

  it('uses original order when ranks and deadlines match', () => {
    const sorted = sortActiveTasksForEmployeeStack([
      { id: 'first', priorityRank: 1, deadline: '2026-08-20T10:00:00' },
      { id: 'second', priorityRank: 1, deadline: '2026-08-20T10:00:00' }
    ]);
    assert.deepEqual(sorted.map((task) => task.id), ['first', 'second']);
  });
});

describe('getPriorityRankSortValue', () => {
  it('sorts missing ranks after numbered ones', () => {
    assert.equal(getPriorityRankSortValue({ priorityRank: 1 }) < getPriorityRankSortValue({}), true);
  });
});
