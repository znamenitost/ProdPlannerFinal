import { useCallback, useState } from 'react';

function warningKey(taskId, kind) {
  return `${kind}-${taskId}`;
}

export default function usePlanningWarnings() {
  const [warnings, setWarnings] = useState([]);

  const applyPlanningWarnings = useCallback((incoming) => {
    if (!incoming?.length) return;
    setWarnings(incoming);
  }, []);

  const dismissPlanningWarning = useCallback((taskId, kind) => {
    const key = warningKey(taskId, kind);
    setWarnings((prev) =>
      prev.filter((w) => warningKey(w.taskId, w.kind) !== key)
    );
  }, []);

  return {
    planningWarnings: warnings,
    applyPlanningWarnings,
    dismissPlanningWarning
  };
}
