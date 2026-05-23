import http from 'k6/http';
import { check, sleep } from 'k6';
import { BASE_URL, DEFAULT_OPTIONS } from '../lib/config.js';

export const options = {
  ...DEFAULT_OPTIONS,
  scenarios: {
    frontend: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '20s', target: 10 },
        { duration: '2m', target: 20 },
        { duration: '20s', target: 0 }
      ]
    }
  }
};

let cachedAssetPath = null;

function resolveMainBundle() {
  if (cachedAssetPath) return cachedAssetPath;

  const indexRes = http.get(`${BASE_URL}/`, { tags: { name: 'frontend_index' } });
  check(indexRes, { 'index 200': (r) => r.status === 200 });

  const match = indexRes.body && indexRes.body.match(/\/assets\/index-[^"']+\.js/);
  cachedAssetPath = match ? match[0] : '/assets/index.js';
  return cachedAssetPath;
}

export default function () {
  const bundlePath = resolveMainBundle();

  const batch = http.batch([
    ['GET', `${BASE_URL}/`, null, { tags: { name: 'frontend_index' } }],
    ['GET', `${BASE_URL}${bundlePath}`, null, { tags: { name: 'frontend_bundle' } }],
    ['GET', `${BASE_URL}/wwwroot/deploy-version.txt`, null, { tags: { name: 'deploy_version' } }]
  ]);

  check(batch[0], { 'index ok': (r) => r.status === 200 });
  check(batch[1], { 'bundle ok': (r) => r.status === 200 });

  sleep(2 + Math.random() * 3);
}
