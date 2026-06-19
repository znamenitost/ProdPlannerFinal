import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeWorkSegmentsByTask } from '../src/utils/calendarTimelineMerge.js';

test('mergeWorkSegmentsByTask merges adjacent slices of one open task', () => {
  const segments = [
    {
      type: 'work',
      taskId: 42,
      start: new Date('2026-06-19T10:23:00'),
      end: new Date('2026-06-19T11:54:00'),
      isOpenInterval: true
    },
    {
      type: 'work',
      taskId: 42,
      start: new Date('2026-06-19T11:54:00'),
      end: new Date('2026-06-19T12:11:00'),
      isOpenInterval: true
    },
    {
      type: 'work',
      taskId: 42,
      start: new Date('2026-06-19T12:11:00'),
      end: new Date('2026-06-19T12:40:00'),
      isOpenInterval: true
    }
  ];

  const merged = mergeWorkSegmentsByTask(segments).filter((s) => s.taskId === 42);

  assert.equal(merged.length, 1);
  assert.equal(merged[0].start.getHours(), 10);
  assert.equal(merged[0].start.getMinutes(), 23);
  assert.equal(merged[0].end.getHours(), 12);
  assert.equal(merged[0].end.getMinutes(), 40);
});

test('mergeWorkSegmentsByTask keeps separate pause gaps for same task', () => {
  const segments = [
    {
      type: 'work',
      taskId: 7,
      start: new Date('2026-06-19T10:00:00'),
      end: new Date('2026-06-19T11:00:00'),
      isOpenInterval: false
    },
    {
      type: 'work',
      taskId: 7,
      start: new Date('2026-06-19T15:00:00'),
      end: new Date('2026-06-19T16:00:00'),
      isOpenInterval: true
    }
  ];

  const merged = mergeWorkSegmentsByTask(segments).filter((s) => s.taskId === 7);
  assert.equal(merged.length, 2);
});
