import http from 'k6/http';
import { check } from 'k6';
import { BASE_URL } from './config.js';

export function mondayIsoUtc() {
  const d = new Date();
  const dow = d.getUTCDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}

export function loginEmployee(jar, fullName) {
  const res = http.post(
    `${BASE_URL}/api/auth/login-employee`,
    JSON.stringify({ fullName }),
    {
      jar,
      headers: { 'Content-Type': 'application/json' },
      tags: { name: 'auth_login' }
    }
  );
  check(res, {
    'login status 200': (r) => r.status === 200,
    'login authenticated': (r) => {
      try {
        return JSON.parse(r.body).isAuthenticated === true;
      } catch {
        return false;
      }
    }
  });
  return res;
}

export function employeeAppCycle(jar, employee) {
  const monday = mondayIsoUtc();
  const enc = encodeURIComponent(employee);

  const responses = http.batch([
    ['GET', `${BASE_URL}/api/auth/me`, null, { jar, tags: { name: 'auth_me' } }],
    ['GET', `${BASE_URL}/api/tasks/active?employee=${enc}`, null, { jar, tags: { name: 'tasks_active' } }],
    ['GET', `${BASE_URL}/api/calendar/week?employee=${enc}&startDate=${monday}`, null, { jar, tags: { name: 'calendar_week' } }],
    ['GET', `${BASE_URL}/api/tasks/completed?employee=${enc}&page=1&pageSize=25`, null, { jar, tags: { name: 'tasks_completed' } }],
    ['GET', `${BASE_URL}/api/tasks/deadline-risks?employee=${enc}`, null, { jar, tags: { name: 'tasks_deadline_risks' } }],
    ['GET', `${BASE_URL}/api/tasks/table?page=1&pageSize=50`, null, { jar, tags: { name: 'tasks_table' } }],
    ['GET', `${BASE_URL}/api/notifications/pending`, null, { jar, tags: { name: 'notifications_pending' } }]
  ]);

  check(responses[1], { 'active tasks 200': (r) => r.status === 200 });
  check(responses[2], { 'calendar 200': (r) => r.status === 200 });
  check(responses[5], { 'table 200': (r) => r.status === 200 });

  return responses;
}
