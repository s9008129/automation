<#
.SYNOPSIS
    互動式建立任務腳本骨架

.DESCRIPTION
    引導使用者輸入任務名稱與系統代碼，自動從範本建立任務腳本，
    並放置到正確的 src\ 目錄，讓你可以立即開始編輯或交給 AI 修改。

.EXAMPLE
    .\new-task.ps1
    .\new-task.ps1 -SystemCode qiz -TaskName 批次簽核

.NOTES
    生成的腳本放在 src\ 目錄，命名格式：src\{系統代碼}-{任務名稱}.ts
#>

[CmdletBinding()]
param(
    [Parameter(Position = 0)]
    [string]$SystemCode = "",

    [Parameter(Position = 1)]
    [string]$TaskName = ""
)

Set-StrictMode -Version 3.0
$ErrorActionPreference = "Stop"

$ProjectRoot = [System.IO.Path]::GetFullPath($PSScriptRoot)
$TemplatePath = Join-Path $ProjectRoot "templates\task-template.ts"
$SrcDir = Join-Path $ProjectRoot "src"

# ────────────────────────────────────────────────────────────
# 檢查範本存在
# ────────────────────────────────────────────────────────────

if (-not (Test-Path -Path $TemplatePath -PathType Leaf)) {
    Write-Host "❌ 找不到任務範本：templates\task-template.ts" -ForegroundColor Red
    Write-Host "請確認離線包完整。" -ForegroundColor Yellow
    exit 1
}

# ────────────────────────────────────────────────────────────
# 顯示歡迎訊息
# ────────────────────────────────────────────────────────────

Write-Host "" -ForegroundColor White
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "  🤖 RPA-Cowork：建立新任務腳本" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "" -ForegroundColor White
Write-Host "此工具將協助你從範本建立新的任務腳本骨架。" -ForegroundColor White
Write-Host "建立後，你可以自行編輯，或把內容交給 AI 修改完善。" -ForegroundColor White
Write-Host "" -ForegroundColor White

# ────────────────────────────────────────────────────────────
# 詢問系統代碼
# ────────────────────────────────────────────────────────────

if ([string]::IsNullOrWhiteSpace($SystemCode)) {
    Write-Host "📌 請輸入系統代碼（例如：qiz、eip、vst）" -ForegroundColor White
    Write-Host "   （這是腳本檔名的前綴，用來識別哪個系統）" -ForegroundColor Gray
    $SystemCode = Read-Host "   系統代碼"
}

$SystemCode = $SystemCode.Trim().ToLower()
if ([string]::IsNullOrWhiteSpace($SystemCode)) {
    Write-Host "❌ 系統代碼不能為空。" -ForegroundColor Red
    exit 1
}

# ────────────────────────────────────────────────────────────
# 詢問任務名稱
# ────────────────────────────────────────────────────────────

if ([string]::IsNullOrWhiteSpace($TaskName)) {
    Write-Host "" -ForegroundColor White
    Write-Host "📌 請輸入任務名稱（例如：批次簽核、公文匯出、資料查詢）" -ForegroundColor White
    Write-Host "   （中文或英文皆可）" -ForegroundColor Gray
    $TaskName = Read-Host "   任務名稱"
}

$TaskName = $TaskName.Trim()
if ([string]::IsNullOrWhiteSpace($TaskName)) {
    Write-Host "❌ 任務名稱不能為空。" -ForegroundColor Red
    exit 1
}

# ────────────────────────────────────────────────────────────
# 計算輸出路徑
# ────────────────────────────────────────────────────────────

$ScriptName = "$SystemCode-$TaskName.ts"
$OutputPath = Join-Path $SrcDir $ScriptName

# 確認 src\ 目錄存在
if (-not (Test-Path -Path $SrcDir -PathType Container)) {
    New-Item -ItemType Directory -Force -Path $SrcDir | Out-Null
}

# 確認目標不存在
if (Test-Path -Path $OutputPath -PathType Leaf) {
    Write-Host "" -ForegroundColor White
    Write-Host "⚠️  腳本已存在：src\$ScriptName" -ForegroundColor Yellow
    Write-Host "   要覆蓋現有腳本嗎？（輸入 y 繼續，其他鍵取消）" -ForegroundColor White
    $confirm = Read-Host "   確認"
    if ($confirm.Trim().ToLower() -ne "y") {
        Write-Host "已取消。" -ForegroundColor White
        exit 0
    }
}

# ────────────────────────────────────────────────────────────
# 從範本建立腳本
# ────────────────────────────────────────────────────────────

$templateContent = Get-Content -Path $TemplatePath -Raw -Encoding UTF8

# 替換範本中的佔位符（使用 .Replace() 確保字面替換，避免正規表示式特殊字元問題）
$scriptContent = $templateContent.Replace(
    "const TASK_NAME = '任務名稱'",
    ("const TASK_NAME = '" + $TaskName.Replace("'", "''") + "'")
).Replace(
    "📋 任務腳本範本",
    ("📋 $SystemCode-$TaskName 任務腳本")
)

[System.IO.File]::WriteAllText($OutputPath, $scriptContent, [System.Text.Encoding]::UTF8)

# ────────────────────────────────────────────────────────────
# 顯示完成訊息
# ────────────────────────────────────────────────────────────

Write-Host "" -ForegroundColor White
Write-Host "✅ 腳本已建立：src\$ScriptName" -ForegroundColor Green
Write-Host "" -ForegroundColor White
Write-Host "下一步：" -ForegroundColor White
Write-Host "  1. 準備同一次任務的 materials\ 附件（ARIA 快照、截圖、錄製檔等）" -ForegroundColor White
Write-Host "  2. 打開 docs\使用指南.md，照『請 AI 幫你做腳本』那一節操作" -ForegroundColor White
Write-Host "  3. 把 src\$ScriptName 和同一次附件一起交給 AI，請 AI 直接補完這個檔案" -ForegroundColor White
Write-Host "  4. 若腳本需要帳號密碼，先設定 .env 檔案：" -ForegroundColor White
Write-Host "       Copy-Item .env.example .env" -ForegroundColor Cyan
Write-Host "       notepad .env" -ForegroundColor Cyan
Write-Host "  5. 完成後執行任務：" -ForegroundColor White
Write-Host "       .\run-task.ps1 src\$ScriptName" -ForegroundColor Cyan
Write-Host "" -ForegroundColor White
Write-Host "如需 AI 協作的詳細說明，請參考：" -ForegroundColor White
Write-Host "  docs\使用指南.md" -ForegroundColor Cyan
Write-Host "" -ForegroundColor White
