#!/usr/bin/env bash
# 素材處理器入口腳本：
# - 主要負責切到專案根目錄，再把參數原封不動交給 TypeScript 主程式。
# 用法：
#   ./scripts/run-collector.sh
#   ./scripts/run-collector.sh --cdp
#   ./scripts/run-collector.sh --materials-dir ./materials --cdp-port 9222

set -euo pipefail
# 固定到專案根目錄執行，避免從其他路徑啟動時找不到檔案。
cd "$(dirname "$0")/.."

echo "🏗️ 素材處理器 — Materials Collector"
echo "======================================"

# 執行主程式，"$@" 會把使用者傳入的所有參數完整轉交。
npx tsx src/materialsCollector.ts "$@"
