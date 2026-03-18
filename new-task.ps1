<#
.SYNOPSIS
    建立新的任務腳本（從標準範本複製）

.DESCRIPTION
    從 src\templates\task-template.ts 複製標準範本，
    建立新的任務腳本到 src\ 目錄，並提示後續步驟。

.PARAMETER TaskName
    任務腳本的名稱（例如：qiz-批次簽核），
    會自動加上 .ts 副檔名並存入 src\ 目錄。

.EXAMPLE
    .\new-task.ps1 qiz-批次簽核
    .\new-task.ps1 eip-公文簽核
#>

[CmdletBinding()]
param(
    [Parameter(Position = 0, Mandatory = $false)]
    [string]$TaskName
)

Set-StrictMode -Version 3.0
$ErrorActionPreference = "Stop"

$ProjectRoot = [System.IO.Path]::GetFullPath($PSScriptRoot)
$TemplateFile = Join-Path $ProjectRoot "src\templates\task-template.ts"
$SrcDir = Join-Path $ProjectRoot "src"

# ── 顯示使用說明 ──────────────────────────────────────────────

if (-not $TaskName) {
    Write-Host ""
    Write-Host "用法：" -ForegroundColor Cyan
    Write-Host "  .\new-task.ps1 <任務名稱>" -ForegroundColor White
    Write-Host ""
    Write-Host "範例：" -ForegroundColor Cyan
    Write-Host "  .\new-task.ps1 qiz-批次簽核" -ForegroundColor White
    Write-Host "  .\new-task.ps1 eip-公文簽核" -ForegroundColor White
    Write-Host ""
    Write-Host "說明：" -ForegroundColor Cyan
    Write-Host "  - 名稱建議格式：{系統代碼}-{任務名稱}" -ForegroundColor White
    Write-Host "  - 會在 src\ 目錄建立 {任務名稱}.ts" -ForegroundColor White
    Write-Host ""
    exit 0
}

# ── 驗證範本是否存在 ─────────────────────────────────────────

if (-not (Test-Path -Path $TemplateFile -PathType Leaf)) {
    Write-Host "❌ 找不到範本檔案：src\templates\task-template.ts" -ForegroundColor Red
    Write-Host "請確認安裝包完整。" -ForegroundColor Yellow
    exit 1
}

# ── 清理任務名稱 ─────────────────────────────────────────────

# 移除不安全字元，但保留中文、英文、數字、連字號
$SafeName = $TaskName -replace '[<>:"/\\|?*\x00-\x1f]', '_'
$SafeName = $SafeName.Trim()

if ([string]::IsNullOrWhiteSpace($SafeName)) {
    Write-Host "❌ 任務名稱無效，請輸入合法的檔案名稱。" -ForegroundColor Red
    exit 1
}

# ── 確認目標路徑 ─────────────────────────────────────────────

$TargetFile = Join-Path $SrcDir "$SafeName.ts"

if (Test-Path -Path $TargetFile -PathType Leaf) {
    Write-Host "⚠️  腳本已存在：src\$SafeName.ts" -ForegroundColor Yellow
    Write-Host "請直接編輯該檔案，或換一個名稱。" -ForegroundColor White
    exit 1
}

# ── 複製範本 ─────────────────────────────────────────────────

if (-not (Test-Path -Path $SrcDir -PathType Container)) {
    New-Item -ItemType Directory -Path $SrcDir -Force | Out-Null
}

Copy-Item -Path $TemplateFile -Destination $TargetFile

Write-Host ""
Write-Host "✅ 已建立任務腳本：src\$SafeName.ts" -ForegroundColor Green
Write-Host ""
Write-Host "接下來：" -ForegroundColor Cyan
Write-Host "  1. 用文字編輯器開啟 src\$SafeName.ts，根據你的任務修改腳本邏輯" -ForegroundColor White
Write-Host "  2. 確認 .env 已設定所需帳號密碼（參考 .env.example）" -ForegroundColor White
Write-Host "  3. 執行腳本：" -ForegroundColor White
Write-Host "     .\run-task.ps1 src\$SafeName.ts" -ForegroundColor Green
Write-Host ""
Write-Host "如需 AI 協助生成腳本邏輯，請參閱：" -ForegroundColor Cyan
Write-Host "  docs\AI協作工作流.md" -ForegroundColor White
Write-Host ""
