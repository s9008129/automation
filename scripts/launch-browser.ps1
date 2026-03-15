<#
.SYNOPSIS
    啟動 Chromium branded browser 的 Debug 模式（支援 Chrome / Edge）

.DESCRIPTION
    這個腳本會啟動 Chrome 或 Edge 的 Debug 模式，讓素材蒐集工具可以附加到已登入的瀏覽器。
    會使用專屬的 user-data-dir，不會直接污染你平常使用的瀏覽器設定。

.EXAMPLE
    .\scripts\launch-browser.ps1 -Browser chrome
    .\scripts\launch-browser.ps1 -Browser edge -Port 9223
#>

param(
    [ValidateSet('chrome', 'edge')]
    [string]$Browser = 'chrome',

    [int]$Port = 9222
)

$ErrorActionPreference = 'Stop'
$script:TaipeiTimeZone = [System.TimeZoneInfo]::FindSystemTimeZoneById('Taipei Standard Time')

function Get-TaipeiNow {
    return [System.TimeZoneInfo]::ConvertTimeFromUtc([DateTime]::UtcNow, $script:TaipeiTimeZone)
}

function Format-TaipeiTimestamp {
    param(
        [switch]$ForFile
    )

    $format = if ($ForFile) { 'yyyyMMdd-HHmmss' } else { 'yyyy-MM-dd HH:mm:ss.fff' }
    return (Get-TaipeiNow).ToString($format, [System.Globalization.CultureInfo]::InvariantCulture)
}

function Get-BrowserDisplayName {
    param([string]$Name)

    switch ($Name) {
        'edge' { return 'Microsoft Edge' }
        default { return 'Google Chrome' }
    }
}

function Get-BrowserProfileDirName {
    param([string]$Name)

    switch ($Name) {
        'edge' { return 'edge-debug-profile' }
        default { return 'chrome-debug-profile' }
    }
}

function Get-BrowserExecutablePaths {
    param([string]$Name)

    switch ($Name) {
        'edge' {
            return @(
                "${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe",
                "${env:ProgramFiles}\Microsoft\Edge\Application\msedge.exe",
                "${env:LOCALAPPDATA}\Microsoft\Edge\Application\msedge.exe"
            )
        }
        default {
            return @(
                "${env:ProgramFiles}\Google\Chrome\Application\chrome.exe",
                "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
                "${env:LOCALAPPDATA}\Google\Chrome\Application\chrome.exe"
            )
        }
    }
}

$browserKey = $Browser.ToLowerInvariant()
$browserDisplayName = Get-BrowserDisplayName -Name $browserKey
$profileDirName = Get-BrowserProfileDirName -Name $browserKey

$LogDir = Join-Path $PSScriptRoot '..\logs'
$ResolvedLogDir = [System.IO.Path]::GetFullPath($LogDir)
New-Item -ItemType Directory -Force -Path $ResolvedLogDir | Out-Null
$LogFile = Join-Path $ResolvedLogDir (("launch-" + $browserKey + "-") + (Format-TaipeiTimestamp -ForFile) + '.log')

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
    $timestamp = Format-TaipeiTimestamp
    $line = '[{0}][{1}] {2}' -f $timestamp, $Level.ToUpper(), $Message
    Add-Content -Path $LogFile -Value $line
    Write-Host $Message -ForegroundColor $Color
}

function Write-LogOnly {
    param(
        [string]$Level,
        [string]$Message
    )
    $timestamp = Format-TaipeiTimestamp
    $line = '[{0}][{1}] {2}' -f $timestamp, $Level.ToUpper(), $Message
    Add-Content -Path $LogFile -Value $line
}

Write-LogOnly 'INFO' "Script: $PSCommandPath"
Write-LogOnly 'INFO' "PowerShell: $($PSVersionTable.PSVersion)"
Write-LogOnly 'INFO' "OS: $([System.Environment]::OSVersion.VersionString)"
Write-LogOnly 'INFO' "User: $env:USERNAME"
Write-LogOnly 'INFO' "CWD: $PWD"
Write-LogOnly 'INFO' "Browser: $browserKey"
Write-LogOnly 'INFO' "Port: $Port"
Write-LogOnly 'INFO' "LogFile: $LogFile"

$browserPaths = Get-BrowserExecutablePaths -Name $browserKey
$browserExe = $null
foreach ($candidate in $browserPaths) {
    if ($candidate -and (Test-Path -Path $candidate -PathType Leaf)) {
        $browserExe = $candidate
        break
    }
}

if (-not $browserExe) {
    Write-Log 'INFO' ''
    Write-Log 'ERROR' "  ❌ 找不到 $browserDisplayName！" -Color Red
    Write-Log 'INFO' ''
    Write-Log 'INFO' '  請確認瀏覽器已安裝在以下路徑之一：' -Color Yellow
    foreach ($candidate in $browserPaths) {
        Write-Log 'INFO' "    - $candidate" -Color Gray
    }
    Write-Log 'INFO' ''
    exit 1
}

$ProjectRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$profileDir = Join-Path $ProjectRoot $profileDirName

Write-Log 'INFO' ''
Write-Log 'INFO' '  ========================================' -Color Cyan
Write-Log 'INFO' ("  🚀 啟動 {0} Debug 模式" -f $browserDisplayName) -Color Cyan
Write-Log 'INFO' '  ========================================' -Color Cyan
Write-Log 'INFO' ''
Write-Log 'INFO' "  🧾 啟動日誌: $LogFile" -Color Gray
Write-Log 'INFO' "  瀏覽器路徑: $browserExe" -Color Gray
Write-Log 'INFO' "  Debug 端口:  $Port" -Color Gray
Write-Log 'INFO' "  設定目錄:    $profileDir" -Color Gray
Write-Log 'INFO' ''

$portInUse = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
if ($portInUse) {
    $ownerPid = ($portInUse | Where-Object { $_.State -eq 'Listen' } | Select-Object -First 1).OwningProcess
    $isOurBrowser = $false
    if ($ownerPid) {
        try {
            $proc = Get-CimInstance Win32_Process -Filter "ProcessId=$ownerPid" -ErrorAction SilentlyContinue
            if ($proc -and $proc.CommandLine -match [regex]::Escape($profileDir)) {
                $isOurBrowser = $true
            }
        }
        catch {
        }
    }

    if ($isOurBrowser) {
        Write-Log 'INFO' ("  ✅ {0} Debug 模式已在運行（PID: {1}）" -f $browserDisplayName, $ownerPid) -Color Green
        Write-Log 'INFO' ''
        Write-Log 'INFO' "  驗證方式: 在瀏覽器中打開 http://localhost:${Port}/json/version" -Color Gray
        Write-Log 'INFO' ''
        Write-Log 'INFO' '  下一步：' -Color Cyan
        Write-Log 'INFO' ("  1. 在 {0} 中登入你的內部網站" -f $browserDisplayName) -Color White
        Write-Log 'INFO' '  2. 開啟另一個 PowerShell 視窗' -Color White
        if ($browserKey -eq 'edge') {
            Write-Log 'INFO' '  3. 執行 .\collect.ps1 --browser edge 開始蒐集素材' -Color White
        }
        else {
            Write-Log 'INFO' '  3. 執行 .\collect.ps1 開始蒐集素材' -Color White
        }
        Write-Log 'INFO' ''
        exit 0
    }

    Write-Log 'WARN' "  ⚠️  端口 $Port 已被其他程式占用！" -Color Yellow
    Write-LogOnly 'WARN' "PortOwnerPID: $ownerPid"
    Write-Log 'INFO' ''
    Write-Log 'INFO' ("  這通常是因為一般 {0} 或其他程式佔用了端口 $Port。" -f $browserDisplayName) -Color Yellow
    Write-Log 'INFO' "  建議先關閉所有相關瀏覽器視窗，再重新執行此腳本。" -Color Yellow
    Write-Log 'INFO' ''

    $continue = Read-Host '  是否要強制關閉佔用端口的程式並重新啟動？(y/N)'
    Write-LogOnly 'INFO' "UserContinue: $continue"
    if ($continue -ne 'y' -and $continue -ne 'Y') {
        exit 0
    }

    if ($ownerPid) {
        Write-Log 'INFO' "  正在關閉佔用端口的程式 (PID: $ownerPid)..." -Color Yellow
        try {
            Stop-Process -Id $ownerPid -Force -ErrorAction Stop
            Start-Sleep -Seconds 2
            Write-Log 'INFO' "  ✅ 已關閉 PID $ownerPid" -Color Green
        }
        catch {
            Write-Log 'ERROR' "  ❌ 無法關閉程式 (PID: $ownerPid): $($_.Exception.Message)" -Color Red
            Write-LogOnly 'ERROR' $_.Exception.Message
            exit 1
        }
    }
}

Write-Log 'INFO' ("  正在啟動 {0}..." -f $browserDisplayName) -Color Green
Write-Log 'INFO' ''

Start-Process -FilePath $browserExe -ArgumentList @(
    "--remote-debugging-port=$Port",
    "--user-data-dir=$profileDir",
    '--no-first-run',
    '--no-default-browser-check'
)

Start-Sleep -Seconds 3

Write-Log 'INFO' ("  驗證 {0} Debug 模式..." -f $browserDisplayName) -Color Gray
try {
    $response = Invoke-RestMethod -Uri "http://localhost:${Port}/json/version" -TimeoutSec 5
    Write-Log 'INFO' ''
    Write-Log 'INFO' ("  ✅ {0} Debug 模式已成功啟動！" -f $browserDisplayName) -Color Green
    Write-Log 'INFO' "  瀏覽器版本: $($response.Browser)" -Color Gray
    Write-LogOnly 'INFO' "webSocketDebuggerUrl: $($response.webSocketDebuggerUrl)"

    try {
        $pages = Invoke-RestMethod -Uri "http://localhost:${Port}/json/list" -TimeoutSec 5
        Write-LogOnly 'INFO' "CDP pages count: $($pages.Count)"
        foreach ($pg in $pages) {
            Write-LogOnly 'INFO' "  CDP page: type=$($pg.type) title=$($pg.title) url=$($pg.url)"
        }
    }
    catch {
    }

    Write-Log 'INFO' ''
    Write-Log 'INFO' '  下一步：' -Color Cyan
    Write-Log 'INFO' ("  1. 在 {0} 中登入你的內部網站" -f $browserDisplayName) -Color White
    Write-Log 'INFO' '  2. 開啟另一個 PowerShell 視窗' -Color White
    if ($browserKey -eq 'edge') {
        Write-Log 'INFO' '  3. 執行 .\collect.ps1 --browser edge 開始蒐集素材' -Color White
    }
    else {
        Write-Log 'INFO' '  3. 執行 .\collect.ps1 開始蒐集素材' -Color White
    }
    Write-Log 'INFO' ''
}
catch {
    Write-LogOnly 'ERROR' $_.Exception.Message
    if ($_.ScriptStackTrace) {
        Write-LogOnly 'ERROR' $_.ScriptStackTrace
    }
    Write-Log 'INFO' ''
    Write-Log 'WARN' ("  ⚠️  {0} 已啟動但尚未準備好。" -f $browserDisplayName) -Color Yellow
    Write-Log 'WARN' '  請稍等幾秒後，在瀏覽器中打開以下網址確認：' -Color Yellow
    Write-Log 'INFO' "  http://localhost:${Port}/json/version" -Color Cyan
    Write-Log 'INFO' ''
}
