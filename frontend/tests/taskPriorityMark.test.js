import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getPriorityMarkViewerEmployeeName,
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
  it('returns null for admin', () => {
    assert.equal(getPriorityMarkViewerEmployeeName({ role: 'Admin', fullName: 'Админ' }), null);
  });

  it('returns full name for employee', () => {
    assert.equal(
      getPriorityMarkViewerEmployeeName({ role: 'Employee', fullName: 'Дима' }),
      'Дима'
    );
  });
});
