import { useState, useCallback } from 'react';

export default function useTaskTableChildren(api) {
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [childrenCache, setChildrenCache] = useState(new Map());
  const [loadingChildren, setLoadingChildren] = useState(new Set());

  const loadChildrenForParent = useCallback(async (parentId) => {
    if (childrenCache.has(parentId)) return childrenCache.get(parentId);
    if (loadingChildren.has(parentId)) return;

    setLoadingChildren(prev => new Set(prev).add(parentId));
    try {
      const children = await api.loadChildren(parentId);
      setChildrenCache(prev => new Map(prev).set(parentId, children));
      return children;
    } catch (err) {
      console.error('Ошибка загрузки детей', err);
      return [];
    } finally {
      setLoadingChildren(prev => {
        const newSet = new Set(prev);
        newSet.delete(parentId);
        return newSet;
      });
    }
  }, [api, childrenCache, loadingChildren]);

  const refreshChildren = useCallback(async (parentId) => {
    if (expandedRows.has(parentId)) {
      setLoadingChildren(prev => new Set(prev).add(parentId));
      try {
        const children = await api.loadChildren(parentId);
        setChildrenCache(prev => new Map(prev).set(parentId, children));
      } catch (err) {
        console.error('Ошибка обновления детей', err);
      } finally {
        setLoadingChildren(prev => {
          const newSet = new Set(prev);
          newSet.delete(parentId);
          return newSet;
        });
      }
    } else {
      setChildrenCache(prev => {
        const newMap = new Map(prev);
        newMap.delete(parentId);
        return newMap;
      });
    }
  }, [expandedRows, api]);

  const toggleExpand = async (parentId) => {
    if (expandedRows.has(parentId)) {
      setExpandedRows(prev => {
        const newSet = new Set(prev);
        newSet.delete(parentId);
        return newSet;
      });
    } else {
      await loadChildrenForParent(parentId);
      setExpandedRows(prev => new Set(prev).add(parentId));
    }
  };

  const setChildrenForParent = useCallback((parentId, children) => {
    setChildrenCache(prev => new Map(prev).set(parentId, children));
  }, []);

  const clearChildrenCache = useCallback((parentId) => {
    setChildrenCache(prev => {
      const next = new Map(prev);
      next.delete(parentId);
      return next;
    });
  }, []);

  const expandParent = useCallback((parentId) => {
    setExpandedRows(prev => new Set(prev).add(parentId));
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

  return {
    expandedRows,
    childrenCache,
    toggleExpand,
    loadChildrenForParent,
    refreshChildren,
    setChildrenForParent,
    clearChildrenCache,
    expandParent,
    patchChildInCache
  };
}
