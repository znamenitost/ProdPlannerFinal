import { useState, useCallback, useRef } from 'react';

export default function useTaskTableChildren(api) {
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [childrenCache, setChildrenCache] = useState(new Map());
  const [loadingChildren, setLoadingChildren] = useState(new Set());
  const expandedRowsRef = useRef(expandedRows);
  const childrenCacheRef = useRef(childrenCache);
  const loadingChildrenRef = useRef(loadingChildren);
  expandedRowsRef.current = expandedRows;
  childrenCacheRef.current = childrenCache;
  loadingChildrenRef.current = loadingChildren;

  const loadChildrenForParent = useCallback(async (parentId, { force = false } = {}) => {
    if (!force && childrenCacheRef.current.has(parentId)) {
      return childrenCacheRef.current.get(parentId);
    }
    if (!force && loadingChildrenRef.current.has(parentId)) return;

    setLoadingChildren((prev) => new Set(prev).add(parentId));
    try {
      const children = await api.loadChildren(parentId);
      setChildrenCache((prev) => new Map(prev).set(parentId, children));
      return children;
    } catch (err) {
      console.error('Ошибка загрузки детей', err);
      return [];
    } finally {
      setLoadingChildren((prev) => {
        const newSet = new Set(prev);
        newSet.delete(parentId);
        return newSet;
      });
    }
  }, [api]);

  const refreshChildren = useCallback(async (parentId) => {
    if (expandedRowsRef.current.has(parentId)) {
      setLoadingChildren((prev) => new Set(prev).add(parentId));
      try {
        const children = await api.loadChildren(parentId);
        setChildrenCache((prev) => new Map(prev).set(parentId, children));
      } catch (err) {
        console.error('Ошибка обновления детей', err);
      } finally {
        setLoadingChildren((prev) => {
          const newSet = new Set(prev);
          newSet.delete(parentId);
          return newSet;
        });
      }
    } else {
      setChildrenCache((prev) => {
        const newMap = new Map(prev);
        newMap.delete(parentId);
        return newMap;
      });
    }
  }, [api]);

  const refreshExpandedChildren = useCallback(async () => {
    const parents = [...expandedRowsRef.current];
    if (parents.length === 0) return;

    await Promise.all(
      parents.map(async (parentId) => {
        try {
          const children = await api.loadChildren(parentId);
          setChildrenCache((prev) => new Map(prev).set(parentId, children));
        } catch (err) {
          console.error('Ошибка обновления дочерних задач', err);
        }
      })
    );
  }, [api]);

  const toggleExpand = useCallback(async (parentId) => {
    if (expandedRowsRef.current.has(parentId)) {
      setExpandedRows((prev) => {
        const newSet = new Set(prev);
        newSet.delete(parentId);
        return newSet;
      });
      return;
    }

    await loadChildrenForParent(parentId, { force: true });
    setExpandedRows((prev) => new Set(prev).add(parentId));
  }, [loadChildrenForParent]);

  const setChildrenForParent = useCallback((parentId, children) => {
    setChildrenCache((prev) => new Map(prev).set(parentId, children));
  }, []);

  const clearChildrenCache = useCallback((parentId) => {
    setChildrenCache((prev) => {
      const next = new Map(prev);
      next.delete(parentId);
      return next;
    });
  }, []);

  const expandParent = useCallback((parentId) => {
    setExpandedRows((prev) => new Set(prev).add(parentId));
  }, []);

  const patchChildInCache = useCallback((childId, patch) => {
    setChildrenCache((prev) => {
      const next = new Map(prev);
      for (const [parentId, children] of next.entries()) {
        const index = children.findIndex((c) => c.id === childId);
        if (index >= 0) {
          const updated = children.slice();
          updated[index] = { ...updated[index], ...patch };
          next.set(parentId, updated);
          break;
        }
      }
      return next;
    });
  }, []);

  const invalidateChildCache = clearChildrenCache;

  return {
    expandedRows,
    childrenCache,
    toggleExpand,
    loadChildrenForParent,
    refreshChildren,
    refreshExpandedChildren,
    setChildrenForParent,
    clearChildrenCache,
    invalidateChildCache,
    expandParent,
    patchChildInCache
  };
}
