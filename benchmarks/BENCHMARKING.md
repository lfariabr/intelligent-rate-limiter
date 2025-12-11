# Benchmarking Guide

This guide provides comprehensive instructions for load testing the IRL (Intelligent Rate Limiter) Express server using k6 and Apache Bench (ab).

## Table of Contents

- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [k6 Load Tests](#k6-load-tests)
- [Apache Bench Tests](#apache-bench-tests)
- [Understanding Results](#understanding-results)
- [Best Practices](#best-practices)

## Prerequisites

### Install k6

**macOS:**
```bash
brew install k6
```

**Linux:**
```bash
# Debian/Ubuntu
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Fedora/CentOS
sudo dnf install https://dl.k6.io/rpm/repo.rpm
sudo dnf install k6
```

**Windows:**
```powershell
choco install k6
# or
winget install k6
```

### Install Apache Bench

**macOS:**
```bash
# Usually pre-installed, or:
brew install httpd
```

**Linux:**
```bash
# Debian/Ubuntu
sudo apt-get install apache2-utils

# Fedora/CentOS
sudo yum install httpd-tools
```

**Windows:**
Download from Apache Lounge or use WSL.

## Quick Start

1. **Start the IRL server and Redis:**
   ```bash
   docker-compose up -d && npm run dev
   ```

2. **Verify the server is running:**
   ```bash
   curl http://localhost:3000/health
   ```

3. **Run a basic k6 test:**
   ```bash
   k6 run benchmarks/k6-basic-load.js
   ```

4. **Run a basic Apache Bench test:**
   ```bash
   ./benchmarks/ab-basic-test.sh
   ```

## k6 Load Tests

### 1. Basic Load Test

**File:** `benchmarks/k6-basic-load.js`

**Description:** Tests all endpoints with gradual load increase.

**Run:**
```bash
k6 run benchmarks/k6-basic-load.js
```

**Custom base URL:**
```bash
k6 run -e BASE_URL=http://your-server:3000 benchmarks/k6-basic-load.js
```

**What it tests:**
- Health endpoint
- POST /api/request with varying agentIds
- GET /api/quota/:agentId
- GET /api/test-rate-limit

**Load profile:**
- Ramp up: 50 VUs over 30s
- Hold: 50 VUs for 1m
- Ramp up: 100 VUs over 30s
- Hold: 100 VUs for 1m
- Ramp down: 0 VUs over 30s

### 2. Stress Test

**File:** `benchmarks/k6-stress-test.js`

**Description:** Simulates thousands of concurrent agents with varying token consumption patterns.

**Run:**
```bash
k6 run benchmarks/k6-stress-test.js
```

**What it tests:**
- **Light load scenario:** 1000 VUs, 1-2 tokens per request
- **Heavy load scenario:** 100 VUs, 5-20 tokens per request
- Simulates 5000 unique agents
- Measures rate limiting behavior under stress

**Load profile:**
- Light agents: Ramps to 1000 VUs over 3 minutes
- Heavy agents: Ramps to 100 VUs over 3 minutes (starts at 30s)
- Both scenarios run concurrently

### 3. Spike Test

**File:** `benchmarks/k6-spike-test.js`

**Description:** Tests system resilience during sudden traffic spikes.

**Run:**
```bash
k6 run benchmarks/k6-spike-test.js
```

**What it tests:**
- Sudden spike from 100 to 2000 VUs in 10 seconds
- System behavior under extreme load
- Recovery after spike

**Load profile:**
- Baseline: 100 VUs for 30s
- Spike: Jump to 2000 VUs in 10s
- Hold: 2000 VUs for 1m
- Recovery: Drop to 100 VUs over 30s

### k6 Output Options

**JSON output:**
```bash
k6 run --out json=results.json benchmarks/k6-basic-load.js
```

**CSV output:**
```bash
k6 run --out csv=results.csv benchmarks/k6-basic-load.js
```

**InfluxDB output:**
```bash
k6 run --out influxdb=http://localhost:8086/k6 benchmarks/k6-basic-load.js
```

## Apache Bench Tests

### 1. Basic Test Suite

**File:** `benchmarks/ab-basic-test.sh`

**Description:** Tests all endpoints with moderate load.

**Run:**
```bash
./benchmarks/ab-basic-test.sh
```

**Custom base URL:**
```bash
BASE_URL=http://your-server:3000 ./benchmarks/ab-basic-test.sh
```

**What it tests:**
- Health: 1000 requests, 10 concurrent
- Rate limit: 500 requests, 20 concurrent
- Request: 1000 requests, 50 concurrent
- Quota: 500 requests, 10 concurrent

### 2. Stress Test Suite

**File:** `benchmarks/ab-stress-test.sh`

**Description:** High concurrency tests with multiple agents.

**Run:**
```bash
./benchmarks/ab-stress-test.sh
```

**What it tests:**
- 100 agents × 100 requests (concurrency 20)
- 500 agents × 50 requests (concurrency 50)
- Peak load: 10,000 requests at 200 concurrency
- Sustained load: 5,000 requests at 100 concurrency

### 3. Mixed Workload Test

**File:** `benchmarks/ab-mixed-workload.sh`

**Description:** Tests varying token consumption patterns.

**Run:**
```bash
./benchmarks/ab-mixed-workload.sh
```

**What it tests:**
- Light consumers: 1 token per request (2000 requests)
- Medium consumers: 5 tokens per request (1000 requests)
- Heavy consumers: 10 tokens per request (500 requests)
- Very heavy consumers: 20 tokens per request (300 requests)
- Burst pattern: 20 agents simultaneously
- Quota check performance: 2000 requests

**Results:** Saved to `./benchmark-results/` directory

### Apache Bench Individual Commands

**Health check:**
```bash
ab -n 1000 -c 50 http://localhost:3000/health
```

**POST request (requires payload file):**
```bash
echo '{"agentId":"test-agent","tokens":5}' > payload.json
ab -n 1000 -c 50 -p payload.json -T "application/json" http://localhost:3000/api/request
```

**GET quota:**
```bash
ab -n 500 -c 25 http://localhost:3000/api/quota/test-agent
```

## Understanding Results

### k6 Metrics

**Key metrics to monitor:**

- **http_req_duration:** Request latency
  - `p(50)`: Median latency (P50)
  - `p(95)`: 95th percentile latency (P95)
  - `p(99)`: 99th percentile latency (P99)

- **http_reqs:** Total requests and throughput (req/s)

- **http_req_failed:** Failed request rate

- **rate_limited_requests:** Percentage of 429 responses

- **retry_after_ms:** Average retry delay for rate-limited requests

**Example output:**
```
http_req_duration.............: avg=45ms   min=12ms   med=38ms   max=850ms  p(90)=75ms   p(95)=95ms
http_reqs.....................: 125000  2083.33/s
rate_limited_requests.........: 15.25% ✓ 19062  ✗ 105938
```

### Apache Bench Metrics

**Key metrics to monitor:**

- **Requests per second:** Peak throughput
- **Time per request:** Average latency
- **Failed requests:** Count of non-2xx/429 responses
- **Transfer rate:** Network throughput

**Example output:**
```
Requests per second:    2543.12 [#/sec] (mean)
Time per request:       19.662 [ms] (mean)
Time per request:       0.393 [ms] (mean, across all concurrent requests)
Transfer rate:          1234.56 [Kbytes/sec] received
```

### What to Look For

**Good signs:**
- P95 latency < 500ms
- P99 latency < 1000ms
- Error rate < 5% (excluding expected 429s)
- Consistent throughput across test duration
- Retry-After values are reasonable (not too high)

**Warning signs:**
- Increasing latency over time (potential memory leak)
- High error rate (>10% non-429 errors)
- Timeouts or connection failures
- CPU/memory exhaustion on server

## Best Practices

### Before Testing

1. **Ensure Redis is running and healthy:**
   ```bash
   docker-compose ps
   redis-cli ping
   ```

2. **Clear Redis data for consistent tests:**
   ```bash
   redis-cli FLUSHALL
   ```

3. **Set appropriate environment variables:**
   ```bash
   export TOKEN_BUCKET_CAPACITY=100
   export TOKEN_BUCKET_RATE=10
   ```

4. **Monitor system resources:**
   ```bash
   # Terminal 1: Server logs
   npm run dev
   
   # Terminal 2: System resources
   top
   # or
   htop
   ```

### During Testing

1. **Monitor Redis performance:**
   ```bash
   redis-cli --stat
   ```

2. **Watch for Redis slowlog:**
   ```bash
   redis-cli SLOWLOG GET 10
   ```

3. **Check server logs for errors**

### After Testing

1. **Analyze results systematically:**
   - Peak throughput achieved
   - Latency percentiles (P50, P95, P99)
   - Rate limit effectiveness
   - Error distribution

2. **Compare results across test runs**

3. **Document findings:**
   - Test configuration
   - System specifications
   - Performance bottlenecks identified
   - Recommendations

### Test Environment Recommendations

**For accurate results:**
- Use a dedicated test environment (not your development machine)
- Ensure consistent system resources
- Run multiple iterations and average results
- Test at different times of day if applicable
- Use production-like configuration

**For stress testing:**
- Increase system limits:
  ```bash
  ulimit -n 65536  # Increase file descriptors
  ```
- Monitor container resources:
  ```bash
  docker stats
  ```

## Sample Test Workflow

1. **Baseline test:**
   ```bash
   k6 run benchmarks/k6-basic-load.js
   ```

2. **Stress test:**
   ```bash
   k6 run benchmarks/k6-stress-test.js
   ```

3. **Spike test:**
   ```bash
   k6 run benchmarks/k6-spike-test.js
   ```

4. **Apache Bench mixed workload:**
   ```bash
   ./benchmarks/ab-mixed-workload.sh
   ```

5. **Analyze and document results**

6. **Tune configuration if needed and re-test**

## Troubleshooting

**k6 errors:**
- "connection refused": Ensure server is running
- "context deadline exceeded": Increase test thresholds
- High error rate: Check server logs and Redis connectivity

**Apache Bench errors:**
- "apr_socket_recv: Connection reset by peer": Reduce concurrency
- "socket: Too many open files": Increase ulimit
- Empty responses: Check server is responding correctly

## Next Steps

After running benchmarks:
1. Document results in README.md
2. Add findings to DEV_TO_ARTICLE docs
3. Update CHANGELOG.md
4. Create GitHub issues for any identified bottlenecks
5. Share results with team/community
