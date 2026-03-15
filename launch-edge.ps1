<#
.SYNOPSIS
    啟動 Edge Debug 模式（Windows 使用者入口）
#>

[CmdletBinding()]
param(
    [int]$Port = 9222
)

$ErrorActionPreference = 'Stop'
$launcher = Join-Path $PSScriptRoot 'scripts\launch-browser.ps1'
& $launcher -Browser edge -Port $Port
exit $LASTEXITCODE
