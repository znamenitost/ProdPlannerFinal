/** Ответ API: { task, planningWarnings } или плоский объект задачи. */
export function unwrapTaskSaveResponse(json) {
  if (!json) return { task: null, planningWarnings: [] };
  if (json.task != null) {
    return {
      task: json.task,
      planningWarnings: json.planningWarnings ?? []
    };
  }
  const { planningWarnings, ...task } = json;
  return {
    task: json,
    planningWarnings: planningWarnings ?? []
  };
}
