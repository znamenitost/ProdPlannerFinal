/** Ответ API: { task, planningWarnings } или плоский объект задачи. */
export function unwrapTaskSaveResponse(json) {
  if (!json) return { task: null, planningWarnings: [], replacedTaskId: null };
  if (json.task != null) {
    return {
      task: json.task,
      planningWarnings: json.planningWarnings ?? [],
      replacedTaskId: json.replacedTaskId ?? null
    };
  }
  const { planningWarnings, replacedTaskId, ...task } = json;
  return {
    task: json,
    planningWarnings: planningWarnings ?? [],
    replacedTaskId: replacedTaskId ?? null
  };
}
