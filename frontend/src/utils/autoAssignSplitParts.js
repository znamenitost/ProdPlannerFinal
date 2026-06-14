import { getEligibleEmployees } from './autoAssignTypeRules.js';

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

function pickEmployeeForPartialTypes({
  employees,
  remainingTypes,
  typeRules,
  baseTaskCounts,
  modalTaskCounts,
  modalHours,
  partIndex,
  isShared
}) {
  const candidates = employees.filter((employee) => {
    const allowed = typeRules[employee] ?? [];
    return remainingTypes.some((type) => allowed.includes(type));
  });

  if (!candidates.length) return '';

  let best = '';
  let bestScore = null;
  let bestTypeCount = -1;

  for (const employee of candidates) {
    const allowed = typeRules[employee] ?? [];
    const coverableCount = remainingTypes.filter((type) => allowed.includes(type)).length;
    const score = loadScore(
      employee,
      baseTaskCounts,
      modalTaskCounts,
      modalHours,
      partIndex,
      isShared
    );

    if (
      !best
      || compareLoadScore(score, bestScore) < 0
      || (compareLoadScore(score, bestScore) === 0 && coverableCount > bestTypeCount)
    ) {
      best = employee;
      bestScore = score;
      bestTypeCount = coverableCount;
    }
  }

  return best;
}

export function splitValueProportionally(total, weights) {
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  if (weightSum <= 0) return weights.map(() => 0);

  const totalNum = parseFloat(total) || 0;
  let assigned = 0;

  return weights.map((weight, index) => {
    if (index === weights.length - 1) {
      return Math.round((totalNum - assigned) * 10) / 10;
    }
    const slice = Math.round(((totalNum * weight) / weightSum) * 10) / 10;
    assigned += slice;
    return slice;
  });
}

function accountPartLoad(part, modalTaskCounts, modalHours) {
  const hours = partTotalHours(part);
  if (!part.employeeName) return;
  modalTaskCounts[part.employeeName] = (modalTaskCounts[part.employeeName] ?? 0) + 1;
  modalHours[part.employeeName] = (modalHours[part.employeeName] ?? 0) + hours;
}

function buildTypeAssignmentGroups(part, {
  employees,
  typeRules,
  baseTaskCounts,
  modalTaskCounts,
  modalHours,
  partIndex,
  isShared
}) {
  const remainingTypes = [...part.taskTypes];
  const groups = [];
  const totalHours = partTotalHours(part);
  const totalTypeCount = part.taskTypes.length;
  const tempTaskCounts = { ...modalTaskCounts };
  const tempHours = { ...modalHours };

  while (remainingTypes.length > 0) {
    const sharedForPick = isShared || groups.length > 0 || partIndex > 0;
    const employee = pickEmployeeForPartialTypes({
      employees,
      remainingTypes,
      typeRules,
      baseTaskCounts,
      modalTaskCounts: tempTaskCounts,
      modalHours: tempHours,
      partIndex: partIndex + groups.length,
      isShared: sharedForPick
    });

    if (!employee) break;

    const allowed = typeRules[employee] ?? [];
    const types = remainingTypes.filter((type) => allowed.includes(type));
    groups.push({ employee, types });

    const hourEstimate = totalTypeCount > 0
      ? (totalHours * types.length) / totalTypeCount
      : 0;
    tempTaskCounts[employee] = (tempTaskCounts[employee] ?? 0) + 1;
    tempHours[employee] = (tempHours[employee] ?? 0) + hourEstimate;

    for (let index = remainingTypes.length - 1; index >= 0; index -= 1) {
      if (types.includes(remainingTypes[index])) {
        remainingTypes.splice(index, 1);
      }
    }
  }

  return groups;
}

function createSplitSubParts(part, groups) {
  const weights = groups.map((group) => group.types.length);
  const hourSlices = splitValueProportionally(partTotalHours(part), weights);
  const testSlices = part.throughTest
    ? splitValueProportionally(part.testHours, weights)
    : [];
  const productionSlices = part.throughTest
    ? splitValueProportionally(part.productionHours, weights)
    : [];

  return groups.map((group, index) => {
    const nextPart = {
      ...part,
      childTaskId: index === 0 ? part.childTaskId : undefined,
      employeeName: group.employee,
      taskTypes: [...group.types]
    };

    if (part.throughTest) {
      return {
        ...nextPart,
        throughTest: true,
        testHours: testSlices[index] ?? 0,
        productionHours: productionSlices[index] ?? 0,
        hours: 0
      };
    }

    return {
      ...nextPart,
      hours: hourSlices[index] ?? 0
    };
  });
}

function assignSinglePart(part, {
  employees,
  typeRules,
  baseTaskCounts,
  modalTaskCounts,
  modalHours,
  partIndex,
  isShared
}) {
  const eligibleEmployees = typeRules
    ? getEligibleEmployees(employees, part.taskTypes, typeRules)
    : employees;

  const employeeName = pickEmployeeForPart({
    employees: eligibleEmployees,
    baseTaskCounts,
    modalTaskCounts,
    modalHours,
    partIndex,
    isShared
  });

  if (!employeeName) return [part];
  return [{ ...part, employeeName }];
}

function assignAutoPart(part, ctx) {
  const {
    employees,
    typeRules,
    splitMixedTaskTypes
  } = ctx;

  if (!typeRules || !part.taskTypes?.length) {
    return assignSinglePart(part, ctx);
  }

  if (getEligibleEmployees(employees, part.taskTypes, typeRules).length > 0) {
    return assignSinglePart(part, ctx);
  }

  if (!splitMixedTaskTypes) {
    return [part];
  }

  const groups = buildTypeAssignmentGroups(part, ctx);
  if (!groups.length) return [part];

  const assignedTypeSet = new Set(groups.flatMap((group) => group.types));
  const allTypesCovered = part.taskTypes.every((type) => assignedTypeSet.has(type));
  if (!allTypesCovered) return [part];

  return createSplitSubParts(part, groups);
}

/**
 * Жадное авто-назначение сотрудников по частям модалки.
 * 1-я часть — минимум активных задач; 2-я+ общей задачи — с учётом часов уже назначенных частей.
 * Если ни один сотрудник не покрывает все типы части — создаёт параллельные под-части по типам.
 */
export function applyAutoAssignToParts(parts, {
  employees,
  baseTaskCounts = {},
  isEdit = false,
  typeRules = null,
  splitMixedTaskTypes = true
}) {
  if (!parts?.length || !employees?.length) return parts;

  const result = [];
  const modalTaskCounts = Object.fromEntries(employees.map((name) => [name, 0]));
  const modalHours = Object.fromEntries(employees.map((name) => [name, 0]));

  for (const part of parts) {
    if (!isPartAutoAssignable(part, isEdit)) {
      accountPartLoad(part, modalTaskCounts, modalHours);
      result.push(part);
      continue;
    }

    const assignedParts = assignAutoPart(part, {
      employees,
      typeRules,
      baseTaskCounts,
      modalTaskCounts,
      modalHours,
      partIndex: result.length,
      isShared: result.length >= 1 || parts.length >= 2,
      splitMixedTaskTypes
    });

    for (const assignedPart of assignedParts) {
      accountPartLoad(assignedPart, modalTaskCounts, modalHours);
      result.push(assignedPart);
    }
  }

  return result;
}

export function didExpandPartsByTypeSplit(beforeParts, afterParts) {
  return afterParts.length > beforeParts.length;
}
