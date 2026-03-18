<#
.SYNOPSIS
    RPA 任務腳本執行入口（不依賴 npm / npx）

.DESCRIPTION
    透過專案內建 Node.js runtime 執行指定的 TypeScript 任務腳本。
    優先使用專案內建 Node.js runtime，再退回系統安裝。
    若安裝包不完整，會提示先執行 install.ps1 / setup.ps1。

.PARAMETER TaskScript
    要執行的 TypeScript 腳本路徑（相對於專案根目錄或絕對路徑），
    必須是 .ts 檔案，建議放在 src\ 目錄下。

.PARAMETER TaskArgs
    透傳給任務腳本的其他參數（原封不動傳遞）。

.EXAMPLE
    .\run-task.ps1 src\qiz-批次簽核.ts
    .\run-task.ps1 src\eip-公文簽核.ts --dry-run
    .\run-task.ps1 src\vst-資料匯出.ts --start-page 2
#>

[CmdletBinding()]
param(
    [Parameter(Position = 0, Mandatory = $false)]
    [string]$TaskScript,

    [Parameter(ValueFromRemainingArguments)]
    [string[]]$TaskArgs
)

Set-StrictMode -Version 3.0
$ErrorActionPreference = "Stop"

# 最低需求的 Node.js 主版本號
$MinNodeMajorVersion = 20

$ProjectRoot = [System.IO.Path]::GetFullPath($PSScriptRoot)
$ResolveNodeScript = Join-Path $ProjectRoot "scripts\resolve-node-runtime.ps1"

# ── 顯示使用說明 ──────────────────────────────────────────────

if (-not $TaskScript) {
    Write-Host ""
    Write-Host "用法：" -ForegroundColor Cyan
    Write-Host "  .\run-task.ps1 <腳本路徑> [參數...]" -ForegroundColor White
    Write-Host ""
    Write-Host "範例：" -ForegroundColor Cyan
    Write-Host "  .\run-task.ps1 src\qiz-批次簽核.ts" -ForegroundColor White
    Write-Host "  .\run-task.ps1 src\eip-公文簽核.ts --dry-run" -ForegroundColor White
    Write-Host ""
    Write-Host "說明：" -ForegroundColor Cyan
    Write-Host "  - 腳本必須是 .ts 檔案" -ForegroundColor White
    Write-Host "  - 建議將任務腳本放在 src\ 目錄下" -ForegroundColor White
    Write-Host "  - 其他參數會原封不動傳給任務腳本" -ForegroundColor White
    Write-Host ""

    # 列出 src\ 下可用的腳本
    $SrcDir = Join-Path $ProjectRoot "src"
    if (Test-Path -Path $SrcDir -PathType Container) {
        $ScriptFiles = Get-ChildItem -Path $SrcDir -Filter "*.ts" -File -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -notlike "*.d.ts" }
        if ($ScriptFiles) {
            Write-Host "src\ 目錄下現有的任務腳本：" -ForegroundColor Cyan
            foreach ($f in $ScriptFiles) {
                Write-Host "  src\$($f.Name)" -ForegroundColor Green
            }
            Write-Host ""
        }
    }

    exit 0
}

# ── 基礎環境檢查 ─────────────────────────────────────────────

if (-not (Test-Path -Path $ResolveNodeScript -PathType Leaf)) {
    Write-Host "❌ 找不到 scripts\resolve-node-runtime.ps1，這份安裝包不完整。" -ForegroundColor Red
    Write-Host "請先執行 .\install.ps1 檢查安裝包。" -ForegroundColor Yellow
    exit 1
}

# ── 驗證腳本副檔名 ───────────────────────────────────────────

$ScriptExtension = [System.IO.Path]::GetExtension($TaskScript).ToLowerInvariant()
if ($ScriptExtension -ne '.ts') {
    Write-Host "❌ 腳本必須是 .ts 檔案，不支援「$ScriptExtension」。" -ForegroundColor Red
    Write-Host "請傳入 TypeScript 腳本路徑，例如：src\qiz-批次簽核.ts" -ForegroundColor Yellow
    exit 1
}

# ── 正規化腳本路徑 ───────────────────────────────────────────

# 若為相對路徑，以專案根目錄為基準解析
if (-not ([System.IO.Path]::IsPathRooted($TaskScript))) {
    $ResolvedScript = [System.IO.Path]::GetFullPath((Join-Path $ProjectRoot $TaskScript))
} else {
    $ResolvedScript = [System.IO.Path]::GetFullPath($TaskScript)
}

# ── 安全性檢查：防止執行專案外的任意檔案 ─────────────────────

$NormalizedProjectRoot = $ProjectRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)
$NormalizedScriptPath  = $ResolvedScript.TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar)

if (-not $NormalizedScriptPath.StartsWith($NormalizedProjectRoot + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase) -and
    -not $NormalizedScriptPath.Equals($NormalizedProjectRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    Write-Host "❌ 基於安全考量，只允許執行專案資料夾內的腳本。" -ForegroundColor Red
    Write-Host "腳本路徑：$ResolvedScript" -ForegroundColor Yellow
    Write-Host "專案根目錄：$ProjectRoot" -ForegroundColor Yellow
    exit 1
}

# ── 確認腳本存在 ─────────────────────────────────────────────

if (-not (Test-Path -Path $ResolvedScript -PathType Leaf)) {
    Write-Host "❌ 找不到任務腳本：$TaskScript" -ForegroundColor Red
    Write-Host ""

    # 嘗試給予友善的建議
    $SrcDir = Join-Path $ProjectRoot "src"
    if (Test-Path -Path $SrcDir -PathType Container) {
        $ScriptFiles = Get-ChildItem -Path $SrcDir -Filter "*.ts" -File -ErrorAction SilentlyContinue |
            Where-Object { $_.Name -notlike "*.d.ts" }
        if ($ScriptFiles) {
            Write-Host "src\ 目錄下現有的任務腳本：" -ForegroundColor Cyan
            foreach ($f in $ScriptFiles) {
                Write-Host "  src\$($f.Name)" -ForegroundColor Green
            }
        } else {
            Write-Host "src\ 目錄目前沒有任何任務腳本。" -ForegroundColor Yellow
            Write-Host "請先透過 AI 協作生成腳本，並儲存到 src\ 目錄。" -ForegroundColor White
        }
    }

    Write-Host ""
    Write-Host "如需協助，請參閱：docs\執行任務指南.md" -ForegroundColor White
    exit 1
}

# ── 載入 Node.js Runtime ─────────────────────────────────────

. $ResolveNodeScript

try {
    $runtime = Resolve-NodeRuntime -ProjectRoot $ProjectRoot -MinimumMajorVersion $MinNodeMajorVersion -RequireTsx
} catch {
    Write-Host "❌ 無法啟動任務執行環境。" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Yellow
    Write-Host ""
    Write-Host "請先執行 .\install.ps1 確認安裝包完整，再重新嘗試。" -ForegroundColor White
    exit 1
}

# ── 設定 Playwright 瀏覽器路徑（離線包）───────────────────────

$LocalBrowserPath = Join-Path $ProjectRoot ".playwright-browsers"
if (Test-Path -Path $LocalBrowserPath -PathType Container) {
    $env:PLAYWRIGHT_BROWSERS_PATH = $LocalBrowserPath
}

# ── 執行任務腳本 ─────────────────────────────────────────────

Write-Host "▶  執行任務腳本：$TaskScript" -ForegroundColor Cyan

& $runtime.NodeExePath $runtime.TsxCliPath $ResolvedScript @TaskArgs

$exitCodeVariable = Get-Variable -Name LASTEXITCODE -ErrorAction SilentlyContinue
if ($exitCodeVariable) {
    exit ([int]$exitCodeVariable.Value)
}

if ($?) {
    exit 0
}

exit 1
