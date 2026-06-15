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
    api,
    selectedEmployeeForHighlight,
    patchRow,
    removeRow,
    patchChildInCache,
    setChildrenForParent,
    loadChildrenForParent
  } = ctx;

  const employee = selectedEmployeeForHighlight || '';

  const isNotFound = (err) => err?.status === 404 || String(err?.message || '').includes('"status":404');

  if (type === 'TaskDeleted') {
    if (rows.some((r) => r.id === taskId)) {
      removeRow(taskId);
      return true;
    }

    for (const [parentId, children] of childrenCache.entries()) {
      if (children.some((c) => c.id === taskId)) {
        const kids = await loadChildrenForParent(parentId, { force: true });
        setChildrenForParent(parentId, kids);
        try {
          const parentDto = await api.fetchTableRow(parentId, employee);
          patchRow(parentId, parentDto);
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
      const updated = await api.fetchTableRow(taskId, employee);
      if (!updated) return false;

      const parentId = updated.parentRowNumber;

      if (parentId) {
        if (childrenCache.has(parentId)) {
          patchChildInCache(taskId, updated);
        }
        if (rows.some((r) => r.id === parentId)) {
          const parentDto = await api.fetchTableRow(parentId, employee);
          if (parentDto) patchRow(parentId, parentDto);
          return true;
        }
        return false;
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
          const kids = await loadChildrenForParent(parentId, { force: true });
          setChildrenForParent(parentId, kids);
          try {
            const parentDto = await api.fetchTableRow(parentId, employee);
            patchRow(parentId, parentDto);
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
