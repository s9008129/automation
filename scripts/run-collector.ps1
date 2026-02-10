# 素材處理器 — 執行腳本 (PowerShell)
# 用法:
#   .\scripts\run-collector.ps1                       # 處理本地素材
#   .\scripts\run-collector.ps1 --cdp                 # 同時連接 CDP 擷取即時頁面
#   .\scripts\run-collector.ps1 --materials-dir .\materials --cdp-port 9222

$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $PSScriptRoot)

Write-Host "🏗️ 素材處理器 — Materials Collector" -ForegroundColor Cyan
Write-Host "======================================" -ForegroundColor Cyan

npx tsx src/materialsCollector.ts @args
