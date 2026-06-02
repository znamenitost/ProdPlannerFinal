/** Centralized React Query keys for prefix invalidation. */
export const queryKeys = {
  activeTasks: (employee) => ['app', 'activeTasks', employee],
  weekCalendar: (employee, weekStartIso) => ['app', 'weekCalendar', employee, weekStartIso],
  weekCalendarAll: (employee) => ['app', 'weekCalendar', employee],
  completedTasks: (employee, page, pageSize, statsPeriod = 'week') => [
    'app',
    'completedTasks',
    employee,
    page,
    pageSize,
    statsPeriod
  ],
  completedAll: (employee) => ['app', 'completedTasks', employee],
  taskTable: (page, pageSize, employeeFilter) => [
    'app',
    'taskTable',
    page,
    pageSize,
    employeeFilter || ''
  ],
  taskTableAll: () => ['app', 'taskTable'],
  deadlineRisks: (employee) => ['app', 'deadlineRisks', employee],
  queueOverloads: (employee) => ['app', 'queueOverloads', employee]
};

export function weekStartIso(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}
