import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, DEFAULT_OPTIONS } from '../lib/config.js';
import { employeeForVu } from '../lib/employees.js';
import { loginEmployee, employeeAppCycle } from '../lib/session.js';

export const options = {
  ...DEFAULT_OPTIONS,
  scenarios: {
    employees_api: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 20 },
        { duration: '3m', target: 20 },
        { duration: '30s', target: 0 }
      ],
      gracefulRampDown: '20s'
    }
  },
  thresholds: {
    ...DEFAULT_OPTIONS.thresholds,
    http_req_failed: ['rate<0.05']
  }
};

const vuLoggedIn = {};

export default function () {
  const employee = employeeForVu(__VU.id);
  const jar = http.cookieJar();

  if (!vuLoggedIn[__VU.id]) {
    loginEmployee(jar, employee);
    vuLoggedIn[__VU.id] = true;
  }

  employeeAppCycle(jar, employee);
  sleep(1 + Math.random() * 2);
}

export function setup() {
  const res = http.get(`${BASE_URL}/api/deploy-info`);
  if (res.status !== 200) {
    console.warn(`deploy-info: HTTP ${res.status} — сервер доступен? ${BASE_URL}`);
  } else {
    console.log(`target: ${BASE_URL} deploy: ${res.body}`);
  }
}
