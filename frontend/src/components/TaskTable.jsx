import {
  Paper,
  Table,
  TableBody,
  TableContainer,
  TablePagination,
} from '@mui/material';
import SplitTaskModal from './SplitTaskModal';
import TaskTableHead from './TaskTableHead';
import NewTaskRow from './NewTaskRow';
import EditTaskRow from './EditTaskRow';
import ParentTaskRow from './ParentTaskRow';
import TaskTableToolbar from './TaskTableToolbar';
import CommentDialog from './CommentDialog';
import useTaskTableController from '../hooks/taskTable/useTaskTableController';

export default function TaskTable({
  refreshTrigger,
  onCalendarRefresh,
  onRegisterHubHandler,
  userRole,
  currentUser,
  selectedEmployeeForHighlight
}) {
  const isAdmin = userRole === 'Admin';
  const table = useTaskTableController({
    refreshTrigger,
    onCalendarRefresh,
    onRegisterHubHandler,
    selectedEmployeeForHighlight
  });

  return (
    <Paper sx={{ p: { xs: 2, md: 3 }, borderRadius: 3 }}>
      <TaskTableToolbar
        isAdmin={isAdmin}
        onAddNew={table.handleAddNewRow}
        highlightMyTasks={table.highlightMyTasks}
        onToggleHighlight={table.toggleHighlight}
      />

      <TableContainer sx={{ maxHeight: '70vh', overflow: 'auto' }}>
        <Table stickyHeader size="small" sx={{ tableLayout: 'auto', width: 'max-content', minWidth: '100%' }}>
          <TaskTableHead isAdmin={isAdmin} showHoursTypeColumns={table.showHoursTypeColumns} />
          <TableBody>
            {table.newRow && isAdmin && (
              <NewTaskRow
                newRow={table.newRow}
                setNewRow={table.setNewRow}
                onSave={table.handleSaveNewRow}
                onCancel={() => table.setNewRow(null)}
                onOpenAssigneeModal={table.handleOpenNewSharedModal}
                showHoursTypeColumns={table.showHoursTypeColumns}
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
                  canEdit={isAdmin}
                  canDelete={isAdmin}
                  canChangeStatus={!isAdmin}
                  currentUser={currentUser}
                  highlightMyTasks={table.highlightMyTasks}
                  selectedEmployeeForHighlight={selectedEmployeeForHighlight}
                  showHoursTypeColumns={table.showHoursTypeColumns}
                />
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>

      {isAdmin && (
        <TablePagination
          rowsPerPageOptions={[25, 50, 100]}
          component="div"
          count={table.totalCount}
          rowsPerPage={table.rowsPerPage}
          page={table.page}
          onPageChange={table.handleChangePage}
          onRowsPerPageChange={table.handleChangeRowsPerPage}
        />
      )}

      <CommentDialog
        open={table.commentDialogOpen}
        comment={table.selectedCommentTask?.comment || ''}
        onSave={table.handleSaveComment}
        onClose={() => table.setCommentDialogOpen(false)}
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
  );
}
