import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  addWorkdays,
  getWorkdayOrNext,
  getPlanAnchorDate,
  formatDayPlanDateKey
} from '../src/utils/dayPlanDate.js';

describe('dayPlanDate', () => {
  it('skips weekend when stepping workdays', () => {
    const friday = new Date(2026, 7, 21);
    const monday = addWorkdays(friday, 1);
    assert.equal(formatDayPlanDateKey(monday), '2026-08-24');
  });

  it('moves Saturday to next Monday', () => {
    const saturday = new Date(2026, 7, 22);
    const next = getWorkdayOrNext(saturday);
    assert.equal(formatDayPlanDateKey(next), '2026-08-24');
  });

  it('after 19:00 anchors to the next workday', () => {
    const mondayEvening = new Date(2026, 7, 24, 19, 30, 0);
    assert.equal(formatDayPlanDateKey(getPlanAnchorDate(mondayEvening)), '2026-08-25');
  });

  it('before 19:00 on a workday stays today', () => {
    const mondayMorning = new Date(2026, 7, 24, 11, 0, 0);
    assert.equal(formatDayPlanDateKey(getPlanAnchorDate(mondayMorning)), '2026-08-24');
  });
});
