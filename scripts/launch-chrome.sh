#!/usr/bin/env bash
set -euo pipefail

PORT="9222"
if [[ "${1:-}" == "--port" && -n "${2:-}" ]]; then
  PORT="$2"
elif [[ "${1:-}" =~ ^[0-9]+$ ]]; then
  PORT="$1"
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="$ROOT_DIR/logs"
PROFILE_DIR="$ROOT_DIR/chrome-debug-profile"

mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/launch-chrome-$(TZ=Asia/Taipei date +"%Y%m%d-%H%M%S").log"

log() {
  local level="$1"; shift
  local msg="$*"
  local ts
  ts="$(TZ=Asia/Taipei date +"%Y-%m-%d %H:%M:%S")"
  echo "[$ts][$level] $msg" | tee -a "$LOG_FILE"
}

log "INFO" "Script: $0"
log "INFO" "OS: $(uname -a)"
log "INFO" "Port: $PORT"
log "INFO" "ProfileDir: $PROFILE_DIR"
log "INFO" "LogFile: $LOG_FILE"

if command -v lsof >/dev/null 2>&1; then
  if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    PID="$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t | head -n 1 || true)"
    CMD="$(ps -p "$PID" -o command= 2>/dev/null || true)"
    if [[ "$CMD" == *"$PROFILE_DIR"* ]]; then
      log "INFO" "✅ Chrome Debug 模式已在運行（PID: $PID）"
      log "INFO" "驗證網址: http://localhost:${PORT}/json/version"
      exit 0
    fi
    log "WARN" "⚠️  端口 $PORT 已被其他程式占用（PID: $PID）"
    log "WARN" "請關閉該程式或改用其他端口：--port 9223"
    exit 1
  fi
fi

CHROME_BIN=""
for p in \
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  "$HOME/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  "/Applications/Chromium.app/Contents/MacOS/Chromium"; do
  if [[ -x "$p" ]]; then
    CHROME_BIN="$p"
    break
  fi
done

if [[ -z "$CHROME_BIN" ]]; then
  log "ERROR" "❌ 找不到 Google Chrome 或 Chromium"
  log "ERROR" "請確認 Chrome 已安裝於 /Applications/Google Chrome.app"
  exit 1
fi

log "INFO" "🚀 啟動 Chrome Debug 模式..."
"$CHROME_BIN" \
  --remote-debugging-port="$PORT" \
  --user-data-dir="$PROFILE_DIR" \
  --no-first-run \
  --no-default-browser-check \
  "about:blank" >/dev/null 2>&1 &

sleep 2

if command -v curl >/dev/null 2>&1; then
  for _ in 1 2 3 4 5; do
    if curl -s "http://localhost:${PORT}/json/version" >/dev/null 2>&1; then
      log "INFO" "✅ Chrome Debug 模式已成功啟動"
      log "INFO" "驗證網址: http://localhost:${PORT}/json/version"
      log "INFO" "下一步: 在 Chrome 中登入內部網站，然後執行 npm run collect"
      exit 0
    fi
    sleep 1
  done
fi

log "WARN" "⚠️  Chrome 已啟動但尚未就緒，請稍候再試"
log "WARN" "驗證網址: http://localhost:${PORT}/json/version"
