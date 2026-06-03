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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import SplitTaskModal from './SplitTaskModal';
import TaskTableHead from './TaskTableHead';
import NewTaskRow from './NewTaskRow';
import EditTaskRow from './EditTaskRow';
import ParentTaskRow from './ParentTaskRow';
import TaskTableToolbar from './TaskTableToolbar';
import CommentDialog from './CommentDialog';
import TaskIntervalsDialog from './taskTable/TaskIntervalsDialog';
import PlanningWarningsBanner from './PlanningWarningsBanner';
import useTaskTableController from '../hooks/taskTable/useTaskTableController';
import useTaskTableColumnVisibility from '../hooks/taskTable/useTaskTableColumnVisibility';
import { TextLimitProvider } from '../context/TextLimitContext';
import { STATUS_COMPLETED } from '../constants/taskStatuses';
import { taskTableColumnCount } from '../utils/taskTableColumns';

const ROW_GROUP_BASE_HEIGHT = 44;
const ROW_PROGRESS_HEIGHT = 6;
const EDIT_ROW_HEIGHT = 72;
const VIRTUAL_OVERSCAN = 15;
const TEXT_LIMIT_MEASURE_DEBOUNCE_MS = 200;

function isCompletedRow(row) {
  return row?.statusText === STATUS_COMPLETED || row?.status === 3;
}

function hasProgressFooter(row) {
  return row?.showPlannedTimeProgress === true;
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
  selectedEmployeeForHighlight
}) {
  const isAdmin = userRole === 'Admin';
  const tableContainerRef = useRef(null);
  const table = useTaskTableController({
    onCalendarRefresh,
    onRegisterHubHandler,
    selectedEmployeeForHighlight
  });
  const columnSettings = useTaskTableColumnVisibility(currentUser);
  const [completedBottomSort, setCompletedBottomSort] = useState(true);

  const visibleRows = useMemo(() => {
    if (!completedBottomSort) return table.rows;

    return table.rows
      .map((row, index) => ({ row, index }))
      .sort((a, b) => {
        const completedDiff = Number(isCompletedRow(a.row)) - Number(isCompletedRow(b.row));
        return completedDiff || a.index - b.index;
      })
      .map(({ row }) => row);
  }, [table.rows, completedBottomSort]);

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
      const parentFooter = hasChildren ? 0 : (hasProgressFooter(row) ? ROW_PROGRESS_HEIGHT : 0);

      if (!hasChildren || !table.expandedRows.has(row.id)) {
        return ROW_GROUP_BASE_HEIGHT + parentFooter;
      }

      const childrenHeight = children.reduce(
        (total, child) =>
          total + ROW_GROUP_BASE_HEIGHT + (hasProgressFooter(child) ? ROW_PROGRESS_HEIGHT : 0),
        0
      );

      return ROW_GROUP_BASE_HEIGHT + parentFooter + childrenHeight;
    },
    [table.childrenCache, table.editingId, table.expandedRows, visibleRows]
  );

  const rowVirtualizer = useVirtualizer({
    count: visibleRows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: estimateRowGroupHeight,
    getItemKey: (index) => visibleRows[index]?.id ?? index,
    overscan: VIRTUAL_OVERSCAN
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
  const shouldVirtualize = visibleRows.length > 30;
  const topPadding = virtualRows.length > 0 ? virtualRows[0].start : 0;
  const bottomPadding =
    virtualRows.length > 0
      ? Math.max(0, rowVirtualizer.getTotalSize() - virtualRows[virtualRows.length - 1].end)
      : 0;

  const renderTaskRow = (parent) => {
    const children = table.childrenCache.get(parent.id) || [];
    const isExpanded = table.expandedRows.has(parent.id);
    return table.editingId === parent.id ? (
      <EditTaskRow
        key={parent.id}
        task={parent}
        onUpdate={table.handleUpdateRow}
        onCancel={() => table.setEditingId(null)}
        onOpenAssigneeModal={table.handleOpenAssigneeModal}
        showHoursTypeColumns={table.showHoursTypeColumns}
        columnVisibility={columnSettings.visibility}
      />
    ) : (
      <ParentTaskRow
        key={parent.id}
        task={parent}
        childrenTasks={children}
        isExpanded={isExpanded}
        onToggleExpand={table.toggleExpand}
        onOpenFile={table.handleOpenFile}
        onStart={table.handleStartTask}
        onPause={table.handlePauseTask}
        onResume={table.handleResumeTask}
        onComplete={table.handleCompleteTask}
        onSetStatus={table.handleSetStatus}
        pendingLifecycleTaskId={table.pendingLifecycleTaskId}
        lifecycleBusy={table.isLifecycleBusy}
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
        completedBottomSort={completedBottomSort}
        onCompletedBottomSortChange={setCompletedBottomSort}
      />

      <TableContainer
        ref={tableContainerRef}
        sx={{
          maxHeight: '70vh',
          overflow: 'auto',
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain'
        }}
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
          </TableBody>
        </Table>
      </TableContainer>

      {table.totalCount > 0 && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1, pt: 3, mt: 2, px: 1 }}>
          <Typography variant="body2" color="text.secondary">
            {`${table.page * table.rowsPerPage + 1}–${Math.min((table.page + 1) * table.rowsPerPage, table.totalCount)} из ${table.totalCount}`}
          </Typography>
          <Pagination
            count={Math.ceil(table.totalCount / table.rowsPerPage)}
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
        onSave={table.handleSaveComment}
        onClose={() => table.setCommentDialogOpen(false)}
      />
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
