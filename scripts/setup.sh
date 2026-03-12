#!/usr/bin/env bash
# 安裝/檢查初始化腳本（macOS/Linux）
# - 預設：安裝 npm 套件與 Playwright Chromium
# - --offline：只檢查離線執行必需資源，不進行任何下載
set -euo pipefail

# 參數解析：帶入 --offline 時切換成離線檢查模式。
OFFLINE=0
if [[ "${1:-}" == "--offline" ]]; then
  OFFLINE=1
fi

# 取得專案根目錄與日誌路徑，確保從任何位置執行都能找到正確檔案。
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
LOG_DIR="$ROOT_DIR/logs"

# 先建立 logs 目錄，再用台北時間建立本次執行的日誌檔名。
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/setup-$(TZ=Asia/Taipei date +"%Y%m%d-%H%M%S").log"

# 統一日誌格式：時間 + 等級 + 訊息，同步輸出到畫面與 log 檔。
log() {
  local level="$1"; shift
  local msg="$*"
  local ts
  ts="$(TZ=Asia/Taipei date +"%Y-%m-%d %H:%M:%S")"
  echo "[$ts][$level] $msg" | tee -a "$LOG_FILE"
}

# 先記錄執行環境，方便後續排錯。
log "INFO" "Script: $0"
log "INFO" "OS: $(uname -a)"
log "INFO" "CWD: $ROOT_DIR"
log "INFO" "LogFile: $LOG_FILE"
log "INFO" "Offline: $OFFLINE"

# 環境檢查 1：必須有 Node.js。
if ! command -v node >/dev/null 2>&1; then
  log "ERROR" "❌ 找不到 Node.js（需要 v20+）"
  exit 1
fi

# 環境檢查 2：Node.js 主版本需 >= 20。
NODE_VERSION="$(node -v | tr -d 'v')"
NODE_MAJOR="${NODE_VERSION%%.*}"
if [[ "$NODE_MAJOR" -lt 20 ]]; then
  log "ERROR" "❌ Node.js 版本過低: v$NODE_VERSION（需要 v20+）"
  exit 1
fi
log "INFO" "✅ Node.js v$NODE_VERSION"

# 切換到專案根目錄，避免相對路徑出錯。
cd "$ROOT_DIR"

# 離線模式：只驗證必要資源是否存在，不執行任何安裝。
if [[ "$OFFLINE" -eq 1 ]]; then
  # 檢查 node_modules 是否已預先準備好。
  if [[ ! -d "$ROOT_DIR/node_modules" ]]; then
    log "ERROR" "❌ 離線模式需要已存在的 node_modules"
    log "ERROR" "請先在有網路環境執行: npm install"
    exit 1
  fi
  log "INFO" "✅ node_modules 已存在"

  # 檢查常見的 Playwright 瀏覽器快取位置，找到任一個即可。
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
  # 沒找到時給出警告與建議，不直接中止（讓使用者自行判斷後續）。
  if [[ "$FOUND_PW" -eq 0 ]]; then
    log "WARN" "⚠️  找不到 Playwright 瀏覽器目錄"
    log "WARN" "建議在有網路環境執行: npx playwright install chromium"
    log "WARN" "或預先下載後放置於: $ROOT_DIR/.playwright-browsers 並設定 PLAYWRIGHT_BROWSERS_PATH"
  fi
  exit 0
fi

# 線上模式：安裝 npm 套件。
log "INFO" "➜ 執行 npm install"
npm install 2>&1 | tee -a "$LOG_FILE"

# 線上模式：安裝 Playwright Chromium 執行檔。
log "INFO" "➜ 安裝 Playwright Chromium"
npx playwright install chromium 2>&1 | tee -a "$LOG_FILE"

log "INFO" "✅ 安裝完成"
log "INFO" "下一步: npm run start:chrome"
