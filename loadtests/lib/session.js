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

function get(jar, url, name) {
  return http.get(url, { jar, tags: { name } });
}

export function employeeAppCycle(jar, employee) {
  const monday = mondayIsoUtc();
  const enc = encodeURIComponent(employee);
  const params = { jar };

  const me = get(jar, `${BASE_URL}/api/auth/me`, 'auth_me');
  const active = get(jar, `${BASE_URL}/api/tasks/active?employee=${enc}`, 'tasks_active');
  const calendar = get(jar, `${BASE_URL}/api/calendar/week?employee=${enc}&startDate=${monday}`, 'calendar_week');
  const completed = get(jar, `${BASE_URL}/api/tasks/completed?employee=${enc}&page=1&pageSize=25`, 'tasks_completed');
  const risks = get(jar, `${BASE_URL}/api/tasks/deadline-risks?employee=${enc}`, 'tasks_deadline_risks');
  const table = get(jar, `${BASE_URL}/api/tasks/table?page=1&pageSize=50`, 'tasks_table');
  const notifications = get(jar, `${BASE_URL}/api/notifications/pending`, 'notifications_pending');

  check(active, { 'active tasks 200': (r) => r.status === 200 });
  check(calendar, { 'calendar 200': (r) => r.status === 200 });
  check(table, { 'table 200': (r) => r.status === 200 });

  return { me, active, calendar, completed, risks, table, notifications };
}
