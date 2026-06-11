/** Зеркало DeadlineRiskEvaluator.ShouldShowInBanner на клиенте. */
export function shouldShowDeadlineBanner(riskLevel, deadline, now = new Date()) {
  if (riskLevel === 'overdue' || riskLevel === 'critical') return true;
  if (riskLevel !== 'warning' || deadline == null) return false;

  const deadlineDate = new Date(deadline);
  if (Number.isNaN(deadlineDate.getTime())) return false;

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  const deadlineDay = new Date(deadlineDate);
  deadlineDay.setHours(0, 0, 0, 0);

  return deadlineDay.getTime() <= today.getTime() + 24 * 60 * 60 * 1000;
}

export function mapActiveTasksToDeadlineRisks(tasks, now = new Date()) {
  if (!Array.isArray(tasks)) return [];

  return tasks
    .filter((task) => {
      const level = task.riskLevel;
      if (!level || level === 'ok') return false;
      return shouldShowDeadlineBanner(level, task.deadline, now);
    })
    .map((task) => ({
      taskId: task.id,
      taskTitle: task.title?.trim() || task.heading?.trim() || task.fileName || `Задача #${task.id}`,
      fileName: task.fileName,
      deadline: task.deadline,
      riskLevel: task.riskLevel,
      requiredHours: task.requiredHours ?? 0,
      availableHoursBeforeDeadline: task.availableHoursBeforeDeadline ?? 0
    }));
}
