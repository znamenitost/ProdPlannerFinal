export function partsToApi(parts) {
  return parts.map((p) => ({
    childTaskId: p.childTaskId || null,
    employeeName: p.employeeName,
    taskType: p.taskTypes.join(', '),
    allocatedHours: parseFloat(p.hours)
  }));
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
    taskTypes: parseTypeToArray(c.type).length ? parseTypeToArray(c.type) : [taskTypes[0]],
    hours: c.estimateHours ?? 0,
    statusText: c.statusText || '',
    started: isChildStarted(c)
  }));
}

export function apiPartsToModalParts(parts, employees, taskTypes) {
  if (!parts?.length) return null;
  return parts.map((p) => ({
    employeeName: p.employeeName,
    taskTypes: parseTypeToArray(p.taskType).length ? parseTypeToArray(p.taskType) : [taskTypes[0]],
    hours: p.allocatedHours ?? 0
  }));
}

export function taskToModalParts(task, employees, taskTypes) {
  const types = parseTypeToArray(task.type);
  return [{
    employeeName: task.employeeName || employees[0],
    taskTypes: types.length ? types : [taskTypes[0]],
    hours: task.estimateHours ?? 0,
    statusText: task.statusText || '',
    started: isChildStarted(task)
  }];
}
