#!/usr/bin/env bash
# 本地 mock server 啟動腳本：
# - 以 Python 內建 http.server 提供 scripts/mock-site 靜態頁
# - 成功後輸出 PID，讓呼叫端可在結束時關閉服務
set -euo pipefail

# 參數解析：可傳入 Port，未提供時預設 4173。
PORT="${1:-4173}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SITE_DIR="$ROOT_DIR/scripts/mock-site"
LOG_DIR="$ROOT_DIR/logs"

# 建立日誌目錄並用台北時間命名 log 檔。
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/mock-server-$(TZ=Asia/Taipei date +"%Y%m%d-%H%M%S").log"

# 環境檢查：此腳本依賴 python3。
if ! command -v python3 >/dev/null 2>&1; then
  echo "❌ 需要 python3 以啟動 mock server"
  exit 1
fi

# 背景啟動靜態伺服器並回傳 PID（stdout），供外部 trap/kill 使用。
python3 -m http.server "$PORT" --directory "$SITE_DIR" >>"$LOG_FILE" 2>&1 &
echo $!
