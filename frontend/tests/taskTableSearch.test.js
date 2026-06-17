import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildTaskTableSearchResult,
  getTaskSearchScore
} from '../src/utils/taskTableSearch.js';

test('getTaskSearchScore counts partial and full matches across task fields', () => {
  const row = {
    folderPath: 'Проект Альфа',
    fileName: 'banner-print.pdf'
  };

  assert.equal(getTaskSearchScore(row, ''), 0);
  assert.ok(getTaskSearchScore(row, 'альфа') > 0);
  assert.ok(getTaskSearchScore(row, 'banner') > 0);
  assert.ok(getTaskSearchScore(row, 'banner print') > getTaskSearchScore(row, 'banner'));
  assert.ok(getTaskSearchScore(row, 'Проект Альфа') > getTaskSearchScore(row, 'проект'));
});

test('buildTaskTableSearchResult ranks rows with more matches higher', () => {
  const rows = [
    { id: 1, folderPath: 'A', fileName: 'one.pdf' },
    { id: 2, folderPath: 'one project', fileName: 'one-two.pdf' }
  ];
  const childrenCache = new Map();

  const result = buildTaskTableSearchResult(rows, childrenCache, 'one', () => 0);

  assert.equal(result.rows.length, 2);
  assert.equal(result.rows[0].id, 2);
  assert.equal(result.rows[1].id, 1);
  assert.ok(getTaskSearchScore(rows[1], 'one') > getTaskSearchScore(rows[0], 'one'));
});

test('buildTaskTableSearchResult keeps only matching children for split parents', () => {
  const rows = [{ id: 10, isSplitTask: true, folderPath: 'Root', fileName: 'root.pdf' }];
  const childrenCache = new Map([
    [
      10,
      [
        { id: 101, folderPath: 'Child A', fileName: 'needle.pdf' },
        { id: 102, folderPath: 'Child B', fileName: 'other.pdf' }
      ]
    ]
  ]);

  const result = buildTaskTableSearchResult(rows, childrenCache, 'needle', () => 0);

  assert.equal(result.rows.length, 1);
  assert.ok(result.autoExpandIds.has(10));
  assert.deepEqual([...result.childrenFilter.get(10)], [101]);
});

test('buildTaskTableSearchResult with serverFiltered keeps all rows and filters children', () => {
  const rows = [
    { id: 10, isSplitTask: true, folderPath: 'Root', fileName: 'root.pdf' },
    { id: 20, folderPath: 'Other', fileName: 'needle.pdf' }
  ];
  const childrenCache = new Map([
    [
      10,
      [
        { id: 101, folderPath: 'Child A', fileName: 'needle.pdf' },
        { id: 102, folderPath: 'Child B', fileName: 'other.pdf' }
      ]
    ]
  ]);

  const result = buildTaskTableSearchResult(rows, childrenCache, 'needle', () => 0, {
    serverFiltered: true
  });

  assert.equal(result.rows.length, 2);
  assert.ok(result.autoExpandIds.has(10));
  assert.deepEqual([...result.childrenFilter.get(10)], [101]);
});
