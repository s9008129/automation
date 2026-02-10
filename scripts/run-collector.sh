#!/usr/bin/env bash
# 素材處理器 — 執行腳本
# 用法:
#   ./scripts/run-collector.sh                       # 處理本地素材
#   ./scripts/run-collector.sh --cdp                 # 同時連接 CDP 擷取即時頁面
#   ./scripts/run-collector.sh --materials-dir ./materials --cdp-port 9222

set -euo pipefail
cd "$(dirname "$0")/.."

echo "🏗️ 素材處理器 — Materials Collector"
echo "======================================"

# 執行處理器
npx tsx src/materialsCollector.ts "$@"
