#!/bin/bash
# ab-basic-test.sh
# Basic Apache Bench test for IRL endpoints
# Usage: ./benchmarks/ab-basic-test.sh

BASE_URL=${BASE_URL:-"http://localhost:3000"}

echo "================================"
echo "Apache Bench - Basic Load Test"
echo "================================"
echo ""

# Test 1: Health endpoint
echo "1. Testing Health Endpoint"
echo "   URL: ${BASE_URL}/health"
ab -n 1000 -c 10 -g health-results.tsv "${BASE_URL}/health"
echo ""

# Test 2: GET /api/test-rate-limit
echo "2. Testing Rate Limit Endpoint (GET)"
echo "   URL: ${BASE_URL}/api/test-rate-limit"
ab -n 500 -c 20 -g rate-limit-results.tsv "${BASE_URL}/api/test-rate-limit"
echo ""

# Test 3: POST /api/request (requires JSON payload)
echo "3. Testing Request Endpoint (POST)"
echo "   URL: ${BASE_URL}/api/request"
echo "   Creating temporary payload file..."

# Create temporary JSON payload
TEMP_FILE=$(mktemp)
echo '{"agentId":"ab-test-agent-1","tokens":1}' > "$TEMP_FILE"

ab -n 1000 -c 50 \
   -p "$TEMP_FILE" \
   -T "application/json" \
   -g request-results.tsv \
   "${BASE_URL}/api/request"

# Cleanup
rm -f "$TEMP_FILE"
echo ""

# Test 4: GET /api/quota/:agentId
echo "4. Testing Quota Endpoint (GET)"
echo "   URL: ${BASE_URL}/api/quota/ab-test-agent-1"
ab -n 500 -c 10 -g quota-results.tsv "${BASE_URL}/api/quota/ab-test-agent-1"
echo ""

echo "================================"
echo "Tests Complete!"
echo "Results saved to: *-results.tsv"
echo "================================"
