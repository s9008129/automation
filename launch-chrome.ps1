<#
.SYNOPSIS
    啟動 Chrome Debug 模式（素材蒐集必備）

.DESCRIPTION
    這個腳本會啟動 Chrome 瀏覽器的 Debug 模式，讓素材蒐集工具可以連接到 Chrome。
    Chrome 會使用獨立的使用者設定檔，不會影響你平常使用的 Chrome。

.NOTES
    - 執行前請先關閉所有正在運行的 Chrome 視窗
    - 啟動後可以在 Chrome 中正常瀏覽網頁、登入系統
    - 素材蒐集工具會「看到」你在 Chrome 中看到的內容

.EXAMPLE
    .\launch-chrome.ps1
    .\launch-chrome.ps1 -Port 9223
#>

param(
    [int]$Port = 9222
)

$ErrorActionPreference = "Stop"

$LogDir = Join-Path $PSScriptRoot "logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$LogFile = Join-Path $LogDir ("launch-chrome-" + (Get-Date -Format "yyyyMMdd-HHmmss") + ".log")

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

Write-LogOnly "INFO" "Script: $PSCommandPath"
Write-LogOnly "INFO" "PowerShell: $($PSVersionTable.PSVersion)"
Write-LogOnly "INFO" "OS: $([System.Environment]::OSVersion.VersionString)"
Write-LogOnly "INFO" "User: $env:USERNAME"
Write-LogOnly "INFO" "CWD: $PWD"
Write-LogOnly "INFO" "Port: $Port"
Write-LogOnly "INFO" "LogFile: $LogFile"

# Chrome 常見安裝路徑
$chromePaths = @(
    "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe",
    "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
    "${env:LOCALAPPDATA}\Google\Chrome\Application\chrome.exe"
)

$chromeExe = $null
foreach ($p in $chromePaths) {
    if (Test-Path $p) {
        $chromeExe = $p
        break
    }
}

if (-not $chromeExe) {
    Write-Log "INFO" ""
    Write-Log "ERROR" "  ❌ 找不到 Google Chrome！" -Color Red
    Write-Log "INFO" ""
    Write-Log "INFO" "  請確認 Chrome 已安裝在以下路徑之一：" -Color Yellow
    foreach ($p in $chromePaths) {
        Write-Log "INFO" "    - $p" -Color Gray
    }
    Write-Log "INFO" ""
    exit 1
}

# 建立獨立的使用者設定目錄
$profileDir = Join-Path $PSScriptRoot "chrome-debug-profile"

Write-Log "INFO" ""
Write-Log "INFO" "  ========================================" -Color Cyan
Write-Log "INFO" "  🚀 啟動 Chrome Debug 模式" -Color Cyan
Write-Log "INFO" "  ========================================" -Color Cyan
Write-Log "INFO" ""
Write-Log "INFO" "  🧾 啟動日誌: $LogFile" -Color Gray
Write-Log "INFO" "  Chrome 路徑: $chromeExe" -Color Gray
Write-Log "INFO" "  Debug 端口:  $Port" -Color Gray
Write-Log "INFO" "  設定目錄:    $profileDir" -Color Gray
Write-Log "INFO" ""

# 檢查端口是否已被占用
$portInUse = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
if ($portInUse) {
    # 檢查是否為我們自己的 debug Chrome
    $ownerPid = ($portInUse | Where-Object { $_.State -eq 'Listen' } | Select-Object -First 1).OwningProcess
    $isOurChrome = $false
    if ($ownerPid) {
        try {
            $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$ownerPid" -ErrorAction SilentlyContinue
            if ($proc -and $proc.CommandLine -match [regex]::Escape($profileDir)) {
                $isOurChrome = $true
            }
        } catch { }
    }

    if ($isOurChrome) {
        Write-Log "INFO" "  ✅ Chrome Debug 模式已在運行（PID: $ownerPid）" -Color Green
        Write-Log "INFO" ""
        Write-Log "INFO" "  驗證方式: 在瀏覽器中打開 http://localhost:${Port}/json/version" -Color Gray
        Write-Log "INFO" ""
        Write-Log "INFO" "  下一步：" -Color Cyan
        Write-Log "INFO" "  1. 在 Chrome 中登入你的內部網站" -Color White
        Write-Log "INFO" "  2. 開啟另一個 PowerShell 視窗" -Color White
        Write-Log "INFO" "  3. 執行 npm run collect 開始蒐集素材" -Color White
        Write-Log "INFO" ""
        exit 0
    }

    Write-Log "WARN" "  ⚠️  端口 $Port 已被其他程式占用！" -Color Yellow
    Write-LogOnly "WARN" "PortOwnerPID: $ownerPid"
    Write-Log "INFO" ""
    Write-Log "INFO" "  這通常是因為有一般 Chrome 或其他程式佔用了端口 $Port。" -Color Yellow
    Write-Log "INFO" "  建議先關閉所有 Chrome 視窗，再重新執行此腳本。" -Color Yellow
    Write-Log "INFO" ""

    $continue = Read-Host "  是否要強制關閉佔用端口的程式並重新啟動？(y/N)"
    Write-LogOnly "INFO" "UserContinue: $continue"
    if ($continue -ne 'y' -and $continue -ne 'Y') {
        exit 0
    }

    # 強制關閉佔用端口的程式
    if ($ownerPid) {
        Write-Log "INFO" "  正在關閉佔用端口的程式 (PID: $ownerPid)..." -Color Yellow
        try {
            Stop-Process -Id $ownerPid -Force -ErrorAction Stop
            Start-Sleep -Seconds 2
            Write-Log "INFO" "  ✅ 已關閉 PID $ownerPid" -Color Green
        } catch {
            Write-Log "ERROR" "  ❌ 無法關閉程式 (PID: $ownerPid): $($_.Exception.Message)" -Color Red
            Write-LogOnly "ERROR" $_.Exception.Message
            exit 1
        }
    }
}

Write-Log "INFO" "  正在啟動 Chrome..." -Color Green
Write-Log "INFO" ""

# 啟動 Chrome
Start-Process -FilePath $chromeExe -ArgumentList @(
    "--remote-debugging-port=$Port",
    "--user-data-dir=$profileDir",
    "--no-first-run",
    "--no-default-browser-check"
)

# 等待 Chrome 啟動
Start-Sleep -Seconds 3

# 驗證
Write-Log "INFO" "  驗證 Chrome Debug 模式..." -Color Gray
try {
    $response = Invoke-RestMethod -Uri "http://localhost:${Port}/json/version" -TimeoutSec 5
    Write-Log "INFO" ""
    Write-Log "INFO" "  ✅ Chrome Debug 模式已成功啟動！" -Color Green
    Write-Log "INFO" "  瀏覽器版本: $($response.Browser)" -Color Gray
    Write-LogOnly "INFO" "webSocketDebuggerUrl: $($response.webSocketDebuggerUrl)"

    # 記錄所有已開啟的頁面（方便 debug）
    try {
        $pages = Invoke-RestMethod -Uri "http://localhost:${Port}/json/list" -TimeoutSec 5
        Write-LogOnly "INFO" "CDP pages count: $($pages.Count)"
        foreach ($pg in $pages) {
            Write-LogOnly "INFO" "  CDP page: type=$($pg.type) title=$($pg.title) url=$($pg.url)"
        }
    } catch { }

    Write-Log "INFO" ""
    Write-Log "INFO" "  下一步：" -Color Cyan
    Write-Log "INFO" "  1. 在 Chrome 中登入你的內部網站" -Color White
    Write-Log "INFO" "  2. 開啟另一個 PowerShell 視窗" -Color White
    Write-Log "INFO" "  3. 執行 npm run collect 開始蒐集素材" -Color White
    Write-Log "INFO" ""
} catch {
    Write-LogOnly "ERROR" $_.Exception.Message
    if ($_.ScriptStackTrace) {
        Write-LogOnly "ERROR" $_.ScriptStackTrace
    }
    Write-Log "INFO" ""
    Write-Log "WARN" "  ⚠️  Chrome 已啟動但尚未準備好。" -Color Yellow
    Write-Log "WARN" "  請稍等幾秒後，在瀏覽器中打開以下網址確認：" -Color Yellow
    Write-Log "INFO" "  http://localhost:${Port}/json/version" -Color Cyan
    Write-Log "INFO" ""
}
