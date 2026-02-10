#!/usr/bin/env bash
set -euo pipefail

OFFLINE=0
if [[ "${1:-}" == "--offline" ]]; then
  OFFLINE=1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="$ROOT_DIR/logs"

mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/setup-$(TZ=Asia/Taipei date +"%Y%m%d-%H%M%S").log"

log() {
  local level="$1"; shift
  local msg="$*"
  local ts
  ts="$(TZ=Asia/Taipei date +"%Y-%m-%d %H:%M:%S")"
  echo "[$ts][$level] $msg" | tee -a "$LOG_FILE"
}

log "INFO" "Script: $0"
log "INFO" "OS: $(uname -a)"
log "INFO" "CWD: $ROOT_DIR"
log "INFO" "LogFile: $LOG_FILE"
log "INFO" "Offline: $OFFLINE"

if ! command -v node >/dev/null 2>&1; then
  log "ERROR" "❌ 找不到 Node.js（需要 v20+）"
  exit 1
fi

NODE_VERSION="$(node -v | tr -d 'v')"
NODE_MAJOR="${NODE_VERSION%%.*}"
if [[ "$NODE_MAJOR" -lt 20 ]]; then
  log "ERROR" "❌ Node.js 版本過低: v$NODE_VERSION（需要 v20+）"
  exit 1
fi
log "INFO" "✅ Node.js v$NODE_VERSION"

cd "$ROOT_DIR"

if [[ "$OFFLINE" -eq 1 ]]; then
  if [[ ! -d "$ROOT_DIR/node_modules" ]]; then
    log "ERROR" "❌ 離線模式需要已存在的 node_modules"
    log "ERROR" "請先在有網路環境執行: npm install"
    exit 1
  fi
  log "INFO" "✅ node_modules 已存在"

  PW_PATHS=()
  [[ -n "${PLAYWRIGHT_BROWSERS_PATH:-}" ]] && PW_PATHS+=("$PLAYWRIGHT_BROWSERS_PATH")
  PW_PATHS+=("$ROOT_DIR/.playwright-browsers")
  PW_PATHS+=("$HOME/Library/Caches/ms-playwright")
  PW_PATHS+=("$HOME/.cache/ms-playwright")

  FOUND_PW=0
  for p in "${PW_PATHS[@]}"; do
    if [[ -d "$p" ]]; then
      log "INFO" "✅ Playwright 瀏覽器路徑: $p"
      FOUND_PW=1
      break
    fi
  done
  if [[ "$FOUND_PW" -eq 0 ]]; then
    log "WARN" "⚠️  找不到 Playwright 瀏覽器目錄"
    log "WARN" "建議在有網路環境執行: npx playwright install chromium"
    log "WARN" "或預先下載後放置於: $ROOT_DIR/.playwright-browsers 並設定 PLAYWRIGHT_BROWSERS_PATH"
  fi
  exit 0
fi

log "INFO" "➜ 執行 npm install"
npm install 2>&1 | tee -a "$LOG_FILE"

log "INFO" "➜ 安裝 Playwright Chromium"
npx playwright install chromium 2>&1 | tee -a "$LOG_FILE"

log "INFO" "✅ 安裝完成"
log "INFO" "下一步: npm run start:chrome"
