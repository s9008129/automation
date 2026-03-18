#!/usr/bin/env bash
set -euo pipefail

BROWSER="chrome"
PORT="9222"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --browser)
      BROWSER="${2:-chrome}"
      shift 2
      ;;
    --port)
      PORT="${2:-9222}"
      shift 2
      ;;
    *)
      if [[ "$1" =~ ^[0-9]+$ ]]; then
        PORT="$1"
        shift
      else
        echo "Unsupported argument: $1" >&2
        exit 1
      fi
      ;;
  esac
done

if [[ "$BROWSER" != "chrome" && "$BROWSER" != "edge" ]]; then
  echo "Unsupported browser: $BROWSER" >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="$ROOT_DIR/logs"
PROFILE_DIR="$ROOT_DIR/${BROWSER}-debug-profile"
DISPLAY_NAME="Google Chrome"
BINARY=""
if [[ "$BROWSER" == "edge" ]]; then
  DISPLAY_NAME="Microsoft Edge"
fi

mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/launch-${BROWSER}-$(TZ=Asia/Taipei date +"%Y%m%d-%H%M%S").log"

log() {
  local level="$1"; shift
  local msg="$*"
  local ts
  ts="$(TZ=Asia/Taipei date +"%Y-%m-%d %H:%M:%S")"
  echo "[$ts][$level] $msg" | tee -a "$LOG_FILE"
}

find_browser_binary() {
  if [[ "$BROWSER" == "edge" ]]; then
    for p in \
      "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge" \
      "$HOME/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"; do
      if [[ -x "$p" ]]; then
        printf '%s' "$p"
        return 0
      fi
    done
    if command -v microsoft-edge >/dev/null 2>&1; then
      command -v microsoft-edge
      return 0
    fi
    if command -v microsoft-edge-stable >/dev/null 2>&1; then
      command -v microsoft-edge-stable
      return 0
    fi
  else
    for p in \
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
      "$HOME/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
      "/Applications/Chromium.app/Contents/MacOS/Chromium"; do
      if [[ -x "$p" ]]; then
        printf '%s' "$p"
        return 0
      fi
    done
    if command -v google-chrome >/dev/null 2>&1; then
      command -v google-chrome
      return 0
    fi
    if command -v chromium >/dev/null 2>&1; then
      command -v chromium
      return 0
    fi
  fi
  return 1
}

log INFO "Script: $0"
log INFO "Browser: $BROWSER"
log INFO "Port: $PORT"
log INFO "ProfileDir: $PROFILE_DIR"
log INFO "LogFile: $LOG_FILE"

if command -v lsof >/dev/null 2>&1; then
  if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    PID="$(lsof -nP -iTCP:"$PORT" -sTCP:LISTEN -t | head -n 1 || true)"
    CMD="$(ps -p "$PID" -o command= 2>/dev/null || true)"
    if [[ "$CMD" == *"$PROFILE_DIR"* ]]; then
      log INFO "✅ ${DISPLAY_NAME} Debug 模式已在運行（PID: $PID）"
      log INFO "驗證網址: http://localhost:${PORT}/json/version"
      exit 0
    fi
    log WARN "⚠️  端口 $PORT 已被其他程式占用（PID: $PID）"
    exit 1
  fi
fi

if ! BINARY="$(find_browser_binary)"; then
  log ERROR "❌ 找不到 ${DISPLAY_NAME}"
  exit 1
fi

log INFO "🚀 啟動 ${DISPLAY_NAME} Debug 模式..."
"$BINARY" \
  --remote-debugging-port="$PORT" \
  --user-data-dir="$PROFILE_DIR" \
  --no-first-run \
  --no-default-browser-check \
  about:blank >/dev/null 2>&1 &

sleep 2

if command -v curl >/dev/null 2>&1; then
  for _ in 1 2 3 4 5; do
    if curl -s "http://localhost:${PORT}/json/version" >/dev/null 2>&1; then
      log INFO "✅ ${DISPLAY_NAME} Debug 模式已成功啟動"
      log INFO "驗證網址: http://localhost:${PORT}/json/version"
      if [[ "$BROWSER" == "edge" ]]; then
        log INFO "下一步: 啟動 RPA-Cowork 時請帶 --browser edge"
      fi
      exit 0
    fi
    sleep 1
  done
fi

log WARN "⚠️  ${DISPLAY_NAME} 已啟動但尚未就緒，請稍候再試"
log WARN "驗證網址: http://localhost:${PORT}/json/version"
