export function isThroughTestAssignment(entity) {
  if (!entity) return false;
  if (entity.requiresTestBeforeProduction === true) return true;
  const testHours = Number(entity.testEstimateHours) || 0;
  const productionHours = Number(entity.productionEstimateHours) || 0;
  return testHours > 0 && productionHours > 0;
}

export function partsToApi(parts) {
  return parts.map((p, index) => {
    const throughTest = Boolean(p.throughTest);
    const testHours = parseFloat(p.testHours) || 0;
    const productionHours = parseFloat(p.productionHours) || 0;
    const allocatedHours = throughTest
      ? testHours + productionHours
      : parseFloat(p.hours);

    const base = {
      childTaskId: p.childTaskId || null,
      employeeName: p.employeeName,
      taskType: p.taskTypes.join(', '),
      allocatedHours,
      sequenceOrder: index + 1,
    };

    if (throughTest) {
      return {
        ...base,
        requiresTestBeforeProduction: true,
        testEstimateHours: testHours,
        productionEstimateHours: productionHours,
      };
    }

    return base;
  });
}

export function parseTypeToArray(type) {
  if (!type) return [];
  return type.split(',').map((s) => s.trim()).filter(Boolean);
}

function isChildStarted(child) {
  const status = child.statusText || child.status || '';
  return (
    status === 'Начал'
    || status === 'Пауза'
    || status === 'InProgress'
    || status === 'Paused'
    || (child.actualHours ?? 0) > 0.01
    || (child.progress ?? 0) > 0.01
  );
}

export function childrenToModalParts(children, employees, taskTypes) {
  if (!children?.length) return null;
  return children.map((c) => ({
    childTaskId: c.id,
    employeeName: c.employeeName || employees[0],
    taskTypes: parseTypeToArray(c.type),
    hours: c.estimateHours ?? 0,
    statusText: c.statusText || '',
    started: isChildStarted(c),
    throughTest: isThroughTestAssignment(c),
    testHours: c.testEstimateHours ?? 0,
    productionHours: c.productionEstimateHours ?? 0,
  }));
}

export function apiPartsToModalParts(parts, employees, taskTypes) {
  if (!parts?.length) return null;
  return parts.map((p) => ({
    employeeName: p.employeeName,
    taskTypes: parseTypeToArray(p.taskType),
    hours: p.allocatedHours ?? 0,
    throughTest: isThroughTestAssignment(p),
    testHours: p.testEstimateHours ?? 0,
    productionHours: p.productionEstimateHours ?? 0,
  }));
}

export function taskToModalParts(task, employees, taskTypes) {
  const types = parseTypeToArray(task.type);
  return [{
    employeeName: task.employeeName || employees[0],
    taskTypes: types,
    hours: task.estimateHours ?? 0,
    throughTest: isThroughTestAssignment(task),
    testHours: task.testEstimateHours ?? 0,
    productionHours: task.productionEstimateHours ?? 0,
    statusText: task.statusText || '',
    started: isChildStarted(task)
  }];
}
