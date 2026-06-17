import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { taskShowsThroughApproval } from '../src/utils/throughApproval.js';
import {
  STATUS_COMPLETED,
  STATUS_IN_PROGRESS,
  WORK_PHASE_AWAITING_APPROVAL,
  WORK_PHASE_TEST
} from '../src/constants/taskStatuses.js';

const splitParent = {
  id: 1,
  isSplitTask: true,
  parentRowNumber: null,
  statusText: STATUS_IN_PROGRESS
};

const testChild = {
  id: 2,
  parentRowNumber: 1,
  requiresTestBeforeProduction: true,
  testEstimateHours: 1,
  productionEstimateHours: 2,
  workPhase: WORK_PHASE_TEST,
  statusText: STATUS_IN_PROGRESS
};

describe('taskShowsThroughApproval', () => {
  it('shows marker on split parent when a child is in test phase', () => {
    assert.equal(taskShowsThroughApproval(splitParent, [testChild]), true);
  });

  it('hides marker on split parent when child moved to approval phase', () => {
    const child = { ...testChild, workPhase: WORK_PHASE_AWAITING_APPROVAL, statusText: 'Согласование' };
    assert.equal(taskShowsThroughApproval(splitParent, [child]), false);
  });

  it('hides marker on split parent when all children completed', () => {
    const child = { ...testChild, workPhase: 4, statusText: STATUS_COMPLETED };
    assert.equal(taskShowsThroughApproval(splitParent, [child]), false);
  });

  it('hides marker on split parent when parent is completed', () => {
    const parent = { ...splitParent, statusText: STATUS_COMPLETED };
    assert.equal(taskShowsThroughApproval(parent, [testChild]), false);
  });

  it('shows marker on standalone test-phase task', () => {
    assert.equal(taskShowsThroughApproval(testChild), true);
  });

  it('shows marker on split parent via server flag when children not loaded', () => {
    const parent = { ...splitParent, showsThroughApproval: true };
    assert.equal(taskShowsThroughApproval(parent), true);
  });
});
