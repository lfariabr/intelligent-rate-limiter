#!/bin/bash
# run-sample-benchmarks.sh
# Quick sample benchmarks to generate initial results for documentation
# Usage: ./benchmarks/run-sample-benchmarks.sh

BASE_URL=${BASE_URL:-"http://localhost:3000"}
OUTPUT_DIR="./benchmark-results"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

mkdir -p "$OUTPUT_DIR"

echo "=========================================="
echo "  IRL Sample Benchmark Suite"
echo "  Timestamp: ${TIMESTAMP}"
echo "=========================================="
echo ""

# Check if server is running
echo -n "Checking server health... "
if curl -s "${BASE_URL}/health" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Server is running${NC}"
else
    echo -e "${YELLOW}✗ Server is not responding at ${BASE_URL}${NC}"
    echo "Please start the server: docker-compose up -d && npm run dev"
    exit 1
fi
echo ""

# Check Redis
echo -n "Checking Redis connection... "
REDIS_STATUS=$(docker-compose exec -T redis redis-cli ping 2>/dev/null || echo "FAILED")
if [ "$REDIS_STATUS" = "PONG" ]; then
    echo -e "${GREEN}✓ Redis is running${NC}"
else
    echo -e "${YELLOW}⚠ Redis check failed - continuing anyway${NC}"
fi
echo ""

# Clear Redis for clean test
echo "Flushing Redis for clean test..."
docker-compose exec -T redis redis-cli FLUSHALL > /dev/null 2>&1 || true
echo ""

# Test 1: Apache Bench - Quick baseline
echo -e "${BLUE}[1/4] Apache Bench - Baseline Test${NC}"
echo "      1000 requests, concurrency 50"
TEMP_FILE=$(mktemp)
echo '{"agentId":"baseline-agent","tokens":1}' > "$TEMP_FILE"

ab -n 1000 -c 50 \
   -p "$TEMP_FILE" \
   -T "application/json" \
   -g "${OUTPUT_DIR}/${TIMESTAMP}_ab_baseline.tsv" \
   "${BASE_URL}/api/request" > "${OUTPUT_DIR}/${TIMESTAMP}_ab_baseline.txt" 2>&1

# Extract key metrics
REQUESTS_PER_SEC=$(grep "Requests per second:" "${OUTPUT_DIR}/${TIMESTAMP}_ab_baseline.txt" | awk '{print $4}')
AVG_TIME=$(grep "Time per request:" "${OUTPUT_DIR}/${TIMESTAMP}_ab_baseline.txt" | head -1 | awk '{print $4}')
FAILED=$(grep "Failed requests:" "${OUTPUT_DIR}/${TIMESTAMP}_ab_baseline.txt" | awk '{print $3}')

echo "      Results:"
echo "        • Throughput: ${REQUESTS_PER_SEC} req/s"
echo "        • Avg latency: ${AVG_TIME} ms"
echo "        • Failed: ${FAILED}"

rm -f "$TEMP_FILE"
echo ""

# Test 2: Apache Bench - Rate limiting test
echo -e "${BLUE}[2/4] Apache Bench - Rate Limiting Test${NC}"
echo "      500 requests, concurrency 100 (expect rate limits)"
TEMP_FILE=$(mktemp)
echo '{"agentId":"rate-limit-test","tokens":5}' > "$TEMP_FILE"

ab -n 500 -c 100 \
   -p "$TEMP_FILE" \
   -T "application/json" \
   -g "${OUTPUT_DIR}/${TIMESTAMP}_ab_ratelimit.tsv" \
   "${BASE_URL}/api/request" > "${OUTPUT_DIR}/${TIMESTAMP}_ab_ratelimit.txt" 2>&1

NON_2XX=$(grep "Non-2xx responses:" "${OUTPUT_DIR}/${TIMESTAMP}_ab_ratelimit.txt" | awk '{print $3}' || echo "0")
echo "      Results:"
echo "        • Rate limited (429s): ~${NON_2XX}"

rm -f "$TEMP_FILE"
echo ""

# Test 3: k6 - Quick load test (if k6 is installed)
if command -v k6 &> /dev/null; then
    echo -e "${BLUE}[3/4] k6 - Quick Load Test${NC}"
    echo "      30s test with 50 VUs"
    
    # Create a quick k6 script
    cat > "${OUTPUT_DIR}/quick-test.js" << 'EOF'
import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 50,
  duration: '30s',
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export default function () {
  const agentId = `agent-${Math.floor(Math.random() * 100)}`;
  const payload = JSON.stringify({ agentId, tokens: 1 });
  
  const res = http.post(`${BASE_URL}/api/request`, payload, {
    headers: { 'Content-Type': 'application/json' },
  });
  
  check(res, {
    'status ok': (r) => r.status === 200 || r.status === 429,
  });
}
EOF

    k6 run --quiet --no-color \
       -e BASE_URL="${BASE_URL}" \
       --summary-export="${OUTPUT_DIR}/${TIMESTAMP}_k6_summary.json" \
       "${OUTPUT_DIR}/quick-test.js" > "${OUTPUT_DIR}/${TIMESTAMP}_k6_output.txt" 2>&1
    
    # Extract metrics from summary
    if [ -f "${OUTPUT_DIR}/${TIMESTAMP}_k6_summary.json" ]; then
        echo "      Results: (see ${TIMESTAMP}_k6_summary.json for details)"
    fi
    
    rm -f "${OUTPUT_DIR}/quick-test.js"
else
    echo -e "${YELLOW}[3/4] k6 - Skipped (k6 not installed)${NC}"
    echo "      Install k6 to run k6 tests: https://k6.io/docs/getting-started/installation/"
fi
echo ""

# Test 4: Multi-agent concurrent test
echo -e "${BLUE}[4/4] Apache Bench - Multi-Agent Test${NC}"
echo "      50 agents, 50 requests each, running in parallel"

for i in $(seq 1 50); do
    TEMP_FILE=$(mktemp)
    echo "{\"agentId\":\"multi-agent-${i}\",\"tokens\":1}" > "$TEMP_FILE"
    
    ab -n 50 -c 10 \
       -p "$TEMP_FILE" \
       -T "application/json" \
       "${BASE_URL}/api/request" > /dev/null 2>&1 &
    
    rm -f "$TEMP_FILE"
done

wait
echo "      ✓ Completed 50 parallel agent tests"
echo ""

# Summary
echo "=========================================="
echo "  Benchmark Suite Complete!"
echo "=========================================="
echo ""
echo "Results saved to: ${OUTPUT_DIR}/"
echo ""
echo "Key files:"
echo "  • ${TIMESTAMP}_ab_baseline.txt - Baseline performance"
echo "  • ${TIMESTAMP}_ab_ratelimit.txt - Rate limiting behavior"
if command -v k6 &> /dev/null; then
    echo "  • ${TIMESTAMP}_k6_summary.json - k6 metrics"
fi
echo ""
echo "Next steps:"
echo "  1. Review results in ${OUTPUT_DIR}/"
echo "  2. Run full benchmarks: ./benchmarks/ab-stress-test.sh"
echo "  3. Run k6 tests: k6 run benchmarks/k6-stress-test.js"
echo "  4. Update documentation with findings"
echo ""
