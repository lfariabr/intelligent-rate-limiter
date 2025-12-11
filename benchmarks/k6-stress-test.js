// k6-stress-test.js
// Stress test with thousands of concurrent agents
// Run: k6 run benchmarks/k6-stress-test.js

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Counter, Trend } from 'k6/metrics';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Custom metrics
const errorRate = new Rate('errors');
const rateLimitRate = new Rate('rate_limited_requests');
const allowedRequests = new Counter('allowed_requests');
const blockedRequests = new Counter('blocked_requests');
const retryAfterMetric = new Trend('retry_after_ms');
const tokensConsumed = new Counter('tokens_consumed');

export const options = {
  scenarios: {
    // Scenario 1: Many agents with low token consumption
    many_agents_light: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 500 },   // Ramp up to 500 VUs
        { duration: '2m', target: 1000 },  // Ramp up to 1000 VUs
        { duration: '2m', target: 1000 },  // Stay at 1000 VUs
        { duration: '1m', target: 0 },     // Ramp down
      ],
      gracefulRampDown: '30s',
      exec: 'lightLoad',
    },
    // Scenario 2: Fewer agents with heavy token consumption
    few_agents_heavy: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 50 },
        { duration: '2m', target: 100 },
        { duration: '2m', target: 100 },
        { duration: '1m', target: 0 },
      ],
      gracefulRampDown: '30s',
      startTime: '30s', // Start 30s after the test begins
      exec: 'heavyLoad',
    },
  },
  thresholds: {
    http_req_duration: ['p(50)<200', 'p(95)<500', 'p(99)<1000'],
    http_req_failed: ['rate<0.15'], // Allow up to 15% failure for stress test
    errors: ['rate<0.15'],
    rate_limited_requests: ['rate<0.5'], // Expect some rate limiting
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const AGENT_POOL_SIZE = 5000; // Simulate 5000 unique agents

function makeRequest(agentId, tokens) {
  const payload = JSON.stringify({
    agentId: agentId,
    tokens: tokens,
  });

  const res = http.post(`${BASE_URL}/api/request`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });

  const success = check(res, {
    'status is 200 or 429': (r) => r.status === 200 || r.status === 429,
  });

  errorRate.add(!success);

  if (res.status === 200) {
    allowedRequests.add(1);
    tokensConsumed.add(tokens);
  } else if (res.status === 429) {
    blockedRequests.add(1);
    rateLimitRate.add(1);
    
    const retryAfter = res.headers['Retry-After'];
    if (retryAfter) {
      retryAfterMetric.add(parseFloat(retryAfter) * 1000);
    }
  } else {
    errorRate.add(1);
  }

  return res;
}

// Light load: Many agents, 1-2 tokens per request
export function lightLoad() {
  const agentId = `agent-${randomIntBetween(1, AGENT_POOL_SIZE)}`;
  const tokens = randomIntBetween(1, 2);
  
  makeRequest(agentId, tokens);
  
  sleep(randomIntBetween(1, 3)); // Random delay between requests
}

// Heavy load: Fewer agents, 5-20 tokens per request
export function heavyLoad() {
  const agentId = `heavy-agent-${randomIntBetween(1, 100)}`;
  const tokens = randomIntBetween(5, 20);
  
  makeRequest(agentId, tokens);
  
  // Also check quota periodically
  if (Math.random() > 0.7) {
    http.get(`${BASE_URL}/api/quota/${agentId}`);
  }
  
  sleep(randomIntBetween(1, 2));
}

export function handleSummary(data) {
  return {
    'summary.json': JSON.stringify(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true }),
  };
}

function textSummary(data, options) {
  const indent = options.indent || '';
  const colors = options.enableColors;
  
  let summary = '\n' + indent + '=== Load Test Summary ===\n\n';
  
  if (data.metrics.http_reqs) {
    summary += indent + `Total Requests: ${data.metrics.http_reqs.values.count}\n`;
  }
  
  if (data.metrics.http_req_duration) {
    summary += indent + `Request Duration:\n`;
    summary += indent + `  P50: ${data.metrics.http_req_duration.values['p(50)']}ms\n`;
    summary += indent + `  P95: ${data.metrics.http_req_duration.values['p(95)']}ms\n`;
    summary += indent + `  P99: ${data.metrics.http_req_duration.values['p(99)']}ms\n`;
  }
  
  if (data.metrics.rate_limited_requests) {
    const rateLimit = data.metrics.rate_limited_requests.values.rate;
    summary += indent + `Rate Limited: ${(rateLimit * 100).toFixed(2)}%\n`;
  }
  
  if (data.metrics.allowed_requests && data.metrics.blocked_requests) {
    summary += indent + `Allowed: ${data.metrics.allowed_requests.values.count}\n`;
    summary += indent + `Blocked: ${data.metrics.blocked_requests.values.count}\n`;
  }
  
  return summary;
}
