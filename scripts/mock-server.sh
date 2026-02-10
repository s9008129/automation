#!/usr/bin/env bash
set -euo pipefail

PORT="${1:-4173}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SITE_DIR="$ROOT_DIR/scripts/mock-site"
LOG_DIR="$ROOT_DIR/logs"

mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/mock-server-$(TZ=Asia/Taipei date +"%Y%m%d-%H%M%S").log"

if ! command -v python3 >/dev/null 2>&1; then
  echo "❌ 需要 python3 以啟動 mock server"
  exit 1
fi

python3 -m http.server "$PORT" --directory "$SITE_DIR" >>"$LOG_FILE" 2>&1 &
echo $!
