import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, DEFAULT_OPTIONS } from '../lib/config.js';
import { employeeForVu } from '../lib/employees.js';
import { loginEmployee, employeeAppCycle } from '../lib/session.js';

export const options = {
  ...DEFAULT_OPTIONS,
  scenarios: {
    api_employees: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 20 },
        { duration: '4m', target: 20 },
        { duration: '30s', target: 0 }
      ],
      exec: 'apiScenario',
      gracefulRampDown: '20s'
    },
    frontend_users: {
      executor: 'constant-vus',
      vus: 10,
      duration: '5m',
      exec: 'frontendScenario',
      startTime: '10s'
    }
  }
};

const vuLoggedIn = {};
let cachedAssetPath = null;

export function setup() {
  const res = http.get(`${BASE_URL}/api/deploy-info`);
  check(res, { 'server up': (r) => r.status === 200 });
  console.log(`K6 full-stack -> ${BASE_URL}`);
}

export function apiScenario() {
  const employee = employeeForVu(__VU.id);
  const jar = http.cookieJar();

  if (!vuLoggedIn[__VU.id]) {
    loginEmployee(jar, employee);
    vuLoggedIn[__VU.id] = true;
  }

  employeeAppCycle(jar, employee);
  sleep(1 + Math.random() * 2);
}

export function frontendScenario() {
  if (!cachedAssetPath) {
    const indexRes = http.get(`${BASE_URL}/`, { tags: { name: 'frontend_index' } });
    const match = indexRes.body && indexRes.body.match(/\/assets\/index-[^"']+\.js/);
    cachedAssetPath = match ? match[0] : '/assets/index.js';
  }

  http.batch([
    ['GET', `${BASE_URL}/`, null, { tags: { name: 'frontend_index' } }],
    ['GET', `${BASE_URL}${cachedAssetPath}`, null, { tags: { name: 'frontend_bundle' } }]
  ]);

  sleep(3 + Math.random() * 2);
}
