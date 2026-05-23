export const BASE_URL = __ENV.K6_BASE_URL || 'http://localhost:5234';

export const DEFAULT_OPTIONS = {
  thresholds: {
    http_req_failed: ['rate<0.10'],
    http_req_duration: ['p(95)<5000'],
    'http_req_duration{name:auth_login}': ['p(95)<2000'],
    'http_req_duration{name:tasks_active}': ['p(95)<3000'],
    'http_req_duration{name:calendar_week}': ['p(95)<4000'],
    'http_req_duration{name:tasks_table}': ['p(95)<4000'],
    'http_req_duration{name:frontend_index}': ['p(95)<3000]'
  },
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(90)', 'p(95)', 'p(99)']
};
