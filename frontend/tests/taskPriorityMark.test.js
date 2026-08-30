import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getPriorityMarkViewerEmployeeName,
  getVisiblePriorityRank,
  taskShowsPriorityMark
} from '../src/utils/taskPriorityMark.js';

const splitParent = {
  id: 1,
  isSplitTask: true,
  parentRowNumber: null,
  isPriorityMarked: false
};

const child = {
  id: 2,
  parentRowNumber: 1,
  isSplitTask: true,
  employeeName: 'Дима',
  isPriorityMarked: false
};

describe('taskShowsPriorityMark', () => {
  it('shows marker on split parent when a child is marked', () => {
    assert.equal(taskShowsPriorityMark(splitParent, [{ ...child, isPriorityMarked: true }]), true);
  });

  it('hides marker on split parent when nobody is marked', () => {
    assert.equal(taskShowsPriorityMark(splitParent, [child]), false);
  });

  it('shows marker on split parent via server flag when children not loaded', () => {
    const parent = { ...splitParent, isPriorityMarked: true };
    assert.equal(taskShowsPriorityMark(parent), true);
  });

  it('shows marker on standalone task', () => {
    assert.equal(
      taskShowsPriorityMark({ ...child, isSplitTask: false, isPriorityMarked: true }),
      true
    );
  });

  it('shows marker on split parent when parent flag set even if children loaded', () => {
    const parent = { ...splitParent, isPriorityMarked: true };
    assert.equal(taskShowsPriorityMark(parent, [child]), true);
  });

  it('hides colleague mark from employee on split parent', () => {
    const colleagueChild = { ...child, employeeName: 'Яромир', isPriorityMarked: true };
    assert.equal(
      taskShowsPriorityMark(splitParent, [colleagueChild], { viewerEmployeeName: 'Дима' }),
      false
    );
  });

  it('shows own mark from employee on split parent', () => {
    const ownChild = { ...child, isPriorityMarked: true };
    assert.equal(
      taskShowsPriorityMark(splitParent, [ownChild], { viewerEmployeeName: 'Дима' }),
      true
    );
  });

  it('hides colleague mark from employee on child row', () => {
    const colleagueChild = { ...child, employeeName: 'Яромир', isPriorityMarked: true };
    assert.equal(
      taskShowsPriorityMark(colleagueChild, null, { viewerEmployeeName: 'Дима' }),
      false
    );
  });

  it('shows own mark from employee on child row', () => {
    const ownChild = { ...child, isPriorityMarked: true };
    assert.equal(
      taskShowsPriorityMark(ownChild, null, { viewerEmployeeName: 'Дима' }),
      true
    );
  });
});

describe('getPriorityMarkViewerEmployeeName', () => {
  it('returns null for admin without a selected employee', () => {
    assert.equal(getPriorityMarkViewerEmployeeName({ role: 'Admin', fullName: 'Админ' }), null);
  });

  it('returns the selected employee for admin', () => {
    assert.equal(
      getPriorityMarkViewerEmployeeName({ role: 'Admin', fullName: 'Админ' }, 'Дима'),
      'Дима'
    );
  });

  it('returns full name for employee', () => {
    assert.equal(
      getPriorityMarkViewerEmployeeName({ role: 'Employee', fullName: 'Дима' }),
      'Дима'
    );
  });
});

describe('getVisiblePriorityRank', () => {
  it('hides a colleague number from the current employee', () => {
    assert.equal(
      getVisiblePriorityRank(
        { employeeName: 'Павел', priorityRank: 1 },
        null,
        { viewerEmployeeName: 'Дима' }
      ),
      null
    );
  });

  it('shows own number on own task', () => {
    assert.equal(
      getVisiblePriorityRank(
        { employeeName: 'Дима', priorityRank: 2 },
        null,
        { viewerEmployeeName: 'Дима' }
      ),
      2
    );
  });

  it('shows only own child number on a split parent', () => {
    const parent = { id: 1, isSplitTask: true, parentRowNumber: null, priorityRank: 1 };
    const children = [
      { employeeName: 'Павел', priorityRank: 1 },
      { employeeName: 'Дима', priorityRank: 3 }
    ];
    assert.equal(
      getVisiblePriorityRank(parent, children, { viewerEmployeeName: 'Дима' }),
      3
    );
  });

  it('hides split parent number when only a colleague is ranked', () => {
    const parent = { id: 1, isSplitTask: true, parentRowNumber: null, priorityRank: 1 };
    const children = [{ employeeName: 'Павел', priorityRank: 1 }];
    assert.equal(
      getVisiblePriorityRank(parent, children, { viewerEmployeeName: 'Дима' }),
      null
    );
  });

  it('migrates the own child number onto the parent when children are not loaded', () => {
    const parent = { id: 1, isSplitTask: true, parentRowNumber: null, priorityRank: 2 };
    assert.equal(
      getVisiblePriorityRank(parent, [], { viewerEmployeeName: 'Дима' }),
      2
    );
  });

  it('uses a ranked own child even if another own child has no number', () => {
    const parent = { id: 1, isSplitTask: true, parentRowNumber: null };
    const children = [
      { employeeName: 'Дима', priorityRank: null },
      { employeeName: 'Павел', priorityRank: 1 },
      { employeeName: 'Дима', priorityRank: 4 }
    ];
    assert.equal(
      getVisiblePriorityRank(parent, children, { viewerEmployeeName: 'Дима' }),
      4
    );
  });

  it('hides a number on a split parent without a viewer', () => {
    const parent = { id: 1, isSplitTask: true, parentRowNumber: null, priorityRank: 1 };
    assert.equal(getVisiblePriorityRank(parent, [{ employeeName: 'Павел', priorityRank: 1 }]), null);
  });
});
