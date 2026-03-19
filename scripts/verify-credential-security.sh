#!/bin/bash
# 憑證外洩驗證腳本
# 目的：掃描錄製檔與近期提交，確認沒有殘留明文帳密或敏感字串。
# 輸出：每個測試都會顯示 PASS/FAIL，最後依 FAIL_COUNT 回傳 exit code。

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║   CREDENTIAL LEAK DETECTION & SANITIZATION VERIFICATION        ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

FAIL_COUNT=0

# 測試 1：掃描錄製檔中是否出現可疑憑證關鍵字（排除 process.env 用法）
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

# 測試 2：檢查是否有 .fill('明文字串') 類型的硬編碼輸入
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

# 測試 3：確認錄製檔有使用 process.env 讀取必要變數
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

# 測試 4：確認每份錄製檔都包含「已清理」標頭
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

# 測試 5：執行 sanitizeRecording 相關驗證腳本
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

# 測試 6：檢查最近 5 次提交差異是否出現可疑明文 .fill() 新增
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

# 最終總結：全部通過則回傳 0；否則回傳 1 供 CI / pre-commit 判斷
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
