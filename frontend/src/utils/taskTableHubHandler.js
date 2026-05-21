/**
 * Narrow table update from SignalR (no loadRows).
 * @returns {Promise<boolean>} true if the table was patched locally
 */
export async function handleTaskTableHubEvent(event, ctx) {
  const { type, taskId } = event;
  const {
    rows,
    childrenCache,
    api,
    selectedEmployeeForHighlight,
    patchRow,
    removeRow,
    invalidateChildCache,
    setChildrenForParent,
    loadChildrenForParent
  } = ctx;

  if (taskId == null) return false;

  const employee = selectedEmployeeForHighlight || '';

  if (type === 'TaskDeleted') {
    if (rows.some((r) => r.id === taskId)) {
      removeRow(taskId);
      return true;
    }

    for (const [parentId, children] of childrenCache.entries()) {
      if (children.some((c) => c.id === taskId)) {
        invalidateChildCache(parentId);
        const kids = await loadChildrenForParent(parentId);
        setChildrenForParent(parentId, kids);
        const parentDto = await api.fetchTableRow(parentId, employee);
        patchRow(parentId, parentDto);
        return true;
      }
    }

    return false;
  }

  if (type === 'TaskStatusChanged' || type === 'TaskProgressChanged' || type === 'TaskUpdated') {
    if (rows.some((r) => r.id === taskId)) {
      const updated = await api.fetchTableRow(taskId, employee);
      patchRow(taskId, updated);
      return true;
    }

    for (const [parentId, children] of childrenCache.entries()) {
      if (children.some((c) => c.id === taskId)) {
        invalidateChildCache(parentId);
        const kids = await loadChildrenForParent(parentId);
        setChildrenForParent(parentId, kids);
        const parentDto = await api.fetchTableRow(parentId, employee);
        patchRow(parentId, parentDto);
        return true;
      }
    }

    return false;
  }

  return false;
}
