#!/usr/bin/env bash
set -euo pipefail

MODE="online"
if [[ "${1:-}" == "--offline" ]]; then
  MODE="offline"
fi

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

if [[ ! -d "$ROOT_DIR/node_modules/playwright" ]]; then
  echo "❌ 找不到 Playwright 套件（$ROOT_DIR/node_modules/playwright）"
  echo "請先執行：npm install 或 npm run setup（離線請先在有網路環境安裝 node_modules）"
  exit 1
fi

if [[ ! -d "$ROOT_DIR/node_modules/playwright" ]]; then
  echo "❌ 找不到 Playwright 套件（$ROOT_DIR/node_modules/playwright）"
  echo "請先執行：npm install 或 npm run setup（離線請先在有網路環境安裝 node_modules）"
  exit 1
fi

echo "==> 啟動 Chrome Debug（Port: ${PORT}）"
"$ROOT_DIR/scripts/launch-chrome.sh" --port "$PORT"

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

echo "==> 自動導航到目標頁面：$ARTICLE_TITLE"
node "$ROOT_DIR/scripts/cdp-open-url.mjs" "$PORT" "$START_URL" "$TARGET_URL"

ARIA_SINCE="$(node -e 'console.log(Date.now())')"
echo "==> 擷取 ARIA 快照（自動名稱）"
printf '\n' | npm run collect:snapshot -- --port "$PORT"
node "$ROOT_DIR/scripts/verify-materials.mjs" --aria --since "$ARIA_SINCE"

echo "==> 啟動 Codegen 錄製（請在新視窗操作後關閉）"
printf '\n' | npx tsx "$ROOT_DIR/collect-materials.ts" --record "$RECORD_NAME" --url "$TARGET_URL" --port "$PORT"
node "$ROOT_DIR/scripts/verify-materials.mjs" --record "$RECORD_NAME"

echo "✅ 驗收完成"
