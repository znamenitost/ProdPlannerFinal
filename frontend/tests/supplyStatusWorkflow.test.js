import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { runWorkflowWithSequenceGuard } from '../src/utils/supplyStatusWorkflow.js';
import { STATUS_ASSIGNED, STATUS_PENDING_APPROVAL, STATUS_APPROVED } from '../src/constants/taskStatuses.js';

describe('supplyStatusWorkflow', () => {
  it('prompts for sequence override before start on Waiting', async () => {
    const calls = [];
    const task = { id: 1, statusText: 'Ожидание', sequenceStartBlocked: true };

    const result = await runWorkflowWithSequenceGuard({
      task,
      statusText: 'Ожидание',
      confirm: async () => {
        calls.push('confirm');
        return true;
      },
      resolveStatus: async (_t, target, extra) => {
        calls.push(`resolve:${target}:${extra?.sequenceOverride}`);
      },
      runAction: async () => calls.push('action'),
      actionLabel: 'Начал'
    });

    assert.equal(result, true);
    assert.deepEqual(calls, ['confirm', `resolve:${STATUS_ASSIGNED}:true`, 'action']);
  });

  it('falls back to info guard for approval block', async () => {
    const calls = [];
    const task = { id: 2, statusText: STATUS_PENDING_APPROVAL };

    const result = await runWorkflowWithSequenceGuard({
      task,
      statusText: STATUS_PENDING_APPROVAL,
      confirm: async () => true,
      resolveStatus: async (_t, target) => calls.push(`resolve:${target}`),
      runAction: async () => calls.push('action'),
      actionLabel: 'Начал'
    });

    assert.equal(result, true);
    assert.deepEqual(calls, [`resolve:${STATUS_APPROVED}`, 'action']);
  });

  it('runs action directly when no guards apply', async () => {
    const calls = [];
    const task = { id: 3, statusText: 'Назначена' };

    const result = await runWorkflowWithSequenceGuard({
      task,
      statusText: 'Назначена',
      confirm: async () => true,
      resolveStatus: async () => calls.push('resolve'),
      runAction: async () => calls.push('action')
    });

    assert.equal(result, true);
    assert.deepEqual(calls, ['action']);
  });
});
