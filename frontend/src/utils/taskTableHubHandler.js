/**
 * Narrow table update from SignalR (no loadRows).
 * @returns {Promise<boolean>} true if the table was patched locally
 */
export async function handleTaskTableHubEvent(event, ctx) {
  const taskId = Number(event.taskId);
  if (!Number.isFinite(taskId)) return false;

  const { type } = event;
  const {
    rows,
    childrenCache,
    expandedRows,
    api,
    patchRow,
    removeRow,
    setChildrenForParent,
    loadChildrenForParent
  } = ctx;

  const isNotFound = (err) => err?.status === 404 || String(err?.message || '').includes('"status":404');

  const refreshSplitChildren = async (parentId) => {
    const kids = await loadChildrenForParent(parentId, { force: true });
    setChildrenForParent(parentId, kids);
    return kids;
  };

  const shouldReloadChildren = (parentId) =>
    childrenCache.has(parentId) || expandedRows?.has(parentId);

  const patchParentIfVisible = async (parentId) => {
    if (!rows.some((r) => r.id === parentId)) return false;
    // Live table updates should not depend on the selected employee filter.
    // Otherwise events for other employees can be dropped by backend filtering.
    const parentDto = await api.fetchTableRow(parentId);
    if (parentDto) patchRow(parentId, parentDto);
    return true;
  };

  if (type === 'TaskDeleted') {
    if (rows.some((r) => r.id === taskId)) {
      removeRow(taskId);
      return true;
    }

    for (const [parentId, children] of childrenCache.entries()) {
      if (children.some((c) => c.id === taskId)) {
        await refreshSplitChildren(parentId);
        try {
          await patchParentIfVisible(parentId);
        } catch (err) {
          if (isNotFound(err)) {
            removeRow(parentId);
          } else {
            throw err;
          }
        }
        return true;
      }
    }

    return false;
  }

  if (type === 'TaskStatusChanged' || type === 'TaskProgressChanged' || type === 'TaskUpdated') {
    try {
      const badgeDelta = Number(event.commentBadgeDelta) || 0;
      if (badgeDelta > 0 && rows.some((r) => r.id === taskId)) {
        const current = rows.find((r) => r.id === taskId);
        patchRow(taskId, {
          commentBadgeCount: Math.max(0, Number(current?.commentBadgeCount) || 0) + badgeDelta
        });
      }

      const updated = await api.fetchTableRow(taskId);
      if (!updated) return false;

      const parentId = updated.parentRowNumber;

      if (parentId) {
        if (shouldReloadChildren(parentId)) {
          await refreshSplitChildren(parentId);
        }
        return await patchParentIfVisible(parentId);
      }

      if (rows.some((r) => r.id === taskId)) {
        patchRow(taskId, updated);
        return true;
      }

      return false;
    } catch (err) {
      if (isNotFound(err)) {
        let parentId = null;
        for (const [candidateParentId, children] of childrenCache.entries()) {
          if (children.some((c) => c.id === taskId)) {
            parentId = candidateParentId;
            break;
          }
        }

        if (parentId) {
          await refreshSplitChildren(parentId);
          try {
            await patchParentIfVisible(parentId);
          } catch (parentErr) {
            if (isNotFound(parentErr)) {
              removeRow(parentId);
            } else {
              throw parentErr;
            }
          }
        } else {
          removeRow(taskId);
        }
        return true;
      }
      console.error('Hub table patch failed:', err);
      return false;
    }
  }

  return false;
}
