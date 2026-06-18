import test from 'node:test';
import assert from 'node:assert/strict';
import { handleTaskTableHubEvent } from '../src/utils/taskTableHubHandler.js';

function createCtx(overrides = {}) {
  const rows = overrides.rows ?? [{ id: 10, statusText: 'Начал' }];
  const childrenCache = overrides.childrenCache ?? new Map();
  const expandedRows = overrides.expandedRows ?? new Set();
  const patchRowCalls = [];
  const setChildrenCalls = [];
  const loadChildrenCalls = [];

  const api = {
    fetchTableRow: overrides.fetchTableRow ?? (async (id) => {
      if (id === 101) {
        return {
          id: 101,
          parentRowNumber: 10,
          statusText: 'Готово',
          updatedAt: '2026-06-18T12:00:00Z'
        };
      }
      if (id === 10) {
        return {
          id: 10,
          parentRowNumber: null,
          statusText: 'Начал',
          updatedAt: '2026-06-18T12:00:01Z',
          isSplitTask: true
        };
      }
      return null;
    }),
    ...overrides.api
  };

  const ctx = {
    rows,
    childrenCache,
    expandedRows,
    api,
    selectedEmployeeForHighlight: '',
    patchRow: (id, patch) => {
      patchRowCalls.push({ id, patch });
    },
    removeRow: () => {},
    setChildrenForParent: (parentId, children) => {
      setChildrenCalls.push({ parentId, children });
    },
    loadChildrenForParent: async (parentId, options = {}) => {
      loadChildrenCalls.push({ parentId, options });
      return overrides.loadedChildren ?? [
        { id: 101, statusText: 'Готово', updatedAt: '2026-06-18T12:00:00Z' }
      ];
    },
    ...overrides.ctx
  };

  return { ctx, patchRowCalls, setChildrenCalls, loadChildrenCalls };
}

test('handleTaskTableHubEvent reloads expanded children and patches parent on child status change', async () => {
  const childrenCache = new Map([
    [10, [{ id: 101, statusText: 'Начал', updatedAt: '2026-06-18T11:00:00Z' }]]
  ]);
  const { ctx, patchRowCalls, setChildrenCalls, loadChildrenCalls } = createCtx({ childrenCache });

  const handled = await handleTaskTableHubEvent(
    { type: 'TaskStatusChanged', taskId: 101 },
    ctx
  );

  assert.equal(handled, true);
  assert.equal(loadChildrenCalls.length, 1);
  assert.equal(loadChildrenCalls[0].parentId, 10);
  assert.equal(loadChildrenCalls[0].options.force, true);
  assert.equal(setChildrenCalls.length, 1);
  assert.equal(patchRowCalls.length, 1);
  assert.equal(patchRowCalls[0].id, 10);
});

test('handleTaskTableHubEvent reloads children when parent is expanded even without cache', async () => {
  const expandedRows = new Set([10]);
  const { ctx, loadChildrenCalls } = createCtx({ expandedRows });

  const handled = await handleTaskTableHubEvent(
    { type: 'TaskStatusChanged', taskId: 101 },
    ctx
  );

  assert.equal(handled, true);
  assert.equal(loadChildrenCalls.length, 1);
  assert.equal(loadChildrenCalls[0].parentId, 10);
});

test('handleTaskTableHubEvent patches root row when task is visible', async () => {
  const { ctx, patchRowCalls, loadChildrenCalls } = createCtx({
    rows: [{ id: 55, statusText: 'Начал' }],
    api: {
      fetchTableRow: async (id) => ({
        id,
        parentRowNumber: null,
        statusText: 'Готово',
        updatedAt: '2026-06-18T12:00:00Z'
      })
    }
  });

  const handled = await handleTaskTableHubEvent(
    { type: 'TaskStatusChanged', taskId: 55 },
    ctx
  );

  assert.equal(handled, true);
  assert.equal(loadChildrenCalls.length, 0);
  assert.equal(patchRowCalls.length, 1);
  assert.equal(patchRowCalls[0].id, 55);
  assert.equal(patchRowCalls[0].patch.statusText, 'Готово');
});
