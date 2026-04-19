<#
.SYNOPSIS
    RPA 任務執行通用入口（不依賴 npm / npx）

.DESCRIPTION
    執行 src\ 目錄下的 TypeScript 任務腳本。
    優先使用專案內建 Node.js runtime，再退回系統安裝。
    若安裝包不完整，會提示先執行 install.ps1。

.PARAMETER TaskScript
    任務腳本的路徑（相對或絕對），例如：
        src\qiz-批次簽核.ts
        src\eip-公文簽核.ts

.PARAMETER TaskArgs
    傳遞給任務腳本的其餘參數（原封不動轉發）

.EXAMPLE
    .\run-task.ps1 src\qiz-批次簽核.ts
    .\run-task.ps1 src\eip-公文簽核.ts --dry-run
    .\run-task.ps1 src\vst-資料匯出.ts --output D:\exports

.NOTES
    - 僅允許執行專案目錄內的 .ts 腳本
    - 使用與 collect.ps1 相同的 runtime 解析機制
    - 錯誤訊息以正體中文輸出
#>

[CmdletBinding()]
param(
    [Parameter(Position = 0, Mandatory = $true)]
    [string]$TaskScript,

    [Parameter(Position = 1, ValueFromRemainingArguments)]
    [string[]]$TaskArgs
)

Set-StrictMode -Version 3.0
$ErrorActionPreference = "Stop"

$ProjectRoot = [System.IO.Path]::GetFullPath($PSScriptRoot)
$ResolveNodeScript = Join-Path $ProjectRoot "scripts\resolve-node-runtime.ps1"
$LocalBrowserPath = Join-Path $ProjectRoot ".playwright-browsers"

# ────────────────────────────────────────────────────────────
# 驗證安裝包完整性
# ────────────────────────────────────────────────────────────

if (-not (Test-Path -Path $ResolveNodeScript -PathType Leaf)) {
    Write-Host "❌ 找不到 scripts\resolve-node-runtime.ps1，這份安裝包不完整。" -ForegroundColor Red
    Write-Host "請先執行 .\install.ps1 檢查安裝包。" -ForegroundColor Yellow
    exit 1
}

# ────────────────────────────────────────────────────────────
# 驗證腳本路徑
# ────────────────────────────────────────────────────────────

# 驗證副檔名
$extension = [System.IO.Path]::GetExtension($TaskScript).ToLower()
if ($extension -ne ".ts" -and $extension -ne ".mts" -and $extension -ne ".cts") {
    Write-Host "❌ 不支援的腳本副檔名「$extension」。" -ForegroundColor Red
    Write-Host "任務腳本必須是 TypeScript 檔案（.ts）。" -ForegroundColor Yellow
    exit 1
}

# 正規化為絕對路徑
if ([System.IO.Path]::IsPathRooted($TaskScript)) {
    $AbsoluteScriptPath = [System.IO.Path]::GetFullPath($TaskScript)
} else {
    $AbsoluteScriptPath = [System.IO.Path]::GetFullPath((Join-Path $ProjectRoot $TaskScript))
}

# 安全驗證：確保腳本在專案目錄內，防止路徑穿越
$NormalizedProjectRoot = [System.IO.Path]::GetFullPath($ProjectRoot)
$ProjectRootWithSep = $NormalizedProjectRoot.TrimEnd([System.IO.Path]::DirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
if (-not ($AbsoluteScriptPath.StartsWith($ProjectRootWithSep, [System.StringComparison]::OrdinalIgnoreCase))) {
    Write-Host "❌ 腳本路徑超出專案目錄範圍，無法執行。" -ForegroundColor Red
    Write-Host "允許範圍：$ProjectRoot" -ForegroundColor Yellow
    Write-Host "傳入路徑：$TaskScript" -ForegroundColor Yellow
    exit 1
}

# 確認腳本檔案存在
if (-not (Test-Path -Path $AbsoluteScriptPath -PathType Leaf)) {
    Write-Host "❌ 找不到任務腳本：$TaskScript" -ForegroundColor Red
    Write-Host "" -ForegroundColor White
    Write-Host "請確認：" -ForegroundColor White
    Write-Host "  1. 腳本路徑正確（相對於專案根目錄）" -ForegroundColor White
    Write-Host "  2. 任務腳本已放在 src\ 目錄下" -ForegroundColor White
    Write-Host "" -ForegroundColor White
    Write-Host "範例：" -ForegroundColor White
    Write-Host "  .\run-task.ps1 src\qiz-批次簽核.ts" -ForegroundColor Cyan
    Write-Host "  .\run-task.ps1 src\eip-公文簽核.ts" -ForegroundColor Cyan
    exit 1
}

# ────────────────────────────────────────────────────────────
# 解析 Node.js Runtime
# ────────────────────────────────────────────────────────────

. $ResolveNodeScript

try {
    $runtime = Resolve-NodeRuntime `
        -ProjectRoot $ProjectRoot `
        -MinimumMajorVersion 20 `
        -RequireTsx
} catch {
    Write-Host "❌ 無法啟動任務執行環境。" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Yellow
    Write-Host "" -ForegroundColor White
    Write-Host "請先執行 .\install.ps1 確認安裝包完整，再重新嘗試。" -ForegroundColor White
    exit 1
}

# ────────────────────────────────────────────────────────────
# 設定 Playwright 瀏覽器路徑（離線包）
# ────────────────────────────────────────────────────────────

if (Test-Path -Path $LocalBrowserPath -PathType Container) {
    $env:PLAYWRIGHT_BROWSERS_PATH = $LocalBrowserPath
}

# ────────────────────────────────────────────────────────────
# 🔐 任務執行前：自動解密 .env（若已加密）
# ────────────────────────────────────────────────────────────

$ProtectEnvScript = Join-Path $ProjectRoot "scripts\protect-env.mjs"
$EnvFile = Join-Path $ProjectRoot ".env"
$EnvKeyFile = Join-Path $ProjectRoot ".env.key"

$needsPostEncrypt = $false

if ((Test-Path -Path $EnvFile -PathType Leaf) -and (Test-Path -Path $ProtectEnvScript -PathType Leaf)) {
    # 檢查 .env 是否含有 ENC(...) 加密值
    $envContent = Get-Content -Path $EnvFile -Raw -ErrorAction SilentlyContinue
    if ($envContent -match "ENC\(") {
        if (Test-Path -Path $EnvKeyFile -PathType Leaf) {
            Write-Host "🔓 偵測到加密的 .env，正在解密..." -ForegroundColor DarkCyan
            & $runtime.NodeExePath $ProtectEnvScript --decrypt 2>&1 | Out-Null
            if ($LASTEXITCODE -ne 0) {
                Write-Host "❌ .env 解密失敗，請檢查金鑰是否正確。" -ForegroundColor Red
                exit 1
            }
            $needsPostEncrypt = $true
            Write-Host "✅ .env 已解密，準備執行任務" -ForegroundColor DarkGreen
        } else {
            Write-Host "⚠️  .env 含有加密值但找不到 .env.key 金鑰檔。" -ForegroundColor Yellow
            Write-Host "   請確認金鑰檔案存在，或重新執行 .\protect-env.ps1 產生金鑰。" -ForegroundColor Yellow
            exit 1
        }
    }
}

# ────────────────────────────────────────────────────────────
# 執行任務腳本
# ────────────────────────────────────────────────────────────

$ScriptDisplayName = $TaskScript
Write-Host "▶ 正在執行：$ScriptDisplayName" -ForegroundColor Cyan

& $runtime.NodeExePath $runtime.TsxCliPath $AbsoluteScriptPath @TaskArgs

$taskExitCode = $LASTEXITCODE

# ────────────────────────────────────────────────────────────
# 🔐 任務執行後：自動換鑰 + 重新加密 .env
# ────────────────────────────────────────────────────────────

if ($needsPostEncrypt -and (Test-Path -Path $EnvFile -PathType Leaf)) {
    Write-Host "" -ForegroundColor White
    Write-Host "🔄 任務完成，正在更換金鑰並重新加密 .env..." -ForegroundColor DarkCyan

    # 先加密（用現有金鑰）
    & $runtime.NodeExePath $ProtectEnvScript 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "⚠️  .env 重新加密失敗。" -ForegroundColor Yellow
    } else {
        # 再換鑰（產生新金鑰並重新加密）
        & $runtime.NodeExePath $ProtectEnvScript --rotate-key 2>&1 | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Host "⚠️  金鑰輪換失敗，但 .env 仍保持加密狀態。" -ForegroundColor Yellow
        } else {
            Write-Host "✅ .env 已使用新金鑰重新加密" -ForegroundColor DarkGreen
        }
    }
}

# ────────────────────────────────────────────────────────────
# 回傳任務執行結果
# ────────────────────────────────────────────────────────────

exit $taskExitCode
