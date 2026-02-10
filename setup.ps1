<#
.SYNOPSIS
    一鍵安裝素材蒐集工具的所有依賴

.DESCRIPTION
    這個腳本會：
    1. 檢查 Node.js 是否已安裝
    2. 執行 npm install 安裝程式庫
    3. 安裝 Playwright Chromium 瀏覽器
    4. 驗證安裝結果

.NOTES
    - 只需要執行一次
    - 如果在完全離線的環境中，請先在有網路的電腦上執行此腳本，
      然後把整個 automation 資料夾（含 node_modules）帶到離線環境

.EXAMPLE
    .\setup.ps1
#>

param(
    [switch]$Offline
)

$ErrorActionPreference = "Stop"

$LogDir = Join-Path $PSScriptRoot "logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$LogFile = Join-Path $LogDir ("setup-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".log")

function Write-Log {
    param(
        [string]$Level,
        [string]$Message,
        [ConsoleColor]$Color = [ConsoleColor]::Gray
    )
    if ($Message -eq '') {
        Add-Content -Path $LogFile -Value ''
        Write-Host ''
        return
    }
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss.fff"
    $line = "[{0}][{1}] {2}" -f $timestamp, $Level.ToUpper(), $Message
    Add-Content -Path $LogFile -Value $line
    Write-Host $Message -ForegroundColor $Color
}

function Write-LogOnly {
    param(
        [string]$Level,
        [string]$Message
    )
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss.fff"
    $line = "[{0}][{1}] {2}" -f $timestamp, $Level.ToUpper(), $Message
    Add-Content -Path $LogFile -Value $line
}

function Invoke-LoggedCommand {
    param(
        [string]$FilePath,
        [string[]]$Arguments
    )
    Write-Log "INFO" "  ➜ 執行: $FilePath $($Arguments -join ' ')" -Color Gray
    & $FilePath @Arguments 2>&1 | ForEach-Object {
        $line = $_.ToString()
        if ($line.Trim().Length -eq 0) {
            Write-Log "INFO" "" -Color Gray
        } else {
            Write-Log "INFO" $line -Color Gray
        }
    }
    return $LASTEXITCODE
}

Write-LogOnly "INFO" "Script: $PSCommandPath"
Write-LogOnly "INFO" "PowerShell: $($PSVersionTable.PSVersion)"
Write-LogOnly "INFO" "OS: $([System.Environment]::OSVersion.VersionString)"
Write-LogOnly "INFO" "User: $env:USERNAME"
Write-LogOnly "INFO" "CWD: $PWD"
Write-LogOnly "INFO" "LogFile: $LogFile"
Write-LogOnly "INFO" "Offline: $Offline"

Write-Log "INFO" ""
Write-Log "INFO" "  ========================================" -Color Cyan
Write-Log "INFO" "  🔧 素材蒐集工具 - 環境安裝" -Color Cyan
Write-Log "INFO" "  ========================================" -Color Cyan
Write-Log "INFO" ""
Write-Log "INFO" "  🧾 安裝日誌: $LogFile" -Color Gray
Write-Log "INFO" ""

# 步驟 1：檢查 Node.js
Write-Log "INFO" "  [1/3] 檢查 Node.js..." -Color White
try {
    $nodeVersion = (node --version 2>&1 | Select-Object -First 1).ToString().Trim()
    Write-LogOnly "INFO" "node --version: $nodeVersion"
    $versionNumber = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
    if ($versionNumber -lt 20) {
        Write-Log "ERROR" "  ❌ Node.js 版本過低: $nodeVersion（需要 v20 以上）" -Color Red
        Write-Log "INFO" "  請到 https://nodejs.org/ 下載最新版本" -Color Yellow
        exit 1
    }
    Write-Log "INFO" "  ✅ Node.js $nodeVersion" -Color Green
} catch {
    Write-Log "ERROR" "  ❌ 找不到 Node.js！" -Color Red
    Write-Log "INFO" "  請到 https://nodejs.org/ 下載並安裝 Node.js v20 以上版本" -Color Yellow
    Write-LogOnly "ERROR" $_.Exception.Message
    if ($_.ScriptStackTrace) {
        Write-LogOnly "ERROR" $_.ScriptStackTrace
    }
    exit 1
}

# 步驟 2：安裝 npm 依賴
Write-Log "INFO" ""
Write-Log "INFO" "  [2/3] 安裝程式庫（npm install）..." -Color White
Write-Log "INFO" "  這可能需要 1-2 分鐘..." -Color Gray

Push-Location $PSScriptRoot
try {
    if ($Offline) {
        if (-not (Test-Path (Join-Path $PSScriptRoot "node_modules"))) {
            Write-Log "ERROR" "  ❌ 離線模式需要已存在的 node_modules" -Color Red
            Write-Log "INFO" "  請先在有網路的電腦上執行 npm install" -Color Yellow
            exit 1
        }
        Write-Log "INFO" "  ✅ node_modules 已存在" -Color Green

        $pwPaths = @()
        if ($env:PLAYWRIGHT_BROWSERS_PATH) { $pwPaths += $env:PLAYWRIGHT_BROWSERS_PATH }
        $pwPaths += (Join-Path $PSScriptRoot ".playwright-browsers")
        $pwPaths += (Join-Path $env:LOCALAPPDATA "ms-playwright")
        $found = $false
        foreach ($p in $pwPaths) {
            if ($p -and (Test-Path $p)) {
                Write-Log "INFO" "  ✅ Playwright 瀏覽器路徑: $p" -Color Green
                $found = $true
                break
            }
        }
        if (-not $found) {
            Write-Log "WARN" "  ⚠️  找不到 Playwright 瀏覽器目錄" -Color Yellow
            Write-Log "WARN" "  請先在有網路的電腦上執行: npx playwright install chromium" -Color Yellow
            Write-Log "WARN" "  或將瀏覽器放到 .playwright-browsers 並設定 PLAYWRIGHT_BROWSERS_PATH" -Color Yellow
        }

        Write-Log "INFO" "  ✅ 離線模式檢查完成" -Color Green
        Write-Log "INFO" ""
        Write-Log "INFO" "  接下來的步驟：" -Color Cyan
        Write-Log "INFO" "  1. 執行 .\\launch-chrome.ps1 啟動 Chrome Debug 模式" -Color White
        Write-Log "INFO" "  2. 在 Chrome 中登入你的內部網站" -Color White
        Write-Log "INFO" "  3. 開啟另一個 PowerShell 視窗" -Color White
        Write-Log "INFO" "  4. 執行 npm run collect 開始蒐集素材" -Color White
        exit 0
    }

    $exitCode = Invoke-LoggedCommand -FilePath "npm" -Arguments @("install")
    if ($exitCode -ne 0) {
        Write-Log "ERROR" "  ❌ npm install 失敗 (ExitCode: $exitCode)" -Color Red
        exit 1
    }
    Write-Log "INFO" "  ✅ 程式庫安裝完成" -Color Green
} finally {
    Pop-Location
}

# 步驟 3：安裝 Playwright 瀏覽器
Write-Log "INFO" ""
Write-Log "INFO" "  [3/3] 安裝 Playwright Chromium 瀏覽器..." -Color White
Write-Log "INFO" "  這可能需要 2-5 分鐘（下載約 150MB）..." -Color Gray

Push-Location $PSScriptRoot
try {
    $exitCode = Invoke-LoggedCommand -FilePath "npx" -Arguments @("playwright", "install", "chromium")
    if ($exitCode -ne 0) {
        Write-Log "ERROR" "  ❌ Playwright 瀏覽器安裝失敗 (ExitCode: $exitCode)" -Color Red
        exit 1
    }
    Write-Log "INFO" "  ✅ Playwright Chromium 安裝完成" -Color Green
} finally {
    Pop-Location
}

# 完成
Write-Log "INFO" ""
Write-Log "INFO" "  ========================================" -Color Green
Write-Log "INFO" "  🎉 安裝完成！" -Color Green
Write-Log "INFO" "  ========================================" -Color Green
Write-Log "INFO" ""
Write-Log "INFO" "  接下來的步驟：" -Color Cyan
Write-Log "INFO" "  1. 執行 .\\launch-chrome.ps1 啟動 Chrome Debug 模式" -Color White
Write-Log "INFO" "  2. 在 Chrome 中登入你的內部網站" -Color White
Write-Log "INFO" "  3. 開啟另一個 PowerShell 視窗" -Color White
Write-Log "INFO" "  4. 執行 npm run collect 開始蒐集素材" -Color White
Write-Log "INFO" ""
Write-Log "INFO" "  詳細說明請參考: 使用指南.md" -Color Gray
Write-Log "INFO" ""
