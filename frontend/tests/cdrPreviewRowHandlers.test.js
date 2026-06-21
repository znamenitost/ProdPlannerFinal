import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getCdrPreviewRowHandlers,
  isCdrPreviewSecondaryClick
} from '../src/utils/cdrPreviewRowHandlers.js';

describe('cdrPreviewRowHandlers', () => {
  it('detects secondary click and ctrl+click', () => {
    assert.equal(isCdrPreviewSecondaryClick({ button: 2 }), true);
    assert.equal(isCdrPreviewSecondaryClick({ button: 0, ctrlKey: true }), true);
    assert.equal(isCdrPreviewSecondaryClick({ button: 0, ctrlKey: false }), false);
    assert.equal(isCdrPreviewSecondaryClick({ button: 1 }), false);
  });

  it('returns handlers when preview is enabled', () => {
    const calls = [];
    const handlers = getCdrPreviewRowHandlers({
      task: { id: 1 },
      onShowCdrPreview: (...args) => calls.push(args)
    });

    assert.equal(typeof handlers.onPointerDownCapture, 'function');
    assert.equal(typeof handlers.onContextMenu, 'function');
    assert.equal(handlers.onMouseEnter, undefined);

    handlers.onPointerDownCapture({
      button: 2,
      clientX: 10,
      clientY: 20,
      preventDefault() {}
    });
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0][1], { x: 10, y: 20 });

    handlers.onContextMenu({
      clientX: 10,
      clientY: 20,
      preventDefault() {}
    });
    assert.equal(calls.length, 1);
  });

  it('opens preview on ctrl+click', () => {
    const calls = [];
    const handlers = getCdrPreviewRowHandlers({
      task: { id: 2 },
      onShowCdrPreview: (...args) => calls.push(args)
    });

    handlers.onPointerDownCapture({
      button: 0,
      ctrlKey: true,
      clientX: 5,
      clientY: 6,
      preventDefault() {}
    });
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0][1], { x: 5, y: 6 });
  });

  it('returns empty object when preview disabled', () => {
    assert.deepEqual(getCdrPreviewRowHandlers({ task: { id: 1 } }), {});
  });
});
