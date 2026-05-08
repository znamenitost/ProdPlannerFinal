// ./frontend/src/hooks/useExpandedRows.js
import { useState, useCallback } from 'react';

export default function useExpandedRows() {
  const [expandedRows, setExpandedRows] = useState(new Set());

  const toggleExpand = useCallback((rowId) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(rowId)) {
        newSet.delete(rowId);
      } else {
        newSet.add(rowId);
      }
      return newSet;
    });
  }, []);

  const isExpanded = useCallback((rowId) => expandedRows.has(rowId), [expandedRows]);

  const expandAll = useCallback((rowIds) => {
    setExpandedRows(new Set(rowIds));
  }, []);

  const collapseAll = useCallback(() => {
    setExpandedRows(new Set());
  }, []);

  return {
    expandedRows,
    toggleExpand,
    isExpanded,
    expandAll,
    collapseAll
  };
}