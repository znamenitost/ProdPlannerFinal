import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getCdrPreviewRowHandlers } from '../src/utils/cdrPreviewRowHandlers.js';

describe('cdrPreviewRowHandlers', () => {
  it('returns handlers when preview is enabled', () => {
    const calls = [];
    const handlers = getCdrPreviewRowHandlers({
      task: { id: 1 },
      onShowCdrPreview: (...args) => calls.push(args),
      onPrefetchCdrPreview: () => calls.push(['prefetch'])
    });

    assert.equal(typeof handlers.onPointerDownCapture, 'function');
    assert.equal(typeof handlers.onMouseEnter, 'function');

    handlers.onPointerDownCapture({
      button: 2,
      clientX: 10,
      clientY: 20,
      preventDefault() {}
    });
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0][1], { x: 10, y: 20 });
  });

  it('returns empty object when preview disabled', () => {
    assert.deepEqual(getCdrPreviewRowHandlers({ task: { id: 1 } }), {});
  });
});
