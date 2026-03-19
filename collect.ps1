<#
.SYNOPSIS
    RPA-Cowork 素材蒐集入口（不依賴 npm / npx）

.DESCRIPTION
    優先使用專案內建 Node.js runtime，再退回系統安裝。
    若安裝包不完整，會提示先執行 install.ps1 / setup.ps1。
#>

[CmdletBinding()]
param(
    [Parameter(ValueFromRemainingArguments)]
    [string[]]$CollectorArgs
)

Set-StrictMode -Version 3.0
$ErrorActionPreference = "Stop"

$ProjectRoot = [System.IO.Path]::GetFullPath($PSScriptRoot)
$ResolveNodeScript = Join-Path $ProjectRoot "scripts\resolve-node-runtime.ps1"
$CollectorScript = Join-Path $ProjectRoot "collectors\collect-materials.ts"
$LocalBrowserPath = Join-Path $ProjectRoot ".playwright-browsers"

if (-not (Test-Path -Path $ResolveNodeScript -PathType Leaf)) {
    Write-Host "❌ 找不到 scripts\resolve-node-runtime.ps1，這份安裝包不完整。" -ForegroundColor Red
    Write-Host "請先執行 .\install.ps1 檢查安裝包。" -ForegroundColor Yellow
    exit 1
}

if (-not (Test-Path -Path $CollectorScript -PathType Leaf)) {
    Write-Host "❌ 找不到 collectors\collect-materials.ts，這份安裝包不完整。" -ForegroundColor Red
    Write-Host "請先執行 .\install.ps1 檢查安裝包。" -ForegroundColor Yellow
    exit 1
}

. $ResolveNodeScript

try {
    $runtime = Resolve-NodeRuntime -ProjectRoot $ProjectRoot -MinimumMajorVersion 20 -RequireTsx -RequirePlaywright
} catch {
    Write-Host "❌ 無法啟動 RPA-Cowork 素材蒐集模組。" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Yellow
    Write-Host ""
    Write-Host "請先執行 .\install.ps1 確認安裝包完整，再重新嘗試。" -ForegroundColor White
    exit 1
}

if (Test-Path -Path $LocalBrowserPath -PathType Container) {
    $env:PLAYWRIGHT_BROWSERS_PATH = $LocalBrowserPath
}

& $runtime.NodeExePath $runtime.TsxCliPath $CollectorScript @CollectorArgs
$exitCodeVariable = Get-Variable -Name LASTEXITCODE -ErrorAction SilentlyContinue
if ($exitCodeVariable) {
    exit ([int]$exitCodeVariable.Value)
}

if ($?) {
    exit 0
}

exit 1
