#!/usr/bin/env bash
set -euo pipefail

EXIT_CODE=0
PATTERNS=(
  "\\.fill\\([^,]+,\\s*'[^']{4,}'\\)"
  "password\\s*[:=]\\s*['\"][^'\"]{4,}"
  "token\\s*[:=]\\s*['\"][^'\"]{4,}"
  "secret\\s*[:=]\\s*['\"][^'\"]{4,}"
)

if [[ ! -d "materials/recordings" ]]; then
  exit 0
fi

FILES=(materials/recordings/*.ts)
if [[ "${FILES[0]}" == "materials/recordings/*.ts" ]]; then
  exit 0
fi

for file in "${FILES[@]}"; do
  for pat in "${PATTERNS[@]}"; do
    if grep -E "$pat" "$file" >/dev/null 2>&1; then
      echo "❌ 敏感資訊偵測: $(basename "$file") 匹配模式 [$pat]"
      EXIT_CODE=1
    fi
  done
done

if [[ "$EXIT_CODE" -ne 0 ]]; then
  echo ""
  echo "🚫 commit 被阻止：錄製檔中偵測到疑似敏感資訊。"
  echo "   請執行 sanitizeRecording 清理後再 commit。"
  echo ""
fi

exit "$EXIT_CODE"
