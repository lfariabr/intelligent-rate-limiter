// k6-basic-load.js
// Basic load test for IRL Express endpoints
// Run: k6 run benchmarks/k6-basic-load.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');
const retryAfterMetric = new Trend('retry_after_ms');
const rateLimitRate = new Rate('rate_limited_requests');

export const options = {
  stages: [
    { duration: '30s', target: 50 },   // Ramp up to 50 VUs
    { duration: '1m', target: 50 },    // Stay at 50 VUs
    { duration: '30s', target: 100 },  // Ramp up to 100 VUs
    { duration: '1m', target: 100 },   // Stay at 100 VUs
    { duration: '30s', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests should be below 500ms
    http_req_failed: ['rate<0.1'],     // Less than 10% of requests should fail
    errors: ['rate<0.1'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  // Test 1: Health check
  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, {
    'health check is 200': (r) => r.status === 200,
  });

  // Test 2: POST /api/request with random agentId
  const agentId = `agent-${Math.floor(Math.random() * 10000)}`;
  const requestPayload = JSON.stringify({
    agentId: agentId,
    tokens: 1,
  });

  const requestRes = http.post(`${BASE_URL}/api/request`, requestPayload, {
    headers: { 'Content-Type': 'application/json' },
  });

  const requestSuccess = check(requestRes, {
    'request status is 200 or 429': (r) => r.status === 200 || r.status === 429,
    'request has valid json': (r) => {
      try {
        JSON.parse(r.body);
        return true;
      } catch {
        return false;
      }
    },
  });

  errorRate.add(!requestSuccess);
  rateLimitRate.add(requestRes.status === 429);

  // Track Retry-After for rate-limited responses
  if (requestRes.status === 429) {
    const retryAfter = requestRes.headers['Retry-After'];
    if (retryAfter) {
      retryAfterMetric.add(parseFloat(retryAfter) * 1000);
    }
  }

  // Test 3: GET /api/quota/:agentId
  const quotaRes = http.get(`${BASE_URL}/api/quota/${agentId}`);
  check(quotaRes, {
    'quota check is 200': (r) => r.status === 200,
    'quota response has remaining': (r) => {
      try {
        const body = JSON.parse(r.body);
        return typeof body.remaining === 'number';
      } catch {
        return false;
      }
    },
  });

  // Test 4: GET /api/test-rate-limit
  const rateLimitRes = http.get(`${BASE_URL}/api/test-rate-limit`);
  check(rateLimitRes, {
    'rate limit test returns 200 or 429': (r) => r.status === 200 || r.status === 429,
  });

  sleep(0.5); // Short pause between iterations
}
