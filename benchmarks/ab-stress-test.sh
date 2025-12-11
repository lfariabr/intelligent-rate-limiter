#!/bin/bash
set -euo pipefail

# ab-stress-test.sh
# Stress test with high concurrency using Apache Bench
# Usage: ./benchmarks/ab-stress-test.sh

BASE_URL=${BASE_URL:-"http://localhost:3000"}

echo "==================================="
echo "Apache Bench - Stress Test"
echo "High Concurrency & Multiple Agents"
echo "==================================="
echo ""

# Function to test with multiple agents in parallel
test_multiple_agents() {
    local endpoint=$1
    local num_agents=$2
    local requests_per_agent=$3
    local concurrency=$4
    local temp_files=()
    
    echo "Testing ${num_agents} agents with ${requests_per_agent} requests each at concurrency ${concurrency}"
    
    for i in $(seq 1 $num_agents); do
        AGENT_ID="stress-agent-${i}"
        TEMP_FILE=$(mktemp)
        temp_files+=("$TEMP_FILE")
        echo "{\"agentId\":\"${AGENT_ID}\",\"tokens\":1}" > "$TEMP_FILE"
        
        ab -n ${requests_per_agent} -c ${concurrency} \
           -p "$TEMP_FILE" \
           -T "application/json" \
           "${BASE_URL}${endpoint}" > /dev/null 2>&1 &
    done
    
    wait
    
    # Clean up temp files after all processes complete
    for f in "${temp_files[@]}"; do
        rm -f "$f"
    done
    
    echo "  ✓ Completed ${num_agents} parallel agent tests"
}

# Test 1: Medium load - 100 agents
echo "1. Medium Load Test"
echo "   100 agents, 100 requests each, concurrency 20"
test_multiple_agents "/api/request" 100 100 20
echo ""

# Test 2: High load - 500 agents
echo "2. High Load Test"
echo "   500 agents, 50 requests each, concurrency 50"
test_multiple_agents "/api/request" 500 50 50
echo ""

# Test 3: Peak load - Single endpoint
echo "3. Peak Load Test - Single Endpoint"
echo "   URL: ${BASE_URL}/api/request"

TEMP_FILE=$(mktemp)
echo '{"agentId":"peak-test-agent","tokens":5}' > "$TEMP_FILE"

ab -n 10000 -c 200 \
   -p "$TEMP_FILE" \
   -T "application/json" \
   -g stress-peak-results.tsv \
   "${BASE_URL}/api/request"

rm -f "$TEMP_FILE"
echo ""

# Test 4: Sustained load
echo "4. Sustained Load Test"
echo "   5000 requests at concurrency 100"

TEMP_FILE=$(mktemp)
echo '{"agentId":"sustained-agent","tokens":2}' > "$TEMP_FILE"

ab -n 5000 -c 100 \
   -p "$TEMP_FILE" \
   -T "application/json" \
   -g stress-sustained-results.tsv \
   "${BASE_URL}/api/request"

rm -f "$TEMP_FILE"
echo ""

echo "==================================="
echo "Stress Tests Complete!"
echo "==================================="
