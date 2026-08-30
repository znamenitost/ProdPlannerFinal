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
  dailyReport: (employee, dateKey = 'today') => ['app', 'dailyReport', employee, dateKey],
  dailyReportAll: (employee) => ['app', 'dailyReport', employee],
  taskTable: (page, pageSize, employeeFilter, excludeCompleted = false, search = '', showFuss = false, pickupMode = false) => [
    'app',
    'taskTable',
    page,
    pageSize,
    employeeFilter || '',
    excludeCompleted,
    search || '',
    showFuss,
    pickupMode
  ],
  taskTableAll: () => ['app', 'taskTable'],
  deadlineRisks: (employee) => ['app', 'deadlineRisks', employee],
  queueOverloads: (employee) => ['app', 'queueOverloads', employee],
  dayPlan: (employee, dateKey) => ['app', 'dayPlan', employee, dateKey || ''],
  dayPlanAll: (employee) => ['app', 'dayPlan', employee]
};

export function weekStartIso(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}
