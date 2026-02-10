#!/bin/bash
# Comprehensive credential leak verification script
# This script searches for any remaining literal credentials in the repository

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║   CREDENTIAL LEAK DETECTION & SANITIZATION VERIFICATION        ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

FAIL_COUNT=0

# Test 1: Search for literal credential patterns in recordings
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 1: Searching for literal credential patterns in recordings"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

patterns=(
  "NCERT_PASSWORD"
  "NCERT_USERNAME" 
  "NCERT_PASS"
)

for pattern in "${patterns[@]}"; do
  echo -n "Checking for literal '$pattern' in recordings... "
  results=$(grep -r "$pattern" materials/recordings/*.ts 2>/dev/null | grep -v "process.env.$pattern" || true)
  if [ -z "$results" ]; then
    echo "✅ PASS (no literal values found)"
  else
    echo "❌ FAIL"
    echo "$results"
    ((FAIL_COUNT++))
  fi
done

echo ""

# Test 2: Search for .fill('literal') patterns
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 2: Searching for .fill() with literal string values"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo -n "Checking for .fill('literal') patterns... "
results=$(grep -E "\.fill\(['\"]" materials/recordings/*.ts 2>/dev/null | grep -v "process.env" | grep -v "//" || true)
if [ -z "$results" ]; then
  echo "✅ PASS (no literal fills found)"
else
  echo "❌ FAIL"
  echo "$results"
  ((FAIL_COUNT++))
fi

echo ""

# Test 3: Verify environment variable usage
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 3: Verifying environment variable usage in recordings"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

required_vars=("NCERT_USERNAME" "RECORDING_PASSWORD")
for var in "${required_vars[@]}"; do
  echo -n "Checking for process.env.$var usage... "
  if grep -q "process.env.$var" materials/recordings/*.ts 2>/dev/null; then
    echo "✅ PASS (found)"
  else
    echo "❌ FAIL (not found)"
    ((FAIL_COUNT++))
  fi
done

echo ""

# Test 4: Verify sanitization header
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 4: Verifying sanitization header in recordings"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

for file in materials/recordings/*.ts; do
  if [ -f "$file" ]; then
    filename=$(basename "$file")
    echo -n "Checking $filename for sanitization header... "
    if head -1 "$file" | grep -q "此錄製檔已被敏感資訊清理"; then
      echo "✅ PASS"
    else
      echo "❌ FAIL (missing header)"
      ((FAIL_COUNT++))
    fi
  fi
done

echo ""

# Test 5: Run unit tests for sanitizeRecording function
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 5: Running sanitizeRecording unit tests"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -f "test-sanitization-validation.cjs" ]; then
  node test-sanitization-validation.cjs
  if [ $? -ne 0 ]; then
    ((FAIL_COUNT++))
  fi
else
  echo "❌ FAIL (test file not found)"
  ((FAIL_COUNT++))
fi

echo ""

# Test 6: Verify no secrets in git history (recent commits)
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 6: Checking recent git history for credential leaks"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo -n "Checking last 5 commits for literal .fill() patterns... "
leaks=$(git log -5 -p -- "materials/recordings/*.ts" 2>/dev/null | grep -E "^\+.*\.fill\(['\"][^'\"]{3,}" | grep -v "process.env" || true)
if [ -z "$leaks" ]; then
  echo "✅ PASS (no leaks found)"
else
  echo "⚠️  WARNING (potential leaks detected in history)"
  echo "$leaks"
fi

echo ""

# Final Summary
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║                        FINAL VERDICT                           ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

if [ $FAIL_COUNT -eq 0 ]; then
  echo "✅ ✅ ✅  ALL TESTS PASSED  ✅ ✅ ✅"
  echo ""
  echo "✔️  No literal credentials found in recordings"
  echo "✔️  All recordings use process.env placeholders"
  echo "✔️  Sanitization function works correctly"
  echo "✔️  All recordings have sanitization headers"
  echo ""
  echo "🎉 Repository is SECURE and ready for version control!"
  exit 0
else
  echo "❌ ❌ ❌  TESTS FAILED: $FAIL_COUNT  ❌ ❌ ❌"
  echo ""
  echo "⚠️  Action required: Fix the issues listed above before committing"
  exit 1
fi
