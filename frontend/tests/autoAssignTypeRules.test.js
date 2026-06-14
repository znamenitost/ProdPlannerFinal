import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  createDefaultAutoAssignTypeRules,
  getEligibleEmployees,
  getUncoveredTaskTypes,
  normalizeAutoAssignTypeRules
} from '../src/utils/autoAssignTypeRules.js';
import {
  applyAutoAssignToParts,
  didExpandPartsByTypeSplit,
  partTotalHours,
  splitValueProportionally
} from '../src/utils/autoAssignSplitParts.js';

const employees = ['Дима', 'Яромир'];
const taskTypes = ['Резка', 'УФ Печать', 'Сборка'];

describe('autoAssignTypeRules', () => {
  it('creates default rules with all task types per employee', () => {
    const rules = createDefaultAutoAssignTypeRules(employees, taskTypes);
    assert.deepEqual(rules, {
      Дима: [...taskTypes],
      Яромир: [...taskTypes]
    });
  });

  it('filters employees by all selected part task types', () => {
    const rules = {
      Дима: ['Резка', 'УФ Печать'],
      Яромир: ['Резка']
    };

    assert.deepEqual(
      getEligibleEmployees(employees, ['Резка'], rules),
      ['Дима', 'Яромир']
    );
    assert.deepEqual(
      getEligibleEmployees(employees, ['Резка', 'УФ Печать'], rules),
      ['Дима']
    );
    assert.deepEqual(
      getEligibleEmployees(employees, ['Сборка'], rules),
      []
    );
  });

  it('excludes employees without allowed types even when part has no types yet', () => {
    const rules = { Дима: ['Резка'], Яромир: [] };
    assert.deepEqual(getEligibleEmployees(employees, [], rules), ['Дима']);
  });

  it('normalizes saved rules and drops unknown task types', () => {
    const normalized = normalizeAutoAssignTypeRules(
      { Дима: ['Резка', 'Unknown'], Яромир: null },
      employees,
      taskTypes
    );

    assert.deepEqual(normalized.Дима, ['Резка']);
    assert.deepEqual(normalized.Яромир, taskTypes);
  });

  it('returns uncovered task types when no employee can perform them', () => {
    const rules = { Дима: ['Резка'], Яромир: ['УФ Печать'] };
    assert.deepEqual(
      getUncoveredTaskTypes(employees, ['Резка', 'Сборка'], rules),
      ['Сборка']
    );
  });
});

describe('applyAutoAssignToParts with type rules', () => {
  it('assigns only to employees allowed for part task types', () => {
    const parts = [
      { employeeName: '', taskTypes: ['УФ Печать'], hours: 5, throughTest: false },
      { employeeName: '', taskTypes: ['Резка'], hours: 3, throughTest: false }
    ];
    const typeRules = {
      Дима: ['Резка', 'УФ Печать'],
      Яромир: ['Резка']
    };

    const result = applyAutoAssignToParts(parts, {
      employees,
      baseTaskCounts: { Дима: 0, Яромир: 0 },
      typeRules
    });

    assert.equal(result[0].employeeName, 'Дима');
    assert.equal(result[1].employeeName, 'Яромир');
  });

  it('keeps part unchanged when no employee matches task types', () => {
    const parts = [{ employeeName: '', taskTypes: ['Сборка'], hours: 4, throughTest: false }];
    const typeRules = { Дима: ['Резка'], Яромир: ['Резка'] };

    const result = applyAutoAssignToParts(parts, {
      employees,
      baseTaskCounts: { Дима: 0, Яромир: 0 },
      typeRules
    });

    assert.equal(result[0].employeeName, '');
  });

  it('splits mixed task types into parallel parts with proportional hours', () => {
    const parts = [{
      employeeName: '',
      taskTypes: ['Резка', 'УФ Печать'],
      hours: 10,
      throughTest: false
    }];
    const typeRules = {
      Дима: ['Резка'],
      Яромир: ['УФ Печать']
    };

    const result = applyAutoAssignToParts(parts, {
      employees,
      baseTaskCounts: { Дима: 0, Яромир: 0 },
      typeRules
    });

    assert.equal(result.length, 2);
    assert.equal(result[0].employeeName, 'Дима');
    assert.deepEqual(result[0].taskTypes, ['Резка']);
    assert.equal(result[0].hours, 5);
    assert.equal(result[1].employeeName, 'Яромир');
    assert.deepEqual(result[1].taskTypes, ['УФ Печать']);
    assert.equal(result[1].hours, 5);
    assert.equal(
      result.reduce((sum, part) => sum + partTotalHours(part), 0),
      10
    );
    assert.equal(didExpandPartsByTypeSplit(parts, result), true);
  });

  it('assigns remaining types to the next employee when the first covers only part of them', () => {
    const parts = [{
      employeeName: '',
      taskTypes: ['Резка', 'УФ Печать', 'Сборка'],
      hours: 9,
      throughTest: false
    }];
    const typeRules = {
      Дима: ['Резка', 'УФ Печать'],
      Яромир: ['Сборка']
    };

    const result = applyAutoAssignToParts(parts, {
      employees,
      baseTaskCounts: { Дима: 0, Яромир: 0 },
      typeRules
    });

    assert.equal(result.length, 2);
    assert.deepEqual(result[0].taskTypes, ['Резка', 'УФ Печать']);
    assert.equal(result[0].employeeName, 'Дима');
    assert.equal(result[0].hours, 6);
    assert.deepEqual(result[1].taskTypes, ['Сборка']);
    assert.equal(result[1].employeeName, 'Яромир');
    assert.equal(result[1].hours, 3);
  });

  it('balances split parts by active tasks and assigned hours', () => {
    const parts = [{
      employeeName: '',
      taskTypes: ['Резка', 'УФ Печать'],
      hours: 8,
      throughTest: false
    }];
    const typeRules = {
      Дима: ['Резка'],
      Яромир: ['УФ Печать']
    };

    const result = applyAutoAssignToParts(parts, {
      employees,
      baseTaskCounts: { Дима: 2, Яромир: 0 },
      typeRules
    });

    assert.equal(result[0].employeeName, 'Яромир');
    assert.equal(result[1].employeeName, 'Дима');
  });
});

describe('splitValueProportionally', () => {
  it('preserves total when splitting by weights', () => {
    const slices = splitValueProportionally(10, [2, 1]);
    assert.deepEqual(slices, [6.7, 3.3]);
    assert.equal(slices.reduce((sum, value) => sum + value, 0), 10);
  });
});
