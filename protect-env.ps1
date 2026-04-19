<#
.SYNOPSIS
    加密 .env 中的敏感值，保護機敏資訊

.DESCRIPTION
    使用 AES-256-GCM 加密 .env 檔案中的所有明文值。
    加密後的值以 ENC(...) 格式儲存，RPA 執行時自動透明解密。
    金鑰儲存於 .env.key（首次執行時自動產生）。

.PARAMETER Decrypt
    解密 .env（還原為明文），方便修改後重新加密

.PARAMETER Status
    顯示 .env 的加密狀態

.PARAMETER RotateKey
    換鑰：產生新金鑰並重新加密所有值

.EXAMPLE
    .\protect-env.ps1
    # 加密 .env 中的所有明文值

.EXAMPLE
    .\protect-env.ps1 -Decrypt
    # 解密 .env，還原為明文以便修改

.EXAMPLE
    .\protect-env.ps1 -Status
    # 顯示 .env 加密狀態
#>

[CmdletBinding()]
param(
    [switch]$Decrypt,
    [switch]$Status,
    [switch]$RotateKey
)

Set-StrictMode -Version 3.0
$ErrorActionPreference = "Stop"

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$ResolveNodeScript = Join-Path $ProjectRoot "scripts\resolve-node-runtime.ps1"
$ProtectEnvScript = Join-Path $ProjectRoot "scripts\protect-env.mjs"

# ── 載入 Node.js Runtime 解析器 ──────────────────────────
if (-not (Test-Path $ResolveNodeScript)) {
    Write-Host ""
    Write-Host "❌ 找不到 Node.js 解析器：$ResolveNodeScript" -ForegroundColor Red
    Write-Host "   請確認工具包完整性，或聯絡技術準備者。" -ForegroundColor Yellow
    exit 1
}

. $ResolveNodeScript
$nodeInfo = Resolve-NodeRuntime -ProjectRoot $ProjectRoot -MinVersion "20.0.0"

if (-not $nodeInfo -or -not $nodeInfo.NodeExePath) {
    Write-Host ""
    Write-Host "❌ 找不到 Node.js Runtime（需要 v20 以上）" -ForegroundColor Red
    Write-Host "   請確認離線包中包含 runtime\node 資料夾。" -ForegroundColor Yellow
    exit 1
}

$NodeExe = $nodeInfo.NodeExePath

# ── 組合命令列參數 ───────────────────────────────────────
$nodeArgs = @($ProtectEnvScript)

if ($Decrypt) {
    $nodeArgs += "--decrypt"
}
elseif ($Status) {
    $nodeArgs += "--status"
}
elseif ($RotateKey) {
    $nodeArgs += "--rotate-key"
}

# ── 執行 ─────────────────────────────────────────────────
& $NodeExe $nodeArgs
exit $LASTEXITCODE
