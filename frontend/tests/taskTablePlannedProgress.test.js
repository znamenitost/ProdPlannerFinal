import test from 'node:test';
import assert from 'node:assert/strict';
import {
  collectInProgressProgressTaskIds,
  hasPlannedProgressFooter,
  isTaskStatusInProgress
} from '../src/utils/taskTablePlannedProgress.js';
import {
  STATUS_COMPLETED,
  STATUS_IN_PROGRESS,
  STATUS_PAUSED
} from '../src/constants/taskStatuses.js';

test('isTaskStatusInProgress matches status text and enum', () => {
  assert.equal(isTaskStatusInProgress({ statusText: STATUS_IN_PROGRESS }), true);
  assert.equal(isTaskStatusInProgress({ status: 1 }), true);
  assert.equal(isTaskStatusInProgress({ statusText: STATUS_PAUSED }), false);
  assert.equal(isTaskStatusInProgress({ statusText: 'Назначена' }), false);
});

test('hasPlannedProgressFooter requires user preference and server flag', () => {
  const row = { showPlannedTimeProgress: true };
  assert.equal(hasPlannedProgressFooter(row, false), false);
  assert.equal(hasPlannedProgressFooter(row, true), true);
  assert.equal(hasPlannedProgressFooter({ showPlannedTimeProgress: false }, true), false);
});

test('hasPlannedProgressFooter hides completed tasks', () => {
  const row = { showPlannedTimeProgress: true, statusText: STATUS_COMPLETED };
  assert.equal(hasPlannedProgressFooter(row, true), false);
  assert.equal(hasPlannedProgressFooter({ showPlannedTimeProgress: true, status: 3 }, true), false);
});

test('collectInProgressProgressTaskIds includes only visible in-progress rows', () => {
  const rows = [
    { id: 1, statusText: STATUS_IN_PROGRESS, isSplitTask: false },
    { id: 2, statusText: STATUS_PAUSED, isSplitTask: false },
    { id: 3, statusText: 'Назначена', isSplitTask: false },
    { id: 10, isSplitTask: true }
  ];
  const childrenCache = new Map([
    [10, [
      { id: 11, statusText: STATUS_IN_PROGRESS },
      { id: 12, statusText: STATUS_PAUSED }
    ]]
  ]);
  const expandedRows = new Set([10]);

  const ids = collectInProgressProgressTaskIds({
    rows,
    childrenCache,
    expandedRows
  });

  assert.deepEqual(ids, [
    { id: 1, isChild: false },
    { id: 11, isChild: true, parentId: 10 }
  ]);
});

test('collectInProgressProgressTaskIds includes split parent in progress even when collapsed', () => {
  const rows = [{ id: 10, isSplitTask: true, statusText: STATUS_IN_PROGRESS }];
  const childrenCache = new Map([
    [10, [{ id: 11, statusText: STATUS_COMPLETED }]]
  ]);

  const ids = collectInProgressProgressTaskIds({
    rows,
    childrenCache,
    expandedRows: new Set()
  });

  assert.deepEqual(ids, [{ id: 10, isChild: false }]);
});

test('collectInProgressProgressTaskIds skips collapsed split children', () => {
  const rows = [{ id: 10, isSplitTask: true }];
  const childrenCache = new Map([
    [10, [{ id: 11, statusText: STATUS_IN_PROGRESS }]]
  ]);

  const ids = collectInProgressProgressTaskIds({
    rows,
    childrenCache,
    expandedRows: new Set()
  });

  assert.deepEqual(ids, []);
});

test('collectInProgressProgressTaskIds respects search auto-expand', () => {
  const rows = [{ id: 10, isSplitTask: true }];
  const childrenCache = new Map([
    [10, [{ id: 11, statusText: STATUS_IN_PROGRESS }]]
  ]);

  const ids = collectInProgressProgressTaskIds({
    rows,
    childrenCache,
    expandedRows: new Set(),
    autoExpandIds: new Set([10])
  });

  assert.deepEqual(ids, [{ id: 11, isChild: true, parentId: 10 }]);
});
