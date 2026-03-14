#!/bin/bash

# Test script for Pan negotiations
# This script verifies the negotiation flow works correctly

BASE_URL="http://localhost:3000"

echo "========================================"
echo "Pan Negotiation Test Script"
echo "========================================"
echo ""

# Step 1: Check registered users
echo "Step 1: Checking registered users..."
echo "--------------------------------------"
USERS=$(curl -s "$BASE_URL/api/debug")
echo "$USERS" | jq '.registeredUsers'
echo ""

# Verify Alex and Sarah are registered
ALEX_EXISTS=$(echo "$USERS" | jq '.registeredUsers | map(select(.id == "test-user-1")) | length')
SARAH_EXISTS=$(echo "$USERS" | jq '.registeredUsers | map(select(.id == "test-user-2")) | length')

if [ "$ALEX_EXISTS" -eq 0 ]; then
    echo "ERROR: Alex (test-user-1) not found in registered users!"
    exit 1
fi

if [ "$SARAH_EXISTS" -eq 0 ]; then
    echo "ERROR: Sarah (test-user-2) not found in registered users!"
    exit 1
fi

echo "✓ Both Alex and Sarah are registered"
echo ""

# Check Alex's daemon name
ALEX_DAEMON=$(echo "$USERS" | jq -r '.registeredUsers[] | select(.id == "test-user-1") | .daemonName')
if [ "$ALEX_DAEMON" = "Pan" ]; then
    echo "WARNING: Alex's daemon is still named 'Pan' - should be 'Nova'"
else
    echo "✓ Alex's daemon is named: $ALEX_DAEMON"
fi
echo ""

# Step 2: Start a test negotiation
echo "Step 2: Starting test negotiation (Alex -> Sarah)..."
echo "--------------------------------------"
NEGOTIATION_RESULT=$(curl -s -X POST "$BASE_URL/api/debug" \
  -H "Content-Type: application/json" \
  -d '{
    "fromUserId": "test-user-1",
    "toUserId": "test-user-2",
    "topic": "Design review scheduling",
    "message": "Can we schedule a design review?"
  }')

echo "$NEGOTIATION_RESULT" | jq '.'
echo ""

# Check if negotiation was successful
SUCCESS=$(echo "$NEGOTIATION_RESULT" | jq '.success')
if [ "$SUCCESS" != "true" ]; then
    echo "ERROR: Negotiation failed!"
    echo "$NEGOTIATION_RESULT" | jq '.error'
    exit 1
fi

NEGOTIATION_ID=$(echo "$NEGOTIATION_RESULT" | jq -r '.negotiation.id')
echo "✓ Negotiation created with ID: $NEGOTIATION_ID"
echo ""

# Step 3: Verify negotiation is stored correctly
echo "Step 3: Verifying negotiation storage..."
echo "--------------------------------------"
STORED=$(curl -s "$BASE_URL/api/debug")
STORED_NEG=$(echo "$STORED" | jq ".allNegotiations[] | select(.id == \"$NEGOTIATION_ID\")")
echo "$STORED_NEG" | jq '.'
echo ""

# Check initiator and target IDs
INITIATOR_ID=$(echo "$STORED_NEG" | jq -r '.initiator.id')
TARGET_ID=$(echo "$STORED_NEG" | jq -r '.target.id')

if [ "$INITIATOR_ID" != "test-user-1" ]; then
    echo "ERROR: Initiator ID is wrong! Expected test-user-1, got $INITIATOR_ID"
    exit 1
fi

if [ "$TARGET_ID" != "test-user-2" ]; then
    echo "ERROR: Target ID is wrong! Expected test-user-2, got $TARGET_ID"
    echo "This means Sarah won't see this negotiation!"
    exit 1
fi

echo "✓ Initiator ID: $INITIATOR_ID (correct)"
echo "✓ Target ID: $TARGET_ID (correct)"
echo ""

# Step 4: Summary
echo "========================================"
echo "TEST RESULTS"
echo "========================================"
echo "✓ Users registered correctly"
echo "✓ Negotiation created successfully"
echo "✓ Correct user IDs stored"
echo ""
echo "Both Alex and Sarah should be able to see this negotiation."
echo ""
echo "To verify in browser:"
echo "1. Open http://localhost:3000 and login as Alex"
echo "2. Go to Messages - should see Sarah conversation"
echo "3. Open incognito, login as Sarah"
echo "4. Go to Messages - should see Alex conversation"
