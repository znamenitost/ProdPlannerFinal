import {
  Box,
  Pagination,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableRow,
  Typography,
} from '@mui/material';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import SplitTaskModal from './SplitTaskModal';
import TaskTableHead from './TaskTableHead';
import NewTaskRow from './NewTaskRow';
import EditTaskRow from './EditTaskRow';
import ParentTaskRow from './ParentTaskRow';
import TaskTableToolbar from './TaskTableToolbar';
import CommentDialog from './CommentDialog';
import CdrPreviewDialog from './CdrPreviewDialog';
import TaskIntervalsDialog from './taskTable/TaskIntervalsDialog';
import CustomLabelsDialog from './taskTable/CustomLabelsDialog';
import { DEV_CDR_PREVIEW_ENABLED, formatDevTaskFilePath } from '../utils/devCdrPreviewConfig';
import PlanningWarningsBanner from './PlanningWarningsBanner';
import useTaskTableController from '../hooks/taskTable/useTaskTableController';
import useTaskTableColumnVisibility from '../hooks/taskTable/useTaskTableColumnVisibility';
import { TextLimitProvider } from '../context/TextLimitContext';
import { isFinishedStatusText } from '../constants/taskStatuses';
import { taskTableColumnCount } from '../utils/taskTableColumns';
import { buildTaskTableSearchResult } from '../utils/taskTableSearch';
import { COL_ACTIONS, COL_ACTIONS_DUAL } from '../utils/taskTableStyles';
import { hasPlannedProgressFooter } from '../utils/taskTablePlannedProgress';
import useTaskTablePlannedProgressPreference from '../hooks/taskTable/useTaskTablePlannedProgressPreference';
import useTaskTablePlannedProgressPolling from '../hooks/taskTable/useTaskTablePlannedProgressPolling';
import useTaskTableSortSettings from '../hooks/taskTable/useTaskTableSortSettings';
import useUserPreference from '../hooks/useUserPreference';
import useCdrPreviewAutoSearchSettings from '../hooks/useCdrPreviewAutoSearchSettings';
import { useUiFeedback } from '../context/UiFeedbackContext';
import { issuePickupOrder } from '../services/api';
import { comparePickupRows, normalizePickupQuery } from '../utils/pickupMode';

const ROW_GROUP_BASE_HEIGHT = 44;
const ROW_PROGRESS_HEIGHT = 6;
const EDIT_ROW_HEIGHT = 72;
const VIRTUAL_OVERSCAN = 15;
const TEXT_LIMIT_MEASURE_DEBOUNCE_MS = 200;
/** Игнор субпиксельного шума при пересчёте offset таблицы в документе. */
const SCROLL_MARGIN_EPSILON_PX = 1;

function isCompletedRow(row) {
  if (row?.isFuss) return false;
  return isFinishedStatusText(row?.statusText) || row?.status === 3;
}

function getDeadlineSortValue(row) {
  if (!row?.deadline) return Number.POSITIVE_INFINITY;
  const value = new Date(row.deadline).getTime();
  return Number.isNaN(value) ? Number.POSITIVE_INFINITY : value;
}

function compareTaskRows(a, b, { completedBottomSort, deadlineSort }) {
  if (completedBottomSort) {
    const completedDiff = Number(isCompletedRow(a)) - Number(isCompletedRow(b));
    if (completedDiff) return completedDiff;
  }
  if (deadlineSort) {
    return getDeadlineSortValue(a) - getDeadlineSortValue(b);
  }
  return 0;
}

function sortRowsWithStableOrder(rows, sortOptions) {
  return rows
    .map((row, index) => ({ row, index }))
    .sort((a, b) => compareTaskRows(a.row, b.row, sortOptions) || a.index - b.index)
    .map(({ row }) => row);
}

function filterCompletedRows(rows, hideCompleted) {
  if (!hideCompleted) return rows;
  return rows.filter((row) => !isCompletedRow(row));
}

function prepareParentChildren({
  parent,
  childrenCache,
  sortOptions,
  allowedChildIds,
  hideCompletedInSharedSort
}) {
  let children = sortRowsWithStableOrder(childrenCache.get(parent.id) || [], sortOptions);
  if (allowedChildIds) {
    children = children.filter((child) => allowedChildIds.has(child.id));
  }
  if (hideCompletedInSharedSort && parent.isSplitTask && !isCompletedRow(parent)) {
    children = children.filter((child) => !isCompletedRow(child));
  }
  return children;
}

function hasProgressFooter(row, showPlannedProgressEnabled) {
  return hasPlannedProgressFooter(row, showPlannedProgressEnabled);
}

function VirtualPaddingRow({ height, colSpan }) {
  if (height <= 0) return null;

  return (
    <TableRow aria-hidden="true">
      <TableCell
        colSpan={colSpan}
        sx={{ p: 0, border: 0, height, lineHeight: 0 }}
      />
    </TableRow>
  );
}

export default function TaskTable({
  onCalendarRefresh,
  onRegisterHubHandler,
  userRole,
  currentUser,
  selectedEmployeeForHighlight,
  maxSubscribedTaskIds = [],
  maxCanSubscribe = false,
  onMaxSubscribeToggle,
  focusCommentTooltipTaskId = null,
  onFocusCommentTooltipConsumed,
  onOpenFileOpenSettings,
  onOpenTaskTypeStats,
  taskTypeStatsOpen = false,
  mode = 'production'
}) {
  const isAdmin = userRole === 'Admin';
  const tableContainerRef = useRef(null);
  /** Контент над таблицей (баннер/тулбар) — только он двигает scrollMargin. */
  const aboveTableRef = useRef(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  const autoSearchSettings = useCdrPreviewAutoSearchSettings(isAdmin ? currentUser : null);
  const columnSettings = useTaskTableColumnVisibility(currentUser);
  const plannedProgressPref = useTaskTablePlannedProgressPreference(currentUser);
  const showPlannedProgress = isAdmin && plannedProgressPref.showPlannedProgress;
  const {
    deadlineSort,
    setDeadlineSort,
    completedBottomSort,
    setCompletedBottomSort,
    hideCompletedSort,
    setHideCompletedSort,
    hideCompletedInSharedSort,
    setHideCompletedInSharedSort,
    showFuss,
    setShowFuss
  } = useTaskTableSortSettings(currentUser);
  const { showError, showSuccess } = useUiFeedback();
  const pickupMode = isAdmin && mode === 'pickup';
  const [productionSearchQuery, setProductionSearchQuery] = useUserPreference(currentUser, 'taskTable.searchQuery', '');
  const [pickupSearchQuery, setPickupSearchQuery] = useUserPreference(currentUser, 'taskTable.pickupSearchQuery', '');
  const searchQuery = pickupMode ? pickupSearchQuery : productionSearchQuery;
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery);
  const prevPickupModeRef = useRef(pickupMode);
  const [issuingPickupTaskId, setIssuingPickupTaskId] = useState(null);
  const [customLabelsOpen, setCustomLabelsOpen] = useState(false);
  const excludeCompletedFromApi = !pickupMode && hideCompletedSort && !debouncedSearchQuery.trim();
  const table = useTaskTableController({
    onCalendarRefresh,
    onRegisterHubHandler,
    selectedEmployeeForHighlight,
    excludeCompleted: excludeCompletedFromApi,
    searchQuery: debouncedSearchQuery,
    showFuss: isAdmin && !pickupMode ? showFuss : false,
    pickupMode
  });
  const sortOptions = useMemo(
    () => ({ deadlineSort, completedBottomSort }),
    [deadlineSort, completedBottomSort]
  );

  useEffect(() => {
    const modeChanged = prevPickupModeRef.current !== pickupMode;
    prevPickupModeRef.current = pickupMode;
    const timer = window.setTimeout(
      () => setDebouncedSearchQuery(searchQuery),
      modeChanged ? 0 : 300
    );
    return () => window.clearTimeout(timer);
  }, [searchQuery, pickupMode]);

  const handleSearchQueryChange = useCallback(
    (value) => {
      if (pickupMode) {
        setPickupSearchQuery(normalizePickupQuery(value));
      } else {
        setProductionSearchQuery(value);
      }
    },
    [pickupMode, setPickupSearchQuery, setProductionSearchQuery]
  );

  const handleIssueOrder = useCallback(
    async (task) => {
      if (!task?.id || issuingPickupTaskId) return;
      setIssuingPickupTaskId(task.id);
      try {
        await issuePickupOrder(task.id);
        const fresh = await table.api.fetchTableRow(task.id);
        if (fresh) table.patchRow(task.id, fresh);
        showSuccess(`Заказ ${task.pickupCode || ''} выдан`);
      } catch (err) {
        showError(err?.message || 'Не удалось выдать заказ');
      } finally {
        setIssuingPickupTaskId(null);
      }
    },
    [issuingPickupTaskId, table.api, table.patchRow, showError, showSuccess]
  );

  useEffect(() => {
    if (!pickupMode) return;
    table.setEditingId(null);
    table.setNewRow(null);
  }, [pickupMode, table.setEditingId, table.setNewRow]);

  const compareVisibleRows = useCallback(
    (a, b) => compareTaskRows(a, b, sortOptions),
    [sortOptions]
  );

  const searchResult = useMemo(
    () => buildTaskTableSearchResult(
      table.rows,
      table.childrenCache,
      debouncedSearchQuery,
      compareVisibleRows,
      { serverFiltered: Boolean(debouncedSearchQuery.trim()) }
    ),
    [table.rows, table.childrenCache, debouncedSearchQuery, compareVisibleRows]
  );

  const visibleRows = useMemo(() => {
    if (pickupMode) {
      // Сервер уже отфильтровал по префиксу номера и отсортировал по пути;
      // клиентская сортировка уточняет порядок: буква → заказчик → номер.
      return [...table.rows].sort(comparePickupRows);
    }
    const rows = searchResult.isActive
      ? searchResult.rows
      : sortRowsWithStableOrder(table.rows, sortOptions);
    if (searchResult.isActive) return rows;
    return filterCompletedRows(rows, hideCompletedSort);
  }, [pickupMode, searchResult, table.rows, sortOptions, hideCompletedSort]);

  const isPickupSearchActive = pickupMode && Boolean(debouncedSearchQuery.trim());
  const singlePickupMatchId = isPickupSearchActive && visibleRows.length === 1
    ? visibleRows[0].id
    : null;

  const handlePickupSearchEnter = useCallback(() => {
    if (!singlePickupMatchId) return;
    document
      .querySelector(`[data-pickup-issue-button="${singlePickupMatchId}"]`)
      ?.focus();
  }, [singlePickupMatchId]);

  useTaskTablePlannedProgressPolling({
    enabled: showPlannedProgress,
    api: table.api,
    rows: visibleRows,
    childrenCache: table.childrenCache,
    expandedRows: table.expandedRows,
    autoExpandIds: searchResult.autoExpandIds,
    selectedEmployeeForHighlight,
    patchRow: table.patchRow,
    patchChildInCache: table.patchChildInCache
  });

  useEffect(() => {
    if (pickupMode) return undefined;
    const query = debouncedSearchQuery.trim();
    if (!query) return undefined;

    const timer = window.setTimeout(() => {
      table.rows
        .filter((row) => row.isSplitTask)
        .forEach((row) => {
          table.loadChildrenForParent(row.id);
        });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [pickupMode, debouncedSearchQuery, table.rows, table.loadChildrenForParent]);

  useEffect(() => {
    if (pickupMode) return undefined;
    if (!hideCompletedInSharedSort) return undefined;
    if (visibleRows.length === 0) return undefined;

    const timer = window.setTimeout(() => {
      visibleRows
        .filter((row) => row.isSplitTask)
        .forEach((row) => {
          table.loadChildrenForParent(row.id);
        });
    }, 150);

    return () => window.clearTimeout(timer);
  }, [pickupMode, hideCompletedInSharedSort, visibleRows, table.loadChildrenForParent]);

  const handleForceCommentTooltipClose = useCallback(() => {
    onFocusCommentTooltipConsumed?.();
  }, [onFocusCommentTooltipConsumed]);

  const noopToggleExpand = useCallback(() => {}, []);

  useEffect(() => {
    const taskId = Number(focusCommentTooltipTaskId);
    if (!Number.isFinite(taskId) || taskId <= 0) return undefined;

    let cancelled = false;
    const cellExists = () => Boolean(document.querySelector(`[data-task-comment-cell="${taskId}"]`));

    const openDialogFallback = async () => {
      try {
        const row = await table.api.fetchTableRow(taskId, selectedEmployeeForHighlight || '');
        if (cancelled || !row) {
          onFocusCommentTooltipConsumed?.();
          return;
        }
        table.handleOpenComment(row);
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) onFocusCommentTooltipConsumed?.();
      }
    };

    (async () => {
      if (cellExists()) return;

      const onPage = visibleRows.some((row) => row.id === taskId);
      if (onPage) return;

      for (const [parentId, children] of table.childrenCache.entries()) {
        if (!children.some((child) => child.id === taskId)) continue;
        if (!table.expandedRows.has(parentId)) {
          await table.loadChildrenForParent(parentId, { force: true });
          if (cancelled) return;
          table.expandParent(parentId);
        }
        return;
      }

      // Wait for table data after tab switch; effect re-runs when rows arrive.
      if (visibleRows.length === 0 && table.totalCount === 0) {
        return;
      }

      try {
        const row = await table.api.fetchTableRow(taskId, selectedEmployeeForHighlight || '');
        if (cancelled || !row) {
          onFocusCommentTooltipConsumed?.();
          return;
        }
        const parentId = row.parentRowNumber;
        if (parentId) {
          const parentOnPage = visibleRows.some((r) => r.id === parentId);
          if (parentOnPage) {
            await table.loadChildrenForParent(parentId, { force: true });
            if (cancelled) return;
            table.expandParent(parentId);
            return;
          }
        }
      } catch (err) {
        console.error(err);
      }

      if (!cancelled) await openDialogFallback();
    })();

    return () => {
      cancelled = true;
    };
  }, [
    focusCommentTooltipTaskId,
    onFocusCommentTooltipConsumed,
    selectedEmployeeForHighlight,
    table.api,
    table.childrenCache,
    table.expandParent,
    table.expandedRows,
    table.handleOpenComment,
    table.loadChildrenForParent,
    table.totalCount,
    visibleRows
  ]);

  const tableColSpan = taskTableColumnCount(
    columnSettings.visibility,
    table.showHoursTypeColumns
  );

  const estimateRowGroupHeight = useCallback(
    (index) => {
      const row = visibleRows[index];
      if (!row) return ROW_GROUP_BASE_HEIGHT;

      const allowedChildIds = searchResult.childrenFilter?.get(row.id);
      const children = prepareParentChildren({
        parent: row,
        childrenCache: table.childrenCache,
        sortOptions,
        allowedChildIds,
        hideCompletedInSharedSort
      });
      const shouldPromoteSingleChild =
        hideCompletedInSharedSort && row.isSplitTask && !isCompletedRow(row) && children.length === 1;
      const displayTask = shouldPromoteSingleChild ? children[0] : row;
      if (table.editingId === displayTask.id) return EDIT_ROW_HEIGHT;
      const hasChildren = !shouldPromoteSingleChild && (row.isSplitTask || children.length > 0);
      const parentFooter = hasProgressFooter(displayTask, showPlannedProgress) ? ROW_PROGRESS_HEIGHT : 0;

      if (!hasChildren || !table.expandedRows.has(row.id)) {
        return ROW_GROUP_BASE_HEIGHT + parentFooter;
      }

      const childrenHeight = children.reduce(
        (total, child) =>
          total + ROW_GROUP_BASE_HEIGHT + (hasProgressFooter(child, showPlannedProgress) ? ROW_PROGRESS_HEIGHT : 0),
        0
      );

      return ROW_GROUP_BASE_HEIGHT + parentFooter + childrenHeight;
    },
    [
      hideCompletedInSharedSort,
      searchResult.childrenFilter,
      showPlannedProgress,
      sortOptions,
      table.childrenCache,
      table.editingId,
      table.expandedRows,
      visibleRows
    ]
  );

  const shouldVirtualize = visibleRows.length > 30;

  const measureScrollMargin = useCallback(() => {
    const el = tableContainerRef.current;
    if (!el) return;
    // Округление гасит субпиксельный drift getBoundingClientRect после скролла.
    const next = Math.round(el.getBoundingClientRect().top + window.scrollY);
    setScrollMargin((prev) =>
      Math.abs(prev - next) < SCROLL_MARGIN_EPSILON_PX ? prev : next
    );
  }, []);

  useLayoutEffect(() => {
    measureScrollMargin();
    // Нельзя observe'ить саму таблицу: виртуализация меняет её высоту на каждом
    // кадре скролла → RO → setScrollMargin → микропрыжок после остановки.
    const above = aboveTableRef.current;
    const resizeObserver = above ? new ResizeObserver(measureScrollMargin) : null;
    resizeObserver?.observe(above);
    window.addEventListener('resize', measureScrollMargin);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', measureScrollMargin);
    };
  }, [measureScrollMargin, table.rows.length, table.page, sortOptions, table.newRow]);

  const rowVirtualizer = useWindowVirtualizer({
    count: visibleRows.length,
    estimateSize: estimateRowGroupHeight,
    getItemKey: (index) => visibleRows[index]?.id ?? index,
    overscan: VIRTUAL_OVERSCAN,
    scrollMargin,
    enabled: shouldVirtualize
  });

  useEffect(() => {
    rowVirtualizer.measure();
  }, [rowVirtualizer, estimateRowGroupHeight]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      rowVirtualizer.measure();
    }, TEXT_LIMIT_MEASURE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [rowVirtualizer, columnSettings.textLimit]);

  useEffect(() => {
    const taskId = Number(focusCommentTooltipTaskId);
    if (!Number.isFinite(taskId) || taskId <= 0) return undefined;

    let index = visibleRows.findIndex((row) => row.id === taskId);
    if (index < 0) {
      index = visibleRows.findIndex((row) => {
        const children = table.childrenCache.get(row.id) || [];
        return children.some((child) => child.id === taskId);
      });
    }
    if (index < 0) return undefined;

    if (shouldVirtualize) {
      rowVirtualizer.scrollToIndex(index, { align: 'center' });
    }

    const timer = window.setTimeout(() => {
      document
        .querySelector(`[data-task-comment-cell="${taskId}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, shouldVirtualize ? 80 : 0);

    return () => window.clearTimeout(timer);
  }, [
    focusCommentTooltipTaskId,
    rowVirtualizer,
    shouldVirtualize,
    table.childrenCache,
    visibleRows
  ]);

  const virtualRows = rowVirtualizer.getVirtualItems();
  const topPadding =
    virtualRows.length > 0
      ? Math.max(0, Math.round(virtualRows[0].start - scrollMargin))
      : 0;
  const bottomPadding =
    virtualRows.length > 0
      ? Math.max(
          0,
          Math.round(
            rowVirtualizer.getTotalSize() - (virtualRows[virtualRows.length - 1].end - scrollMargin)
          )
        )
      : 0;

  const actionsColumnSx =
    table.newRow || table.editingId ? COL_ACTIONS_DUAL : COL_ACTIONS;

  const renderTaskRow = (parent) => {
    const allowedChildIds = searchResult.childrenFilter?.get(parent.id);
    const children = prepareParentChildren({
      parent,
      childrenCache: table.childrenCache,
      sortOptions,
      allowedChildIds,
      hideCompletedInSharedSort
    });
    const shouldPromoteSingleChild =
      hideCompletedInSharedSort && parent.isSplitTask && !isCompletedRow(parent) && children.length === 1;
    const displayTask = shouldPromoteSingleChild
      ? {
          ...children[0],
          isSplitTask: false,
          hasCdrPreview: Boolean(children[0]?.hasCdrPreview || parent?.hasCdrPreview)
        }
      : parent;
    const displayPreviewBuilding = shouldPromoteSingleChild
      ? table.isCdrPreviewBuilding(children[0].id) || table.isCdrPreviewBuilding(parent.id)
      : table.isCdrPreviewBuilding(parent.id);
    const cdrPreviewSourceTask = shouldPromoteSingleChild
      ? (children[0]?.hasCdrPreview
          ? children[0]
          : parent?.hasCdrPreview
            ? parent
            : children[0])
      : displayTask;
    const displayChildren = shouldPromoteSingleChild ? [] : children;
    const isExpanded = table.expandedRows.has(parent.id)
      || (searchResult.autoExpandIds.has(parent.id) && !shouldPromoteSingleChild);
    return !pickupMode && table.editingId === displayTask.id ? (
      <EditTaskRow
        key={`edit-${displayTask.id}`}
        task={displayTask}
        onUpdate={table.handleUpdateRow}
        onCancel={() => table.setEditingId(null)}
        onOpenAssigneeModal={table.handleOpenAssigneeModal}
        showHoursTypeColumns={table.showHoursTypeColumns}
        columnVisibility={columnSettings.visibility}
        cdrPreviewBuilding={displayPreviewBuilding}
        saving={table.savingRowId === displayTask.id}
      />
    ) : (
      <ParentTaskRow
        key={displayTask.id}
        task={displayTask}
        childrenTasks={displayChildren}
        isExpanded={isExpanded}
        onToggleExpand={shouldPromoteSingleChild ? noopToggleExpand : table.toggleExpand}
        onOpenFile={table.handleOpenFile}
        onOpenFolder={table.handleOpenFolder}
        onShowCdrPreview={DEV_CDR_PREVIEW_ENABLED ? table.handleShowCdrPreview : undefined}
        cdrPreviewSourceTask={cdrPreviewSourceTask}
        onStart={table.handleStartTask}
        onPause={table.handlePauseTask}
        onResume={table.handleResumeTask}
        onComplete={table.handleCompleteTask}
        onSetStatus={table.handleSetStatus}
        onSetPriorityRank={isAdmin ? table.handleSetPriorityRank : undefined}
        pendingLifecycleTaskId={table.pendingLifecycleTaskId}
        onEdit={table.handleEditRow}
        onDelete={table.handleDeleteRow}
        onCopyOrderLink={table.handleCopyOrderLink}
        onPrintOrderLabel={table.handlePrintOrderLabel}
        onOpenComment={table.handleOpenComment}
        onOpenIntervals={table.handleOpenIntervals}
        canEdit={isAdmin}
        canDelete={isAdmin}
        canChangeStatus={!isAdmin}
        currentUser={currentUser}
        highlightMyTasks={table.highlightMyTasks}
        selectedEmployeeForHighlight={selectedEmployeeForHighlight}
        showHoursTypeColumns={table.showHoursTypeColumns}
        columnVisibility={columnSettings.visibility}
        textLimit={columnSettings.textLimit}
        showPlannedProgress={showPlannedProgress}
        isCdrPreviewBuilding={table.isCdrPreviewBuilding}
        cdrPreviewBuilding={displayPreviewBuilding}
        maxSubscribedTaskIds={isAdmin ? maxSubscribedTaskIds : []}
        maxCanSubscribe={isAdmin && maxCanSubscribe}
        onMaxSubscribeToggle={isAdmin ? onMaxSubscribeToggle : undefined}
        forceCommentTooltipTaskId={focusCommentTooltipTaskId}
        onForceCommentTooltipClose={handleForceCommentTooltipClose}
        actionsColumnSx={actionsColumnSx}
        pickupMode={pickupMode}
        onIssueOrder={handleIssueOrder}
        issuingPickup={issuingPickupTaskId === displayTask.id}
        pickupHighlighted={singlePickupMatchId === displayTask.id}
      />
    );
  };

  return (
    <TextLimitProvider value={columnSettings.textLimit}>
    <Paper sx={{ p: { xs: 2, md: 3 }, borderRadius: 2.5 }}>
      <Box ref={aboveTableRef}>
        {isAdmin && (
          <PlanningWarningsBanner
            warnings={table.planningWarnings}
            onDismiss={table.dismissPlanningWarning}
          />
        )}
        <TaskTableToolbar
          isAdmin={isAdmin}
          onAddNew={table.handleAddNewRow}
          highlightMyTasks={table.highlightMyTasks}
          onToggleHighlight={table.toggleHighlight}
          columnVisibility={columnSettings.visibility}
          onColumnVisibleChange={columnSettings.setColumnVisible}
          onColumnVisibilityReset={columnSettings.resetColumns}
          textLimit={columnSettings.textLimit}
          onTextLimitChange={columnSettings.setTextLimit}
          deadlineSort={deadlineSort}
          onDeadlineSortChange={setDeadlineSort}
          completedBottomSort={completedBottomSort}
          onCompletedBottomSortChange={setCompletedBottomSort}
          hideCompletedSort={hideCompletedSort}
          onHideCompletedSortChange={setHideCompletedSort}
          hideCompletedInSharedSort={hideCompletedInSharedSort}
          onHideCompletedInSharedSortChange={setHideCompletedInSharedSort}
          showFuss={showFuss}
          onShowFussChange={isAdmin ? setShowFuss : undefined}
          searchQuery={searchQuery}
          onSearchQueryChange={handleSearchQueryChange}
          showPlannedProgress={plannedProgressPref.showPlannedProgress}
          onToggleShowPlannedProgress={plannedProgressPref.toggleShowPlannedProgress}
          autoSearchMinutes={autoSearchSettings.minutes}
          onAutoSearchMinutesChange={autoSearchSettings.setMinutes}
          onOpenFileOpenSettings={onOpenFileOpenSettings}
          onOpenTaskTypeStats={onOpenTaskTypeStats}
          taskTypeStatsOpen={taskTypeStatsOpen}
          pickupMode={pickupMode}
          onSearchEnter={handlePickupSearchEnter}
          onOpenCustomLabels={() => setCustomLabelsOpen(true)}
        />
      </Box>

      <TableContainer
        ref={tableContainerRef}
        sx={{ overflowAnchor: 'none' }}
      >
        <Table
          stickyHeader
          size="small"
          sx={{
            '--task-table-text-limit-width': `${columnSettings.textLimit}ch`,
            tableLayout: 'auto',
            width: 'max-content',
            minWidth: '100%'
          }}
        >
          <TaskTableHead
            columnVisibility={columnSettings.visibility}
            showHoursTypeColumns={table.showHoursTypeColumns}
            actionsColumnSx={actionsColumnSx}
            pickupMode={pickupMode}
          />
          <TableBody>
            {table.newRow && isAdmin && !pickupMode && (
              <NewTaskRow
                newRow={table.newRow}
                onSave={table.handleSaveNewRow}
                onCancel={() => table.setNewRow(null)}
                onOpenAssigneeModal={table.handleOpenNewSharedModal}
                showHoursTypeColumns={table.showHoursTypeColumns}
                columnVisibility={columnSettings.visibility}
                saving={table.savingNewRow}
              />
            )}
            {shouldVirtualize ? (
              <>
                <VirtualPaddingRow height={topPadding} colSpan={tableColSpan} />
                {virtualRows.map((virtualRow) => renderTaskRow(visibleRows[virtualRow.index]))}
                <VirtualPaddingRow height={bottomPadding} colSpan={tableColSpan} />
              </>
            ) : (
              visibleRows.map(renderTaskRow)
            )}
            {searchResult.isActive && !pickupMode && visibleRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={tableColSpan} align="center" sx={{ py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    Ничего не найдено по запросу «{searchQuery.trim()}»
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {isPickupSearchActive && visibleRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={tableColSpan} align="center" sx={{ py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    Заказ с номером «{debouncedSearchQuery.trim()}» не найден
                  </Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {table.totalCount > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, pt: 3, mt: 2, px: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {excludeCompletedFromApi
              ? `${visibleRows.length === 0 ? 0 : table.page * table.rowsPerPage + 1}–${table.page * table.rowsPerPage + visibleRows.length} из ${table.totalCount}`
              : `${table.page * table.rowsPerPage + 1}–${Math.min((table.page + 1) * table.rowsPerPage, table.totalCount)} из ${table.totalCount}`}
          </Typography>
          <Pagination
            count={Math.max(1, Math.ceil(table.totalCount / table.rowsPerPage))}
            page={table.page + 1}
            onChange={(_e, p) => table.handleChangePage(null, p - 1)}
            color="primary"
            shape="rounded"
            size="medium"
            showFirstButton
            showLastButton
          />
        </Box>
      )}

      <CommentDialog
        open={table.commentDialogOpen}
        task={table.selectedCommentTask}
        pending={table.commentSaving}
        onChanged={table.handleCommentChanged}
        onClose={() => table.setCommentDialogOpen(false)}
      />
      {DEV_CDR_PREVIEW_ENABLED && (
        <CdrPreviewDialog
          open={table.cdrPreviewOpen}
          anchor={table.cdrPreviewAnchor}
          taskTitle={
            table.cdrPreviewTask?.title
            || table.cdrPreviewTask?.heading
            || table.cdrPreviewTask?.fileName
            || ''
          }
          previewUrl={table.cdrPreviewData?.url}
          previewInfo={table.cdrPreviewData?.method}
          previewPath={
            table.cdrPreviewData?.path
            || (table.cdrPreviewTask
              ? formatDevTaskFilePath(table.cdrPreviewTask.folderPath, table.cdrPreviewTask.fileName)
              : '')
          }
          previewError={table.cdrPreviewData?.error}
          pending={table.cdrPreviewPending}
        />
      )}
      <TaskIntervalsDialog
        open={table.intervalsDialogOpen}
        taskTitle={table.intervalsTask ? `${table.intervalsTask.folderPath || ''} / ${table.intervalsTask.fileName || ''}` : ''}
        intervals={table.intervalsRows}
        pending={table.intervalsPending}
        onClose={table.handleCloseIntervals}
        onSave={table.handleSaveIntervals}
      />

      <CustomLabelsDialog
        open={customLabelsOpen}
        onClose={() => setCustomLabelsOpen(false)}
      />

      <SplitTaskModal
        open={table.splitModalOpen}
        mode={table.splitModalMode}
        task={table.splitModalTask}
        initialParts={table.splitModalInitialParts}
        employees={table.employees}
        taskTypes={table.taskTypes}
        taskExecutionMode={
          table.splitModalTask?.taskExecutionMode || table.newRow?.taskExecutionMode
        }
        onClose={table.closeSplitModal}
        onSuccess={table.handleSplitSuccess}
        onDraftApply={table.handleDraftApply}
      />
    </Paper>
    </TextLimitProvider>
  );
}
