import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  formatDayPlanDeadline,
  formatDayPlanDeadlineLabel,
  getDayPlanAssigneeNames,
  getDayPlanCommentOpenTask,
  getDayPlanCommentSnippet,
  getDayPlanDeadlineTone,
  getDayPlanFileLabel,
  getDayPlanSplitLine,
  getDayPlanSplitParentId,
  isDayPlanTaskCurrent,
  shouldDimDayPlanCard
} from '../src/utils/dayPlanCardIdentity.js';

describe('dayPlanCardIdentity', () => {
  it('takes the first non-empty comment line and trims it', () => {
    assert.equal(getDayPlanCommentSnippet('  \nномерки 30×40, без лака\nещё'), 'номерки 30×40, без лака');
    assert.equal(getDayPlanCommentSnippet(''), '');
    assert.equal(getDayPlanCommentSnippet('a'.repeat(80)).endsWith('…'), true);
  });

  it('hides the placeholder file label', () => {
    assert.equal(getDayPlanFileLabel({ fileName: 'a.cdr' }), 'a.cdr');
    assert.equal(getDayPlanFileLabel({ isFuss: true }), '');
    assert.equal(getDayPlanFileLabel({}), '');
  });

  it('treats started and paused tasks as current', () => {
    assert.equal(isDayPlanTaskCurrent({ statusText: 'Начал' }), true);
    assert.equal(isDayPlanTaskCurrent({ statusText: 'Пауза' }), true);
    assert.equal(isDayPlanTaskCurrent({ statusText: 'Назначена' }), false);
  });

  it('dims other cards only when one is focused by click', () => {
    assert.equal(shouldDimDayPlanCard({ taskId: 1, focusedTaskId: 2 }), true);
    assert.equal(shouldDimDayPlanCard({ taskId: 2, focusedTaskId: 2 }), false);
    assert.equal(shouldDimDayPlanCard({ taskId: 1, focusedTaskId: null }), false);
    assert.equal(shouldDimDayPlanCard({ taskId: 3, focusedTaskId: null }), false);
  });

  it('marks overdue and same-day deadlines', () => {
    const now = new Date(2026, 7, 30, 15, 0, 0);
    assert.equal(getDayPlanDeadlineTone('2026-08-29T12:00:00', now), 'overdue');
    assert.equal(getDayPlanDeadlineTone('2026-08-30T18:00:00', now), 'today');
    assert.equal(getDayPlanDeadlineTone('2026-09-01T10:00:00', now), 'later');
    assert.equal(formatDayPlanDeadline('2026-08-31T16:00:00').includes('31.08'), true);
    assert.equal(formatDayPlanDeadlineLabel('2026-08-31T16:00:00'), '31.08 16:00');
    assert.equal(formatDayPlanDeadlineLabel(''), '');
  });

  it('describes split partners and sequential stages', () => {
    assert.equal(
      getDayPlanSplitLine({ isSplitTask: true, supplyMode: 1, sequenceOrder: 2, partnerNames: ['Иван'] }),
      'Этап 2 → Иван'
    );
    assert.equal(
      getDayPlanSplitLine({ isSplitTask: true, supplyMode: 2, partnerNames: ['Оля', 'Дима'] }),
      'Вместе: Оля, Дима'
    );
    assert.equal(getDayPlanSplitLine({ isSplitTask: true }), 'Общая задача');
    assert.equal(getDayPlanSplitLine({ partnerNames: [] }), '');
  });

  it('resolves the parent id for split cards', () => {
    assert.equal(getDayPlanSplitParentId({ parentRowNumber: 12, id: 40 }), 12);
    assert.equal(getDayPlanSplitParentId({ isSplitTask: true, id: 7 }), 7);
    assert.equal(getDayPlanSplitParentId({ id: 3 }), null);
  });

  it('lists the current employee first and unique partners after', () => {
    assert.deepEqual(
      getDayPlanAssigneeNames({ partnerNames: ['Оля', 'Дима'] }, 'Дима'),
      ['Дима', 'Оля']
    );
    assert.deepEqual(getDayPlanAssigneeNames({ partnerNames: [] }, 'Павел'), ['Павел']);
  });

  it('opens parent comments when only the parent has unread ones', () => {
    const task = { id: 40, commentTaskId: 12 };
    assert.equal(getDayPlanCommentOpenTask(task).id, 12);
    assert.equal(getDayPlanCommentOpenTask({ id: 40 }).id, 40);
  });
});
