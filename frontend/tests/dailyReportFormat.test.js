import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatDailyReportLine, formatHoursRu, formatPersonHoursRu } from '../src/utils/dailyReportFormat.js';

describe('dailyReportFormat', () => {
  it('formats single interval completed task', () => {
    const line = formatDailyReportLine({
      title: 'Арета',
      intervalHours: [3],
      totalHours: 3,
      isCompleted: true
    });
    assert.equal(line, 'Арета 3 часа. Выполнена');
  });

  it('formats multiple intervals in progress', () => {
    const line = formatDailyReportLine({
      title: 'Феодоровский завод',
      intervalHours: [1, 2, 3],
      totalHours: 6,
      isCompleted: false
    });
    assert.equal(line, 'Феодоровский завод (1+2+3) 6 часов. В процессе');
  });

  it('pluralizes hours correctly', () => {
    assert.equal(formatHoursRu(1), '1 час');
    assert.equal(formatHoursRu(2), '2 часа');
    assert.equal(formatHoursRu(5), '5 часов');
  });

  it('pluralizes person-hours correctly', () => {
    assert.equal(formatPersonHoursRu(1), '1 человекочас');
    assert.equal(formatPersonHoursRu(3), '3 человекочаса');
    assert.equal(formatPersonHoursRu(6), '6 человекочасов');
  });
});
