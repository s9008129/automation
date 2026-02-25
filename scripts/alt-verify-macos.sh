#!/usr/bin/env bash
# 備援驗證腳本（macOS）：
# 透過 CDP + AppleScript 收集頁面素材（ARIA/HTML/截圖），
# 適用於需要手動登入後再匯出的情境。
set -euo pipefail

# 參數與預設值：可用環境變數覆蓋 PORT/TARGET_URL/OUT_DIR。
PORT="${PORT:-9222}"
TARGET_URL="${TARGET_URL:-https://blog.miniasp.com/post/2026/02/08/How-to-install-and-set-up-Cloudflare-Tunnel-service-on-Windows}"
OUT_DIR="${OUT_DIR:-materials/alt-verify-$(TZ=Asia/Taipei date +%Y%m%d-%H%M%S)}"

# 建立輸出目錄，所有產物都會集中放在此資料夾。
mkdir -p "$OUT_DIR"

# 先確認 CDP 可連線，避免後續流程執行到一半才失敗。
if ! curl -sf "http://localhost:${PORT}/json/version" > "$OUT_DIR/cdp-version.json"; then
  echo "❌ CDP 未啟動或不可達 (port ${PORT})" >&2
  exit 1
fi

# 記錄操作開始時間，供後續追蹤與稽核。
START_TS="$(TZ=Asia/Taipei date +"%Y-%m-%d %H:%M:%S")"

# 用 AppleScript 打開 Chrome 並導到目標網址（沿用現有視窗/分頁）。
osascript <<APPLESCRIPT
tell application "Google Chrome"
  if not (exists window 1) then make new window
  set URL of active tab of window 1 to "${TARGET_URL}"
  activate
end tell
APPLESCRIPT

# 等待使用者手動完成登入或必要操作，再按 Enter 繼續匯出素材。
echo "請完成登入與操作後按 Enter 產生快照"
read -r

# 記錄結束時間與目標網址，形成簡易操作紀錄檔。
END_TS="$(TZ=Asia/Taipei date +"%Y-%m-%d %H:%M:%S")"
printf "start=%s\nend=%s\nurl=%s\n" "$START_TS" "$END_TS" "$TARGET_URL" > "$OUT_DIR/recording.log"

# 匯出 ARIA 相關屬性快照，讓後續 AI/自動化更容易分析語意結構。
osascript <<'APPLESCRIPT' > "$OUT_DIR/aria-snapshot.json"
tell application "Google Chrome"
  set js to "(() => { const items = []; document.querySelectorAll('*').forEach(el => { const attrs = {}; let has = false; for (const a of el.attributes) { if (a.name === 'role' || a.name.startsWith('aria-')) { attrs[a.name]=a.value; has = true; } } if (has) { items.push({ tag: el.tagName, text: (el.innerText || '').trim().slice(0,120), attrs }); } }); return JSON.stringify({ url: location.href, items }, null, 2); })()"
  return execute active tab of window 1 javascript js
end tell
APPLESCRIPT

# 匯出完整 HTML 原始碼，便於離線比對或重建情境。
osascript <<'APPLESCRIPT' > "$OUT_DIR/page.html"
tell application "Google Chrome"
  return execute active tab of window 1 javascript "document.documentElement.outerHTML"
end tell
APPLESCRIPT

# 擷取當前畫面截圖（不顯示截圖 UI），補足視覺證據。
screencapture -x "$OUT_DIR/screenshot.png"

# 最終輸出摘要，方便非技術人員快速確認成果位置。
echo "✅ 產出：$OUT_DIR/cdp-version.json, aria-snapshot.json, page.html, screenshot.png, recording.log"
