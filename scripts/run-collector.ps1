# 素材處理器 — 執行腳本 (PowerShell)
# 用法:
#   .\scripts\run-collector.ps1                       # 處理本地素材
#   .\scripts\run-collector.ps1 --cdp                 # 同時連接 CDP 擷取即時頁面
#   .\scripts\run-collector.ps1 --materials-dir .\materials --cdp-port 9222

# 一旦發生錯誤就中止：避免上一步失敗卻還繼續往下執行。
$ErrorActionPreference = "Stop"

# 切回專案根目錄再執行，確保相對路徑（src/、materials/）都正確。
Set-Location (Split-Path -Parent $PSScriptRoot)

# 友善輸出：讓使用者清楚知道腳本已開始執行。
Write-Host "🏗️ 素材處理器 — Materials Collector" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan

# 命令呼叫：把 CLI 參數原封不動傳給 TypeScript 主程式（@args 為參數透傳）。
# 範例：--cdp、--materials-dir、--cdp-port 都會直接交給 materialsCollector.ts。
npx tsx src/materialsCollector.ts @args
