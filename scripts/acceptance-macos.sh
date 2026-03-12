#!/usr/bin/env bash
# macOS 驗收流程腳本：
# 1) 啟動 Chrome Debug
# 2) 導航到指定頁面
# 3) 擷取 ARIA 快照
# 4) 啟動 Codegen 錄製並驗證產物
# 可加 --offline 改走本地 mock 網站，避免依賴外網。
set -euo pipefail

# 參數解析：預設 online，帶入 --offline 則改為離線驗證模式。
MODE="online"
if [[ "${1:-}" == "--offline" ]]; then
  MODE="offline"
fi

# 驗收所需參數：CDP 連接埠、錄製名稱、線上/離線目標網址。
PORT="${CDP_PORT:-9222}"
RECORD_NAME="acceptance-record"
ARTICLE_TITLE="如何在 Windows 安裝和設定 Cloudflare Tunnel 服務"
ONLINE_START="https://blog.miniasp.com"
ONLINE_TARGET="https://blog.miniasp.com/post/2026/02/08/How-to-install-and-set-up-Cloudflare-Tunnel-service-on-Windows"
MOCK_PORT=4173
MOCK_START="http://127.0.0.1:${MOCK_PORT}"
MOCK_TARGET="${MOCK_START}/article.html"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# 環境檢查：確認 Playwright 套件存在，避免後續命令失敗。
if [[ ! -d "$ROOT_DIR/node_modules/playwright" ]]; then
  echo "❌ 找不到 Playwright 套件（$ROOT_DIR/node_modules/playwright）"
  echo "請先執行：npm install 或 npm run setup（離線請先在有網路環境安裝 node_modules）"
  exit 1
fi

# 再次防呆檢查（保留既有行為），確保缺少 Playwright 時立即中止。
if [[ ! -d "$ROOT_DIR/node_modules/playwright" ]]; then
  echo "❌ 找不到 Playwright 套件（$ROOT_DIR/node_modules/playwright）"
  echo "請先執行：npm install 或 npm run setup（離線請先在有網路環境安裝 node_modules）"
  exit 1
fi

# 啟動（或重用）Chrome Debug，後續工具會透過 CDP 連線。
echo "==> 啟動 Chrome Debug（Port: ${PORT}）"
"$ROOT_DIR/scripts/launch-chrome.sh" --port "$PORT"

# 離線模式：啟動本地 mock server，並在腳本結束時自動停止。
if [[ "$MODE" == "offline" ]]; then
  echo "==> 啟動 mock server（Port: $MOCK_PORT）"
  MOCK_PID="$("$ROOT_DIR/scripts/mock-server.sh" "$MOCK_PORT")"
  trap 'kill '"$MOCK_PID"' >/dev/null 2>&1 || true' EXIT
  START_URL="$MOCK_START"
  TARGET_URL="$MOCK_TARGET"
else
  START_URL="$ONLINE_START"
  TARGET_URL="$ONLINE_TARGET"
fi

# 自動把 Chrome 導到目標頁，減少手動操作。
echo "==> 自動導航到目標頁面：$ARTICLE_TITLE"
node "$ROOT_DIR/scripts/cdp-open-url.mjs" "$PORT" "$START_URL" "$TARGET_URL"

# 先記錄時間戳，後續只驗證本次新產生的 ARIA 素材。
ARIA_SINCE="$(node -e 'console.log(Date.now())')"
echo "==> 擷取 ARIA 快照（自動名稱）"
printf '\n' | npm run collect:snapshot -- --port "$PORT"
node "$ROOT_DIR/scripts/verify-materials.mjs" --aria --since "$ARIA_SINCE"

# 啟動錄製流程，使用者操作完成並關閉視窗後再驗證錄製檔。
echo "==> 啟動 Codegen 錄製（請在新視窗操作後關閉）"
printf '\n' | npx tsx "$ROOT_DIR/collect-materials.ts" --record "$RECORD_NAME" --url "$TARGET_URL" --port "$PORT"
node "$ROOT_DIR/scripts/verify-materials.mjs" --record "$RECORD_NAME"

echo "✅ 驗收完成"
