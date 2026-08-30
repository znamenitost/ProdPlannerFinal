import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getDayPlanCardWorkflow } from '../src/utils/dayPlanCardWorkflow.js';

describe('getDayPlanCardWorkflow', () => {
  it('shows start and disabled complete for an assigned task', () => {
    const flow = getDayPlanCardWorkflow({ statusText: 'Назначена' });
    assert.equal(flow.visible, true);
    assert.equal(flow.primaryAction, 'start');
    assert.equal(flow.primaryEnabled, true);
    assert.equal(flow.canComplete, false);
  });

  it('swaps start for pause while in progress', () => {
    const flow = getDayPlanCardWorkflow({ statusText: 'Начал' });
    assert.equal(flow.primaryAction, 'pause');
    assert.equal(flow.primaryLabel, 'Пауза');
    assert.equal(flow.primaryEnabled, true);
    assert.equal(flow.canComplete, true);
  });

  it('resumes from pause and still allows complete', () => {
    const flow = getDayPlanCardWorkflow({ statusText: 'Пауза' });
    assert.equal(flow.primaryAction, 'resume');
    assert.equal(flow.primaryLabel, 'Продолжить');
    assert.equal(flow.canComplete, true);
  });

  it('hides the bar when the task is already done', () => {
    const flow = getDayPlanCardWorkflow({ statusText: 'Готово' });
    assert.equal(flow.visible, false);
  });

  it('disables actions for waiting and info statuses', () => {
    const waiting = getDayPlanCardWorkflow({ statusText: 'Ожидание', sequenceStartBlocked: true });
    assert.equal(waiting.primaryEnabled, false);
    assert.equal(waiting.canComplete, false);
    assert.match(waiting.blockedReason, /этап/i);

    const info = getDayPlanCardWorkflow({ statusText: 'Согласование' });
    assert.equal(info.primaryEnabled, false);
    assert.equal(info.blockedReason, 'Согласование');
  });
});
