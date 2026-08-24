import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getCdrPreviewRowHandlers,
  isCdrPreviewSecondaryClick,
  resolveCdrPreviewSourceTask
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

  it('uses an explicit parent task as the preview source', () => {
    const calls = [];
    const child = { id: 2 };
    const parent = { id: 1, hasCdrPreview: true };
    const handlers = getCdrPreviewRowHandlers({
      task: child,
      previewTask: parent,
      onShowCdrPreview: (...args) => calls.push(args)
    });

    handlers.onContextMenu({
      clientX: 7,
      clientY: 8,
      preventDefault() {}
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], parent);
    assert.deepEqual(calls[0][1], { x: 7, y: 8 });
  });

  it('resolves split-child preview to the parent when the parent has it', () => {
    const child = { id: 2, hasCdrPreview: false };
    const parent = { id: 1, hasCdrPreview: true };
    assert.equal(resolveCdrPreviewSourceTask(child, parent), parent);
  });

  it('keeps the child as preview source when only the child has a stored preview', () => {
    const child = { id: 2, hasCdrPreview: true };
    const parent = { id: 1, hasCdrPreview: false };
    assert.equal(resolveCdrPreviewSourceTask(child, parent), child);
  });

  it('returns empty object when preview disabled', () => {
    assert.deepEqual(getCdrPreviewRowHandlers({ task: { id: 1 } }), {});
  });
});
