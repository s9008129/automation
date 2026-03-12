#!/usr/bin/env bash
# Git pre-commit 掃描腳本：
# 目的：在提交前檢查 materials/recordings/*.ts 是否疑似含敏感資訊。
# 行為：若有命中規則則以 exit 1 阻擋 commit。
set -euo pipefail

EXIT_CODE=0
# 可疑字串規則：涵蓋硬編碼密碼、token、secret 等常見型態。
PATTERNS=(
  "\\.fill\\([^,]+,\\s*'[^']{4,}'\\)"
  "password\\s*[:=]\\s*['\"][^'\"]{4,}"
  "token\\s*[:=]\\s*['\"][^'\"]{4,}"
  "secret\\s*[:=]\\s*['\"][^'\"]{4,}"
)

# 若錄製資料夾不存在，代表沒有需掃描內容，直接放行。
if [[ ! -d "materials/recordings" ]]; then
  exit 0
fi

FILES=(materials/recordings/*.ts)
# 若沒有任何 ts 錄製檔，同樣直接放行。
if [[ "${FILES[0]}" == "materials/recordings/*.ts" ]]; then
  exit 0
fi

# 逐檔逐規則掃描，只要命中就標記失敗（但會繼續列出所有問題）。
for file in "${FILES[@]}"; do
  for pat in "${PATTERNS[@]}"; do
    if grep -E "$pat" "$file" >/dev/null 2>&1; then
      echo "❌ 敏感資訊偵測: $(basename "$file") 匹配模式 [$pat]"
      EXIT_CODE=1
    fi
  done
done

# 若有問題，顯示可理解的修復提示，再以非 0 code 結束阻擋 commit。
if [[ "$EXIT_CODE" -ne 0 ]]; then
  echo ""
  echo "🚫 commit 被阻止：錄製檔中偵測到疑似敏感資訊。"
  echo "   請執行 sanitizeRecording 清理後再 commit。"
  echo ""
fi

exit "$EXIT_CODE"
