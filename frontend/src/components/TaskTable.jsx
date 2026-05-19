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
  onTaskUpdate,
  userRole,
  currentUser,
  selectedEmployeeForHighlight
}) {
  const isAdmin = userRole === 'Admin';
  const table = useTaskTableController({
    refreshTrigger,
    onTaskUpdate,
    selectedEmployeeForHighlight
  });

  return (
    <Paper sx={{ p: { xs: 2, md: 3 }, borderRadius: 1 }}>
      <TaskTableToolbar
        isAdmin={isAdmin}
        onAddNew={table.handleAddNewRow}
        highlightMyTasks={table.highlightMyTasks}
        onToggleHighlight={table.toggleHighlight}
      />

      <TableContainer sx={{ maxHeight: '70vh', overflow: 'auto' }}>
        <Table stickyHeader size="small">
          <TaskTableHead isAdmin={isAdmin} />
          <TableBody>
            {table.newRow && isAdmin && (
              <NewTaskRow
                newRow={table.newRow}
                setNewRow={table.setNewRow}
                onSave={table.handleSaveNewRow}
                onCancel={() => table.setNewRow(null)}
                onOpenAssigneeModal={table.handleOpenNewSharedModal}
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
                />
              ) : (
                <ParentTaskRow
                  key={parent.id}
                  task={parent}
                  childrenTasks={children}
                  isExpanded={isExpanded}
                  onToggleExpand={table.toggleExpand}
                  onOpenFile={table.api.openFile}
                  onStart={table.handleStartTask}
                  onPause={table.handlePauseTask}
                  onResume={table.handleResumeTask}
                  onComplete={table.handleCompleteTask}
                  onEdit={() => table.setEditingId(parent.id)}
                  onDelete={table.handleDeleteRow}
                  onOpenAssigneeModal={table.handleOpenAssigneeModal}
                  onOpenComment={table.handleOpenComment}
                  canEdit={isAdmin}
                  canDelete={isAdmin}
                  canChangeStatus={!isAdmin}
                  currentUser={currentUser}
                  highlightMyTasks={table.highlightMyTasks}
                  selectedEmployeeForHighlight={selectedEmployeeForHighlight}
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
