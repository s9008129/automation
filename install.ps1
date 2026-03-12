<#
.SYNOPSIS
    Windows 一鍵安裝入口（一般使用者請執行這支）
#>

[CmdletBinding()]
param()

Set-StrictMode -Version 3.0
$ErrorActionPreference = "Stop"

$setupScript = Join-Path $PSScriptRoot "setup.ps1"
if (-not (Test-Path -Path $setupScript -PathType Leaf)) {
    Write-Host "❌ 找不到 setup.ps1，這份安裝包不完整。" -ForegroundColor Red
    exit 1
}

Write-Host "📦 正在檢查這份離線安裝包是否完整..." -ForegroundColor Cyan
& $setupScript -Offline
if ($?) {
    exit 0
}

exit 1
