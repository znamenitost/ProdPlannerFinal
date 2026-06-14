export function createDefaultAutoAssignTypeRules(employees, taskTypes) {
  return Object.fromEntries(
    employees.map((employee) => [employee, [...taskTypes]])
  );
}

export function normalizeAutoAssignTypeRules(rules, employees, taskTypes) {
  const defaults = createDefaultAutoAssignTypeRules(employees, taskTypes);

  return Object.fromEntries(
    employees.map((employee) => {
      const saved = rules?.[employee];
      if (!Array.isArray(saved)) return [employee, defaults[employee]];

      return [employee, saved.filter((type) => taskTypes.includes(type))];
    })
  );
}

export function getEligibleEmployees(employees, partTaskTypes, typeRules) {
  if (!employees.length) return [];
  if (!typeRules) return employees;

  return employees.filter((employee) => {
    const allowed = typeRules[employee] ?? [];
    if (!allowed.length) return false;
    if (!partTaskTypes?.length) return true;
    return partTaskTypes.every((type) => allowed.includes(type));
  });
}

export function isEmployeeEligibleForPart(employee, partTaskTypes, typeRules) {
  return getEligibleEmployees([employee], partTaskTypes, typeRules).length > 0;
}

export function getUncoveredTaskTypes(employees, partTaskTypes, typeRules) {
  if (!typeRules || !partTaskTypes?.length) return [];

  return partTaskTypes.filter((type) =>
    !employees.some((employee) => (typeRules[employee] ?? []).includes(type))
  );
}
