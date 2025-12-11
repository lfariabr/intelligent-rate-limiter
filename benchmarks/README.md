# Quick Benchmark Reference

## Prerequisites

```bash
# Install k6
brew install k6  # macOS
# or follow: https://k6.io/docs/getting-started/installation/

# Install Apache Bench (usually pre-installed on macOS/Linux)
brew install httpd          # macOS
sudo apt install apache2-utils  # Ubuntu/Debian
```

## Start the Server

```bash
# Terminal 1: Start Redis + IRL Server
docker-compose up -d && npm run dev
```

## Run Tests

### Quick Start (Recommended)

```bash
# Run automated sample benchmark suite
./benchmarks/run-sample-benchmarks.sh
```

### k6 Tests (Individual)

```bash
# Basic load test (3.5 minutes)
k6 run benchmarks/k6-basic-load.js

# Stress test with 1000 VUs (6 minutes)
k6 run benchmarks/k6-stress-test.js

# Spike test (3 minutes)
k6 run benchmarks/k6-spike-test.js
```

### Apache Bench Tests

```bash
# Basic test suite (~2 minutes)
./benchmarks/ab-basic-test.sh

# Stress test (~5 minutes)
./benchmarks/ab-stress-test.sh

# Mixed workload test (~3 minutes)
./benchmarks/ab-mixed-workload.sh
```

## Custom Tests

### k6 Custom

```bash
# Custom base URL
k6 run -e BASE_URL=http://your-server:3000 benchmarks/k6-basic-load.js

# JSON output
k6 run --out json=results.json benchmarks/k6-basic-load.js

# CSV output
k6 run --out csv=results.csv benchmarks/k6-basic-load.js
```

### Apache Bench Custom

```bash
# Custom base URL
BASE_URL=http://your-server:3000 ./benchmarks/ab-basic-test.sh

# Individual command
echo '{"agentId":"test-agent","tokens":1}' > payload.json
ab -n 1000 -c 50 -p payload.json -T "application/json" \
   http://localhost:3000/api/request
```

## View Results

```bash
# List result files
ls -lh benchmark-results/

# View latest Apache Bench results
cat benchmark-results/*_ab_baseline.txt | grep "Requests per second"

# View k6 summary (if generated)
cat benchmark-results/*_k6_summary.json | jq
```

## Monitor During Tests

```bash
# Terminal 2: Watch server logs
npm run dev

# Terminal 3: Monitor Redis
docker-compose exec redis redis-cli --stat

# Terminal 4: System resources
top
# or
htop
```

## Clean Up

```bash
# Clear Redis data between tests
docker-compose exec redis redis-cli FLUSHALL

# Stop services
docker-compose down
```

## Troubleshooting

### Server not responding
```bash
curl http://localhost:3000/health
# If fails, restart:
docker-compose down && docker-compose up -d && npm run dev
```

### Port already in use
```bash
# Find process using port 3000
lsof -ti:3000 | xargs kill -9
```

### Redis connection issues
```bash
# Check Redis is running
docker-compose ps
docker-compose exec redis redis-cli ping
```

### Too many open files
```bash
ulimit -n 65536
```

## Expected Results

### Baseline (Light Load)
- **Throughput:** 2,000-2,500 req/s
- **Latency P95:** <50ms
- **Success rate:** >99%

### Stress (Heavy Load)
- **Throughput:** 2,500-3,500 req/s
- **Latency P95:** 150-200ms
- **Rate limited:** 20-30%

### Spike Test
- **Peak throughput:** 2,000+ req/s during spike
- **Recovery:** <5 seconds after spike ends
- **No crashes or errors**

## Documentation

- **Full Guide:** [benchmarks/BENCHMARKING.md](BENCHMARKING.md)
- **Sample Results:** [benchmarks/SAMPLE_RESULTS.md](SAMPLE_RESULTS.md)
- **Main README:** [../README.md](../README.md)

---

**Need help?** Open an issue on GitHub or check the full documentation.
