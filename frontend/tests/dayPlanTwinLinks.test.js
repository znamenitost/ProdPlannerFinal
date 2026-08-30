import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  collectTwinGroupIds,
  collectTwinPairs,
  isTwinGroupHighlighted,
  splitGroupId,
  twinLinkPath
} from '../src/utils/dayPlanTwinLinks.js';

describe('splitGroupId', () => {
  it('normalizes string and number parent ids', () => {
    assert.equal(splitGroupId({ parentRowNumber: 10 }), 10);
    assert.equal(splitGroupId({ parentRowNumber: '10' }), 10);
    assert.equal(splitGroupId({ ParentRowNumber: 10 }), 10);
    assert.equal(splitGroupId({ parentRowNumber: 0 }), null);
    assert.equal(splitGroupId({ parentRowNumber: null }), null);
  });
});

describe('collectTwinGroupIds', () => {
  it('keeps groups that appear on both plans', () => {
    const twins = collectTwinGroupIds(
      { waves: [{ blocks: [{ task: { parentRowNumber: '10' } }] }], unplanned: [] },
      { waves: [{ blocks: [{ task: { parentRowNumber: 10 } }] }], unplanned: [{ parentRowNumber: 11 }] }
    );
    assert.equal(twins.size, 1);
    assert.equal(twins.has(10), true);
  });
});

describe('isTwinGroupHighlighted', () => {
  it('highlights a twin when showAll is on', () => {
    assert.equal(
      isTwinGroupHighlighted(
        { parentRowNumber: '10' },
        { activeGroupId: null, twinGroupIds: new Set([10]), showAll: true }
      ),
      true
    );
  });

  it('matches hovered group even when types differ', () => {
    assert.equal(
      isTwinGroupHighlighted(
        { parentRowNumber: 10 },
        { activeGroupId: '10', twinGroupIds: new Set(), showAll: false }
      ),
      true
    );
  });
});

describe('collectTwinPairs', () => {
  it('pairs the same group across different boards even when ids are strings', () => {
    const pairs = collectTwinPairs([
      { group: '10', board: 'main', taskId: 1, x: 0, y: 0, w: 100, h: 60 },
      { group: 10, board: 'compare', taskId: 2, x: 400, y: 120, w: 100, h: 60 }
    ]);

    assert.equal(pairs.length, 1);
    assert.equal(pairs[0].group, 10);
  });

  it('ignores groups that live on a single board', () => {
    const pairs = collectTwinPairs([
      { group: 10, board: 'main', taskId: 1, x: 0, y: 0, w: 100, h: 60 },
      { group: 10, board: 'main', taskId: 2, x: 0, y: 200, w: 100, h: 60 },
      { group: 11, board: 'main', taskId: 3, x: 0, y: 400, w: 100, h: 60 }
    ]);

    assert.equal(pairs.length, 0);
  });

  it('skips nodes without a group or board', () => {
    const pairs = collectTwinPairs([
      { group: null, board: 'main', taskId: 1, x: 0, y: 0, w: 100, h: 60 },
      { group: 10, board: '', taskId: 2, x: 400, y: 0, w: 100, h: 60 }
    ]);

    assert.equal(pairs.length, 0);
  });
});

describe('twinLinkPath', () => {
  it('draws from the right edge of the left card to the left edge of the right card', () => {
    const from = { x: 0, y: 0, w: 100, h: 60 };
    const to = { x: 400, y: 120, w: 100, h: 60 };

    const d = twinLinkPath(from, to);
    assert.match(d, /^M 100 30 C /);
    assert.match(d, / 400 150$/);
  });

  it('reverses edges when the target is on the left', () => {
    const from = { x: 400, y: 120, w: 100, h: 60 };
    const to = { x: 0, y: 0, w: 100, h: 60 };

    const d = twinLinkPath(from, to);
    assert.match(d, /^M 400 150 C /);
    assert.match(d, / 100 30$/);
  });
});
