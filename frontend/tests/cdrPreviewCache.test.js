import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_CDR_PREVIEW_ENTRIES,
  clearCdrPreviewMemoryForTests,
  getCdrPreviewMemorySizeForTests,
  getTaskCdrPreview,
  setTaskCdrPreview
} from '../src/utils/cdrPreviewCache.js';

describe('cdrPreviewCache eviction', () => {
  beforeEach(() => {
    clearCdrPreviewMemoryForTests();
  });

  it('evicts oldest in-memory entries past the cap', async () => {
    for (let i = 1; i <= MAX_CDR_PREVIEW_ENTRIES + 5; i += 1) {
      await setTaskCdrPreview(i, {
        url: `data:image/png;base64,AAA${i}`,
        path: `/files/task-${i}.cdr`,
        method: 'test'
      });
    }

    assert.equal(getCdrPreviewMemorySizeForTests(), MAX_CDR_PREVIEW_ENTRIES);
    assert.equal(getTaskCdrPreview(1), null);
    assert.ok(getTaskCdrPreview(MAX_CDR_PREVIEW_ENTRIES + 5));
  });

  it('keeps recently accessed entries when newer ones arrive', async () => {
    for (let i = 1; i <= MAX_CDR_PREVIEW_ENTRIES; i += 1) {
      await setTaskCdrPreview(i, {
        url: `data:image/png;base64,BBB${i}`,
        path: `/files/keep-${i}.cdr`,
        method: 'test'
      });
    }

    assert.ok(getTaskCdrPreview(1));

    await setTaskCdrPreview(MAX_CDR_PREVIEW_ENTRIES + 1, {
      url: 'data:image/png;base64,NEWER',
      path: '/files/newer.cdr',
      method: 'test'
    });

    assert.ok(getTaskCdrPreview(1));
    assert.equal(getTaskCdrPreview(2), null);
    assert.equal(getCdrPreviewMemorySizeForTests(), MAX_CDR_PREVIEW_ENTRIES);
  });
});
