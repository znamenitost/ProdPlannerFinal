import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { applyAutoAssignToParts } from '../src/utils/autoAssignSplitParts.js';

const employees = ['Аня', 'Борис', 'Вика'];

describe('applyAutoAssignToParts', () => {
  it('assigns single part to employee with fewest active tasks', () => {
    const parts = [{ employeeName: '', hours: 5, throughTest: false }];
    const result = applyAutoAssignToParts(parts, {
      employees,
      baseTaskCounts: { Аня: 3, Борис: 1, Вика: 2 }
    });

    assert.equal(result[0].employeeName, 'Борис');
  });

  it('assigns shared parts greedily with hours from first part affecting second', () => {
    const parts = [
      { employeeName: '', hours: 10, throughTest: false },
      { employeeName: '', hours: 4, throughTest: false }
    ];
    const result = applyAutoAssignToParts(parts, {
      employees: ['Аня', 'Борис'],
      baseTaskCounts: { Аня: 0, Борис: 0 }
    });

    assert.equal(result[0].employeeName, 'Аня');
    assert.equal(result[1].employeeName, 'Борис');
  });

  it('keeps started parts in edit mode and accounts them in virtual load', () => {
    const parts = [
      { employeeName: 'Аня', hours: 8, throughTest: false, started: true },
      { employeeName: '', hours: 4, throughTest: false, started: false }
    ];
    const result = applyAutoAssignToParts(parts, {
      employees: ['Аня', 'Борис'],
      baseTaskCounts: { Аня: 0, Борис: 0 },
      isEdit: true
    });

    assert.equal(result[0].employeeName, 'Аня');
    assert.equal(result[1].employeeName, 'Борис');
  });

  it('uses through-test hours when balancing shared parts', () => {
    const parts = [
      { employeeName: '', throughTest: true, testHours: 2, productionHours: 6, hours: 0 },
      { employeeName: '', hours: 3, throughTest: false }
    ];
    const result = applyAutoAssignToParts(parts, {
      employees: ['Аня', 'Борис'],
      baseTaskCounts: { Аня: 0, Борис: 0 }
    });

    assert.equal(result[0].employeeName, 'Аня');
    assert.equal(result[1].employeeName, 'Борис');
  });
});
