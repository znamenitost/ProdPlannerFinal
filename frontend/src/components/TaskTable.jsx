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
import { DEV_CDR_PREVIEW_ENABLED, formatDevTaskFilePath } from '../utils/devCdrPreviewConfig';
import PlanningWarningsBanner from './PlanningWarningsBanner';
import useTaskTableController from '../hooks/taskTable/useTaskTableController';
import useTaskTableColumnVisibility from '../hooks/taskTable/useTaskTableColumnVisibility';
import { TextLimitProvider } from '../context/TextLimitContext';
import { STATUS_COMPLETED } from '../constants/taskStatuses';
import { taskTableColumnCount } from '../utils/taskTableColumns';
import { buildTaskTableSearchResult } from '../utils/taskTableSearch';
import { hasPlannedProgressFooter } from '../utils/taskTablePlannedProgress';
import useTaskTablePlannedProgressPreference from '../hooks/taskTable/useTaskTablePlannedProgressPreference';
import useTaskTablePlannedProgressPolling from '../hooks/taskTable/useTaskTablePlannedProgressPolling';
import useTaskTableSortSettings from '../hooks/taskTable/useTaskTableSortSettings';
import useUserPreference from '../hooks/useUserPreference';
import useCdrPreviewAutoSearchSettings from '../hooks/useCdrPreviewAutoSearchSettings';

const ROW_GROUP_BASE_HEIGHT = 44;
const ROW_PROGRESS_HEIGHT = 6;
const EDIT_ROW_HEIGHT = 72;
const VIRTUAL_OVERSCAN = 15;
const TEXT_LIMIT_MEASURE_DEBOUNCE_MS = 200;

function isCompletedRow(row) {
  return row?.statusText === STATUS_COMPLETED || row?.status === 3;
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
  onMaxSubscribeToggle
}) {
  const isAdmin = userRole === 'Admin';
  const tableContainerRef = useRef(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  const columnSettings = useTaskTableColumnVisibility(currentUser);
  const plannedProgressPref = useTaskTablePlannedProgressPreference(currentUser);
  const showPlannedProgress = isAdmin && plannedProgressPref.showPlannedProgress;
  const {
    deadlineSort,
    setDeadlineSort,
    completedBottomSort,
    setCompletedBottomSort,
    hideCompletedSort,
    setHideCompletedSort
  } = useTaskTableSortSettings(currentUser);
  const [searchQuery, setSearchQuery] = useUserPreference(currentUser, 'taskTable.searchQuery', '');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery);
  const autoSearchSettings = useCdrPreviewAutoSearchSettings(isAdmin ? currentUser : null);
  const excludeCompletedFromApi = hideCompletedSort && !debouncedSearchQuery.trim();
  const table = useTaskTableController({
    onCalendarRefresh,
    onRegisterHubHandler,
    selectedEmployeeForHighlight,
    excludeCompleted: excludeCompletedFromApi,
    searchQuery: debouncedSearchQuery,
    getAutoSearchMinutes: autoSearchSettings.getAutoSearchMinutes
  });
  const sortOptions = useMemo(
    () => ({ deadlineSort, completedBottomSort }),
    [deadlineSort, completedBottomSort]
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearchQuery(searchQuery), 300);
    return () => window.clearTimeout(timer);
  }, [searchQuery]);

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
    const rows = searchResult.isActive
      ? searchResult.rows
      : sortRowsWithStableOrder(table.rows, sortOptions);
    if (searchResult.isActive) return rows;
    return filterCompletedRows(rows, hideCompletedSort);
  }, [searchResult, table.rows, sortOptions, hideCompletedSort]);

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
  }, [debouncedSearchQuery, table.rows, table.loadChildrenForParent]);

  const tableColSpan = taskTableColumnCount(
    columnSettings.visibility,
    table.showHoursTypeColumns
  );

  const estimateRowGroupHeight = useCallback(
    (index) => {
      const row = visibleRows[index];
      if (!row) return ROW_GROUP_BASE_HEIGHT;
      if (table.editingId === row.id) return EDIT_ROW_HEIGHT;

      const children = table.childrenCache.get(row.id) || [];
      const hasChildren = row.isSplitTask || children.length > 0;
      const parentFooter = hasProgressFooter(row, showPlannedProgress) ? ROW_PROGRESS_HEIGHT : 0;

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
    [table.childrenCache, table.editingId, table.expandedRows, visibleRows, showPlannedProgress]
  );

  const shouldVirtualize = visibleRows.length > 30;

  const measureScrollMargin = useCallback(() => {
    const el = tableContainerRef.current;
    if (!el) return;
    setScrollMargin(el.getBoundingClientRect().top + window.scrollY);
  }, []);

  useLayoutEffect(() => {
    measureScrollMargin();
    const el = tableContainerRef.current;
    if (!el) return undefined;

    const resizeObserver = new ResizeObserver(measureScrollMargin);
    resizeObserver.observe(el);
    window.addEventListener('resize', measureScrollMargin);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener('resize', measureScrollMargin);
    };
  }, [measureScrollMargin, table.rows.length, table.page, sortOptions]);

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

  const virtualRows = rowVirtualizer.getVirtualItems();
  const topPadding = virtualRows.length > 0 ? virtualRows[0].start - scrollMargin : 0;
  const bottomPadding =
    virtualRows.length > 0
      ? Math.max(
          0,
          rowVirtualizer.getTotalSize() - (virtualRows[virtualRows.length - 1].end - scrollMargin)
        )
      : 0;

  const renderTaskRow = (parent) => {
    let children = sortRowsWithStableOrder(
      table.childrenCache.get(parent.id) || [],
      sortOptions
    );
    const allowedChildIds = searchResult.childrenFilter?.get(parent.id);
    if (allowedChildIds) {
      children = children.filter((child) => allowedChildIds.has(child.id));
    }
    const isExpanded = table.expandedRows.has(parent.id)
      || searchResult.autoExpandIds.has(parent.id);
    return table.editingId === parent.id ? (
      <EditTaskRow
        key={parent.id}
        task={parent}
        onUpdate={table.handleUpdateRow}
        onCancel={() => table.setEditingId(null)}
        onOpenAssigneeModal={table.handleOpenAssigneeModal}
        showHoursTypeColumns={table.showHoursTypeColumns}
        columnVisibility={columnSettings.visibility}
        cdrPreviewBuilding={table.isCdrPreviewBuilding(parent.id)}
      />
    ) : (
      <ParentTaskRow
        key={parent.id}
        task={parent}
        childrenTasks={children}
        isExpanded={isExpanded}
        onToggleExpand={table.toggleExpand}
        onOpenFile={table.handleOpenFile}
        onShowCdrPreview={DEV_CDR_PREVIEW_ENABLED ? table.handleShowCdrPreview : undefined}
        onStart={table.handleStartTask}
        onPause={table.handlePauseTask}
        onResume={table.handleResumeTask}
        onComplete={table.handleCompleteTask}
        onSetStatus={table.handleSetStatus}
        pendingLifecycleTaskId={table.pendingLifecycleTaskId}
        onEdit={table.handleEditRow}
        onDelete={table.handleDeleteRow}
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
        maxSubscribedTaskIds={maxSubscribedTaskIds}
        maxCanSubscribe={maxCanSubscribe}
        onMaxSubscribeToggle={onMaxSubscribeToggle}
      />
    );
  };

  return (
    <TextLimitProvider value={columnSettings.textLimit}>
    <Paper sx={{ p: { xs: 2, md: 3 }, borderRadius: 2.5 }}>
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
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        showPlannedProgress={plannedProgressPref.showPlannedProgress}
        onToggleShowPlannedProgress={plannedProgressPref.toggleShowPlannedProgress}
        autoSearchMinutes={autoSearchSettings.minutes}
        onAutoSearchMinutesChange={autoSearchSettings.setMinutes}
      />

      <TableContainer ref={tableContainerRef}>
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
          />
          <TableBody>
            {table.newRow && isAdmin && (
              <NewTaskRow
                newRow={table.newRow}
                setNewRow={table.setNewRow}
                onSave={table.handleSaveNewRow}
                onCancel={() => table.setNewRow(null)}
                onOpenAssigneeModal={table.handleOpenNewSharedModal}
                showHoursTypeColumns={table.showHoursTypeColumns}
                columnVisibility={columnSettings.visibility}
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
            {searchResult.isActive && visibleRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={tableColSpan} align="center" sx={{ py: 4 }}>
                  <Typography variant="body2" color="text.secondary">
                    Ничего не найдено по запросу «{searchQuery.trim()}»
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
        comment={table.selectedCommentTask?.comment || ''}
        pending={table.commentSaving}
        onSave={table.handleSaveComment}
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
