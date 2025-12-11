// k6-spike-test.js
// Spike test: Sudden surge of traffic to test system resilience
// Run: k6 run benchmarks/k6-spike-test.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const rateLimitRate = new Rate('rate_limited_requests');
const retryAfterMetric = new Trend('retry_after_ms');

export const options = {
  stages: [
    { duration: '30s', target: 100 },   // Baseline load
    { duration: '10s', target: 2000 },  // Spike!
    { duration: '1m', target: 2000 },   // Hold spike
    { duration: '30s', target: 100 },   // Recover
    { duration: '30s', target: 0 },     // End
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'], // More lenient for spike test
    errors: ['rate<0.2'], // Allow 20% error rate during spike
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  const agentId = `spike-agent-${Math.floor(Math.random() * 2000)}`;
  
  const payload = JSON.stringify({
    agentId: agentId,
    tokens: Math.floor(Math.random() * 5) + 1,
  });

  const res = http.post(`${BASE_URL}/api/request`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });

  const success = check(res, {
    'status is 200 or 429': (r) => r.status === 200 || r.status === 429,
  });

  errorRate.add(!success);
  rateLimitRate.add(res.status === 429);

  if (res.status === 429) {
    const retryAfter = res.headers['Retry-After'];
    if (retryAfter) {
      retryAfterMetric.add(parseFloat(retryAfter) * 1000);
    }
  }

  sleep(0.1); // Minimal sleep for high load
}
