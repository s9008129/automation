[CmdletBinding()]
param(
    [Parameter(ValueFromRemainingArguments = $true)]
    [string[]]$ForwardArgs
)

# 一旦發生錯誤就中止：避免上一步失敗卻還繼續往下執行。
Set-StrictMode -Version 3.0
$ErrorActionPreference = "Stop"

. (Join-Path $PSScriptRoot "resolve-node-runtime.ps1")

try {
    $projectRoot = Split-Path -Parent $PSScriptRoot
    $runtime = Resolve-NodeRuntime -ProjectRoot $projectRoot -RequireTsx -RequirePlaywright
    $entryScript = Join-Path $runtime.ProjectRoot "src\materialsCollector.ts"

    # 友善輸出：讓使用者清楚知道腳本已開始執行。
    Write-Host "🏗️ 素材處理器 — Materials Collector" -ForegroundColor Cyan
    Write-Host "======================================" -ForegroundColor Cyan

    Push-Location $runtime.ProjectRoot
    try {
        & $runtime.NodeExePath $runtime.TsxCliPath $entryScript @ForwardArgs
        if ($LASTEXITCODE -ne 0) {
            exit $LASTEXITCODE
        }
    }
    finally {
        Pop-Location
    }
}
catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}
