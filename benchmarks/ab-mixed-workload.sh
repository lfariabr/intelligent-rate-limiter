#!/bin/bash
set -euo pipefail

# ab-mixed-workload.sh
# Mixed workload test with varying token consumption
# Usage: ./benchmarks/ab-mixed-workload.sh

BASE_URL=${BASE_URL:-"http://localhost:3000"}
OUTPUT_DIR="./benchmark-results"

# Array to track temp files for cleanup
TEMP_FILES=()
trap 'rm -f "${TEMP_FILES[@]}"' EXIT INT TERM

# Create output directory if it doesn't exist
mkdir -p "$OUTPUT_DIR"

echo "======================================="
echo "Apache Bench - Mixed Workload Test"
echo "Varying Token Consumption & Agent Load"
echo "======================================="
echo ""

timestamp=$(date +%Y%m%d_%H%M%S)

# Test different token consumption patterns
test_token_consumption() {
    local agent_id=$1
    local tokens=$2
    local requests=$3
    local concurrency=$4
    local label=$5
    
    TEMP_FILE=$(mktemp)
    echo "{\"agentId\":\"${agent_id}\",\"tokens\":${tokens}}" > "$TEMP_FILE"
    
    echo "  Testing: ${label}"
    echo "    Agent: ${agent_id}, Tokens: ${tokens}, Requests: ${requests}, Concurrency: ${concurrency}"
    
    ab -n ${requests} -c ${concurrency} \
       -p "$TEMP_FILE" \
       -T "application/json" \
       -g "${OUTPUT_DIR}/${timestamp}_${label}.tsv" \
       "${BASE_URL}/api/request" | grep -E "Requests per second|Time per request|Transfer rate|Failed requests"
    
    rm -f "$TEMP_FILE"
    echo ""
}

# Scenario 1: Light consumers (1 token)
echo "1. Light Token Consumers (1 token per request)"
test_token_consumption "light-consumer" 1 2000 50 "light_load"

# Scenario 2: Medium consumers (5 tokens)
echo "2. Medium Token Consumers (5 tokens per request)"
test_token_consumption "medium-consumer" 5 1000 40 "medium_load"

# Scenario 3: Heavy consumers (10 tokens)
echo "3. Heavy Token Consumers (10 tokens per request)"
test_token_consumption "heavy-consumer" 10 500 30 "heavy_load"

# Scenario 4: Very heavy consumers (20 tokens)
echo "4. Very Heavy Token Consumers (20 tokens per request)"
test_token_consumption "very-heavy-consumer" 20 300 20 "very_heavy_load"

# Scenario 5: Burst pattern - multiple agents hitting simultaneously
echo "5. Burst Pattern - Multiple Agents Simultaneously"
echo "   Launching 20 agents with 100 requests each..."

for i in $(seq 1 20); do
    TEMP_FILE=$(mktemp)
    TEMP_FILES+=("$TEMP_FILE")
    TOKENS=$((1 + RANDOM % 10)) # Random 1-10 tokens
    echo "{\"agentId\":\"burst-agent-${i}\",\"tokens\":${TOKENS}}" > "$TEMP_FILE"
    
    ab -n 100 -c 25 \
       -p "$TEMP_FILE" \
       -T "application/json" \
       "${BASE_URL}/api/request" > /dev/null 2>&1 &
done

wait
echo "  ✓ Burst test completed"
echo ""

# Scenario 6: Check quota endpoints
echo "6. Quota Check Performance"
echo "   Testing GET /api/quota/:agentId"
ab -n 2000 -c 100 \
   -g "${OUTPUT_DIR}/${timestamp}_quota_check.tsv" \
   "${BASE_URL}/api/quota/test-agent" | grep -E "Requests per second|Time per request"
echo ""

echo "======================================="
echo "Mixed Workload Tests Complete!"
echo "Results saved to: ${OUTPUT_DIR}/"
echo "======================================="
