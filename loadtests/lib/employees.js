/** 20 VUs mapped to employees (cycle). Cyrillic + LoadTest ASCII. */
export const EMPLOYEES = [
  'Дима', 'Яромир', 'Павел',
  'LoadTest-01', 'LoadTest-02', 'LoadTest-03', 'LoadTest-04', 'LoadTest-05',
  'LoadTest-06', 'LoadTest-07', 'LoadTest-08', 'LoadTest-09', 'LoadTest-10',
  'LoadTest-11', 'LoadTest-12', 'LoadTest-13', 'LoadTest-14', 'LoadTest-15',
  'LoadTest-16', 'LoadTest-17', 'LoadTest-18'
];

export function employeeForVu(vu) {
  return EMPLOYEES[(vu - 1) % EMPLOYEES.length];
}
