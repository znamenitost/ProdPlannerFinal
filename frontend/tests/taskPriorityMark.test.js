import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { taskShowsPriorityMark } from '../src/utils/taskPriorityMark.js';

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
    assert.equal(taskShowsPriorityMark({ ...child, isSplitTask: false, isPriorityMarked: true }), true);
  });

  it('shows marker on split parent when parent flag set even if children loaded', () => {
    const parent = { ...splitParent, isPriorityMarked: true };
    assert.equal(taskShowsPriorityMark(parent, [child]), true);
  });
});
