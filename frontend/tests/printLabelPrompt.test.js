import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  canPrintOrderLabel,
  resolvePrintLabelTaskAfterReady
} from '../src/utils/printLabelTask.js';

describe('canPrintOrderLabel', () => {
  it('allows a standalone task', () => {
    assert.equal(canPrintOrderLabel({ id: 1, isFuss: false }), true);
  });

  it('blocks split children', () => {
    assert.equal(canPrintOrderLabel({
      id: 2,
      isSplitTask: true,
      parentRowNumber: 1
    }), false);
  });

  it('allows a split parent', () => {
    assert.equal(canPrintOrderLabel({
      id: 1,
      isSplitTask: true,
      parentRowNumber: null
    }), true);
  });
});

describe('resolvePrintLabelTaskAfterReady', () => {
  it('prints the completed standalone task', () => {
    const task = { id: 5, statusText: 'Готово' };
    assert.equal(resolvePrintLabelTaskAfterReady(task), task);
  });

  it('does not print a split child while siblings are still open', () => {
    const child = { id: 2, isSplitTask: true, parentRowNumber: 1 };
    const parent = { id: 1, isSplitTask: true, parentRowNumber: null, statusText: 'Начал' };
    assert.equal(resolvePrintLabelTaskAfterReady(child, parent), null);
  });

  it('prints the parent after the last child completes the order', () => {
    const child = { id: 2, isSplitTask: true, parentRowNumber: 1, statusText: 'Готово' };
    const parent = { id: 1, isSplitTask: true, parentRowNumber: null, statusText: 'Готово' };
    assert.equal(resolvePrintLabelTaskAfterReady(child, parent), parent);
  });
});
