import {
  Box,
  Pagination,
  Paper,
  Table,
  TableBody,
  TableContainer,
  Typography,
} from '@mui/material';
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

export default function TaskTable({
  onCalendarRefresh,
  onRegisterHubHandler,
  userRole,
  currentUser,
  selectedEmployeeForHighlight
}) {
  const isAdmin = userRole === 'Admin';
  const table = useTaskTableController({
    onCalendarRefresh,
    onRegisterHubHandler,
    selectedEmployeeForHighlight
  });
  const columnSettings = useTaskTableColumnVisibility(currentUser);

  return (
    <TextLimitProvider value={columnSettings.textLimit}>
    <Paper sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
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
      />

      <TableContainer sx={{ maxHeight: '70vh', overflow: 'auto' }}>
        <Table stickyHeader size="small" sx={{ tableLayout: 'auto', width: 'max-content', minWidth: '100%' }}>
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
            {table.rows.map(parent => {
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
            })}
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
        onClose={table.closeSplitModal}
        onSuccess={table.handleSplitSuccess}
        onDraftApply={table.handleDraftApply}
      />
    </Paper>
    </TextLimitProvider>
  );
}
