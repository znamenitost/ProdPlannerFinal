export function partTotalHours(part) {
  if (part.throughTest) {
    return (parseFloat(part.testHours) || 0) + (parseFloat(part.productionHours) || 0);
  }
  return parseFloat(part.hours) || 0;
}

export function isPartAutoAssignable(part, isEdit) {
  if (!isEdit) return true;
  return !part.started;
}

function compareLoadScore(a, b) {
  if (a[0] !== b[0]) return a[0] - b[0];
  return a[1] - b[1];
}

function loadScore(employee, baseTaskCounts, modalTaskCounts, modalHours, partIndex, isShared) {
  const taskCount = (baseTaskCounts[employee] ?? 0) + (modalTaskCounts[employee] ?? 0);
  const hours = isShared && partIndex > 0 ? (modalHours[employee] ?? 0) : 0;
  return [taskCount, hours];
}

export function pickEmployeeForPart({
  employees,
  baseTaskCounts,
  modalTaskCounts,
  modalHours,
  partIndex,
  isShared
}) {
  if (!employees.length) return '';

  let best = employees[0];
  let bestScore = loadScore(best, baseTaskCounts, modalTaskCounts, modalHours, partIndex, isShared);

  for (let i = 1; i < employees.length; i += 1) {
    const employee = employees[i];
    const score = loadScore(employee, baseTaskCounts, modalTaskCounts, modalHours, partIndex, isShared);
    if (compareLoadScore(score, bestScore) < 0) {
      best = employee;
      bestScore = score;
    }
  }

  return best;
}

/**
 * Жадное авто-назначение сотрудников по частям модалки.
 * 1-я часть — минимум активных задач; 2-я+ общей задачи — с учётом часов уже назначенных частей.
 */
export function applyAutoAssignToParts(parts, {
  employees,
  baseTaskCounts = {},
  isEdit = false
}) {
  if (!parts?.length || !employees?.length) return parts;

  const isShared = parts.length >= 2;
  const modalTaskCounts = Object.fromEntries(employees.map((name) => [name, 0]));
  const modalHours = Object.fromEntries(employees.map((name) => [name, 0]));

  return parts.map((part, index) => {
    if (!isPartAutoAssignable(part, isEdit)) {
      const hours = partTotalHours(part);
      if (part.employeeName) {
        modalTaskCounts[part.employeeName] = (modalTaskCounts[part.employeeName] ?? 0) + 1;
        modalHours[part.employeeName] = (modalHours[part.employeeName] ?? 0) + hours;
      }
      return part;
    }

    const employeeName = pickEmployeeForPart({
      employees,
      baseTaskCounts,
      modalTaskCounts,
      modalHours,
      partIndex: index,
      isShared
    });

    const hours = partTotalHours(part);
    modalTaskCounts[employeeName] = (modalTaskCounts[employeeName] ?? 0) + 1;
    modalHours[employeeName] = (modalHours[employeeName] ?? 0) + hours;

    return { ...part, employeeName };
  });
}
