<#
.SYNOPSIS
    準備可帶入內網的完整 Windows 離線安裝包

.DESCRIPTION
    供技術人員 / 打包者使用。
    這支腳本會把專案整理成一份完整離線包，重點補齊：
    - 專案內建 Node.js runtime（runtime\node）
    - node_modules
    - 專案本地 .playwright-browsers
    - install.ps1 / setup.ps1 / launch-chrome.ps1 / collect.ps1 入口

.NOTES
    - 這支腳本可借用系統 Node.js 來打包
    - 最終產物的目標是：一般使用者端不需要 npm

.EXAMPLE
    .\scripts\prepare-offline-bundle.ps1

.EXAMPLE
    .\scripts\prepare-offline-bundle.ps1 -DestinationPath D:\offline-bundles\collector
#>

[CmdletBinding()]
param(
    [string]$DestinationPath,
    [string]$PortableNodeSource,
    [string]$BrowserSource,
    [switch]$Force,
    [switch]$SkipDependencyInstall,
    [switch]$SkipBrowserInstall
)

Set-StrictMode -Version 3.0
$ErrorActionPreference = "Stop"

$ProjectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot "..")).Path
$ResolveNodeScript = Join-Path $ProjectRoot "scripts\resolve-node-runtime.ps1"
$script:TaipeiTimeZone = [System.TimeZoneInfo]::FindSystemTimeZoneById("Taipei Standard Time")

function Get-TaipeiNow {
    return [System.TimeZoneInfo]::ConvertTimeFromUtc([DateTime]::UtcNow, $script:TaipeiTimeZone)
}

function Format-TaipeiTimestamp {
    param(
        [switch]$ForFile
    )

    $format = if ($ForFile) { "yyyyMMdd-HHmmss" } else { "yyyy-MM-dd HH:mm:ss.fff" }
    return (Get-TaipeiNow).ToString($format, [System.Globalization.CultureInfo]::InvariantCulture)
}

function ConvertTo-AbsolutePath {
    param(
        [Parameter(Mandatory)]
        [string]$Path
    )

    return [System.IO.Path]::GetFullPath($Path)
}

function Test-PlaywrightBrowserDirectory {
    param(
        [string]$Path
    )

    if ([string]::IsNullOrWhiteSpace($Path) -or -not (Test-Path -Path $Path -PathType Container)) {
        return $false
    }

    $chromiumFolders = Get-ChildItem -Path $Path -Directory -ErrorAction SilentlyContinue |
        Where-Object {
            $_.Name -like "chromium-*" -or
            $_.Name -like "chromium_headless_shell-*"
        }
    return ($chromiumFolders | Measure-Object).Count -gt 0
}

function Write-Log {
    param(
        [string]$Level,
        [string]$Message,
        [ConsoleColor]$Color = [ConsoleColor]::Gray
    )

    if ($Message -eq "") {
        Add-Content -Path $LogFile -Value ""
        Write-Host ""
        return
    }

    $line = "[{0}][{1}] {2}" -f (Format-TaipeiTimestamp), $Level.ToUpperInvariant(), $Message
    Add-Content -Path $LogFile -Value $line
    Write-Host $Message -ForegroundColor $Color
}

function Write-LogOnly {
    param(
        [string]$Level,
        [string]$Message
    )

    $line = "[{0}][{1}] {2}" -f (Format-TaipeiTimestamp), $Level.ToUpperInvariant(), $Message
    Add-Content -Path $LogFile -Value $line
}

function Resolve-RuntimeSourceDirectory {
    param(
        [Parameter(Mandatory)]
        [string]$ResolvedNodeExePath,

        [string]$PreferredSource
    )

    $candidates = [System.Collections.Generic.List[string]]::new()

    if (-not [string]::IsNullOrWhiteSpace($PreferredSource)) {
        $candidates.Add((ConvertTo-AbsolutePath -Path $PreferredSource))
    }

    $candidates.Add((Split-Path -Path $ResolvedNodeExePath -Parent))

    foreach ($candidate in $candidates) {
        if ([string]::IsNullOrWhiteSpace($candidate)) {
            continue
        }

        if (Test-Path -Path $candidate -PathType Leaf) {
            $candidate = Split-Path -Path $candidate -Parent
        }

        $nodeExe = Join-Path $candidate "node.exe"
        if (Test-Path -Path $nodeExe -PathType Leaf) {
            return $candidate
        }
    }

    throw "找不到可用的 Node.js runtime 來源資料夾。"
}

function Resolve-NpmCliPath {
    param(
        [Parameter(Mandatory)]
        [string]$RuntimeDirectory
    )

    $candidates = @(
        (Join-Path $RuntimeDirectory "node_modules\npm\bin\npm-cli.js"),
        (Join-Path $RuntimeDirectory "..\node_modules\npm\bin\npm-cli.js")
    ) | ForEach-Object { [System.IO.Path]::GetFullPath($_) }

    foreach ($candidate in $candidates) {
        if (Test-Path -Path $candidate -PathType Leaf) {
            return $candidate
        }
    }

    return $null
}

function Resolve-BrowserSourceDirectory {
    param(
        [string]$PreferredSource
    )

    $candidates = [System.Collections.Generic.List[string]]::new()
    if (-not [string]::IsNullOrWhiteSpace($PreferredSource)) {
        $candidates.Add((ConvertTo-AbsolutePath -Path $PreferredSource))
    }

    $candidates.Add((Join-Path $ProjectRoot ".playwright-browsers"))
    if (-not [string]::IsNullOrWhiteSpace($env:PLAYWRIGHT_BROWSERS_PATH)) {
        $candidates.Add($env:PLAYWRIGHT_BROWSERS_PATH)
    }
    if (-not [string]::IsNullOrWhiteSpace($env:LOCALAPPDATA)) {
        $candidates.Add((Join-Path $env:LOCALAPPDATA "ms-playwright"))
    }
    if (-not [string]::IsNullOrWhiteSpace($env:USERPROFILE)) {
        $candidates.Add((Join-Path $env:USERPROFILE ".cache\ms-playwright"))
    }

    foreach ($candidate in $candidates) {
        if (Test-PlaywrightBrowserDirectory -Path $candidate) {
            return $candidate
        }
    }

    return $null
}

function Invoke-LoggedCommand {
    param(
        [Parameter(Mandatory)]
        [string]$FilePath,

        [string[]]$Arguments = @(),

        [string]$WorkingDirectory = $ProjectRoot,

        [hashtable]$Environment = @{}
    )

    $previousValues = @{}
    foreach ($key in $Environment.Keys) {
        $previousValues[$key] = [System.Environment]::GetEnvironmentVariable($key, "Process")
        [System.Environment]::SetEnvironmentVariable($key, [string]$Environment[$key], "Process")
    }

    Push-Location $WorkingDirectory
    try {
        Write-Log "INFO" ("  ➜ 執行: {0} {1}" -f $FilePath, ($Arguments -join " ")) -Color Gray
        & $FilePath @Arguments 2>&1 | ForEach-Object {
            $line = $_.ToString()
            if ([string]::IsNullOrWhiteSpace($line)) {
                Write-LogOnly "INFO" ""
            } else {
                Write-LogOnly "INFO" $line
                Write-Host "    $line" -ForegroundColor DarkGray
            }
        }
        return $LASTEXITCODE
    } finally {
        Pop-Location
        foreach ($key in $Environment.Keys) {
            [System.Environment]::SetEnvironmentVariable($key, $previousValues[$key], "Process")
        }
    }
}

function Invoke-RobocopyDirectory {
    param(
        [Parameter(Mandatory)]
        [string]$Source,

        [Parameter(Mandatory)]
        [string]$Destination,

        [string[]]$ExtraArgs = @()
    )

    $Source = ConvertTo-AbsolutePath -Path $Source
    $Destination = ConvertTo-AbsolutePath -Path $Destination

    New-Item -ItemType Directory -Force -Path $Destination | Out-Null

    $arguments = @(
        $Source,
        $Destination,
        "/E",
        "/R:2",
        "/W:1",
        "/NFL",
        "/NDL",
        "/NJH",
        "/NJS",
        "/NP"
    ) + $ExtraArgs

    Write-Log "INFO" ("  ➜ 複製資料夾: {0} -> {1}" -f $Source, $Destination) -Color Gray
    & robocopy @arguments | ForEach-Object {
        $line = $_.ToString()
        if (-not [string]::IsNullOrWhiteSpace($line)) {
            Write-LogOnly "INFO" $line
        }
    }

    $exitCode = $LASTEXITCODE
    if ($exitCode -ge 8) {
        throw "Robocopy 失敗（ExitCode: $exitCode）：$Source -> $Destination"
    }
}

if ([string]::IsNullOrWhiteSpace($DestinationPath)) {
    $DestinationPath = Join-Path $ProjectRoot ("output\offline-bundles\web-material-collector-offline-" + (Format-TaipeiTimestamp -ForFile))
}
$DestinationPath = ConvertTo-AbsolutePath -Path $DestinationPath
$BundleRoot = $DestinationPath
$BundleRuntimeDir = Join-Path $BundleRoot "runtime\node"
$BundleNodeExe = Join-Path $BundleRuntimeDir "node.exe"
$BundleNodeModules = Join-Path $BundleRoot "node_modules"
$BundlePlaywrightCli = Join-Path $BundleRoot "node_modules\playwright\cli.js"
$BundleBrowserPath = Join-Path $BundleRoot ".playwright-browsers"
$BundleInstallScript = Join-Path $BundleRoot "install.ps1"

$LogDir = Join-Path $ProjectRoot "logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$LogFile = Join-Path $LogDir ("prepare-offline-bundle-" + (Format-TaipeiTimestamp -ForFile) + ".log")

Write-LogOnly "INFO" "Script: $PSCommandPath"
Write-LogOnly "INFO" "PowerShell: $($PSVersionTable.PSVersion)"
Write-LogOnly "INFO" "OS: $([System.Environment]::OSVersion.VersionString)"
Write-LogOnly "INFO" "User: $env:USERNAME"
Write-LogOnly "INFO" "ProjectRoot: $ProjectRoot"
Write-LogOnly "INFO" "DestinationPath: $BundleRoot"
Write-LogOnly "INFO" "LogFile: $LogFile"

Write-Log "INFO" ""
Write-Log "INFO" "  ========================================" -Color Cyan
Write-Log "INFO" "  📦 準備完整離線安裝包" -Color Cyan
Write-Log "INFO" "  ========================================" -Color Cyan
Write-Log "INFO" ""
Write-Log "INFO" "  🧾 打包日誌: $LogFile" -Color Gray
Write-Log "INFO" "  📁 目的地: $BundleRoot" -Color Gray
Write-Log "INFO" ""

if (-not (Test-Path -Path $ResolveNodeScript -PathType Leaf)) {
    throw "找不到 scripts\resolve-node-runtime.ps1，無法準備離線包。"
}

. $ResolveNodeScript
$runtime = Resolve-NodeRuntime -ProjectRoot $ProjectRoot -MinimumMajorVersion 20
Write-Log "INFO" ("  ✅ 目前可用 Node.js: {0} ({1})" -f $runtime.NodeVersion, $runtime.NodeExePath) -Color Green

if (Test-Path -Path $BundleRoot) {
    if (-not $Force) {
        throw "目的地已存在：$BundleRoot`n如要覆蓋，請重新執行並加入 -Force。"
    }

    Write-Log "INFO" "  🧹 已指定 -Force，先清除舊的目的地資料夾..." -Color Yellow
    Remove-Item -Path $BundleRoot -Recurse -Force
}

New-Item -ItemType Directory -Force -Path $BundleRoot | Out-Null

Write-Log "INFO" ""
Write-Log "INFO" "  [1/5] 複製專案檔案..." -Color White
$excludeDirectories = @(
    ".git",
    "output",
    "logs",
    "chrome-debug-profile",
    "materials"
)

if ($BundleRoot.StartsWith($ProjectRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    $excludeDirectories += $BundleRoot
}

$copyArgs = @("/XD") + $excludeDirectories + @("/XF", "*.log")
Invoke-RobocopyDirectory -Source $ProjectRoot -Destination $BundleRoot -ExtraArgs $copyArgs

Write-Log "INFO" ""
Write-Log "INFO" "  [2/5] 補齊專案內建 Node.js runtime..." -Color White
$runtimeSourceDir = Resolve-RuntimeSourceDirectory -ResolvedNodeExePath $runtime.NodeExePath -PreferredSource $PortableNodeSource
Write-LogOnly "INFO" "RuntimeSourceDir: $runtimeSourceDir"
Invoke-RobocopyDirectory -Source $runtimeSourceDir -Destination $BundleRuntimeDir

if (-not (Test-Path -Path $BundleNodeExe -PathType Leaf)) {
    throw "複製 runtime 後仍找不到 node.exe：$BundleNodeExe"
}

Write-Log "INFO" ("  ✅ 已內建 Node.js runtime：{0}" -f $BundleNodeExe) -Color Green

Write-Log "INFO" ""
Write-Log "INFO" "  [3/5] 確認 node_modules..." -Color White
$bundleDependenciesReady =
    (Test-Path -Path $BundleNodeModules -PathType Container) -and
    (Test-Path -Path (Join-Path $BundleRoot "node_modules\tsx\dist\cli.mjs") -PathType Leaf) -and
    (Test-Path -Path $BundlePlaywrightCli -PathType Leaf)

if (-not $bundleDependenciesReady) {
    if ($SkipDependencyInstall) {
        throw "目的地缺少完整 node_modules，且已指定 -SkipDependencyInstall，無法繼續。"
    }

    $bundleNpmCli = Resolve-NpmCliPath -RuntimeDirectory $BundleRuntimeDir
    if (-not $bundleNpmCli) {
        throw "找不到 npm-cli.js，無法在 bundle 內補安裝 node_modules。"
    }

    $npmCommand = if (Test-Path -Path (Join-Path $BundleRoot "package-lock.json") -PathType Leaf) { "ci" } else { "install" }
    $npmExitCode = Invoke-LoggedCommand -FilePath $BundleNodeExe -WorkingDirectory $BundleRoot -Environment @{
        PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD = "1"
    } -Arguments @(
        $bundleNpmCli,
        $npmCommand,
        "--no-fund",
        "--no-audit"
    )

    if ($npmExitCode -ne 0) {
        throw "npm $npmCommand 失敗（ExitCode: $npmExitCode）。"
    }
}

if (-not (
        (Test-Path -Path $BundleNodeModules -PathType Container) -and
        (Test-Path -Path (Join-Path $BundleRoot "node_modules\tsx\dist\cli.mjs") -PathType Leaf) -and
        (Test-Path -Path $BundlePlaywrightCli -PathType Leaf)
    )) {
    throw "bundle 仍缺少 node_modules / tsx / Playwright CLI。"
}

Write-Log "INFO" "  ✅ node_modules 已就緒" -Color Green

Write-Log "INFO" ""
Write-Log "INFO" "  [4/5] 準備專案本地 Playwright Chromium..." -Color White
if (-not (Test-PlaywrightBrowserDirectory -Path $BundleBrowserPath)) {
    $browserSourceDir = Resolve-BrowserSourceDirectory -PreferredSource $BrowserSource
    if ($browserSourceDir) {
        Write-LogOnly "INFO" "BrowserSourceDir: $browserSourceDir"
        Invoke-RobocopyDirectory -Source $browserSourceDir -Destination $BundleBrowserPath
    }
}

if (-not (Test-PlaywrightBrowserDirectory -Path $BundleBrowserPath)) {
    if ($SkipBrowserInstall) {
        throw "bundle 缺少 Playwright Chromium，且已指定 -SkipBrowserInstall，無法繼續。"
    }

    $browserInstallExitCode = Invoke-LoggedCommand -FilePath $BundleNodeExe -WorkingDirectory $BundleRoot -Environment @{
        PLAYWRIGHT_BROWSERS_PATH = $BundleBrowserPath
    } -Arguments @(
        $BundlePlaywrightCli,
        "install",
        "chromium"
    )

    if ($browserInstallExitCode -ne 0) {
        throw "Playwright chromium 安裝失敗（ExitCode: $browserInstallExitCode）。"
    }
}

if (-not (Test-PlaywrightBrowserDirectory -Path $BundleBrowserPath)) {
    throw "bundle 仍缺少 .playwright-browsers\chromium-*。"
}

Write-Log "INFO" ("  ✅ Chromium 已就緒：{0}" -f $BundleBrowserPath) -Color Green

Write-Log "INFO" ""
Write-Log "INFO" "  [5/5] 驗證離線包..." -Color White
$pwshExe = (Get-Process -Id $PID).Path
$validationExitCode = Invoke-LoggedCommand -FilePath $pwshExe -WorkingDirectory $BundleRoot -Arguments @(
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-File", $BundleInstallScript
)

if ($validationExitCode -ne 0) {
    throw "離線包驗證失敗（install.ps1 ExitCode: $validationExitCode）。"
}

Write-Log "INFO" ""
Write-Log "INFO" "  ========================================" -Color Green
Write-Log "INFO" "  ✅ 離線安裝包已準備完成" -Color Green
Write-Log "INFO" "  ========================================" -Color Green
Write-Log "INFO" ""
Write-Log "INFO" "  交付給一般使用者時，請告知他們直接執行：" -Color Cyan
Write-Log "INFO" "    .\install.ps1" -Color White
Write-Log "INFO" ""
Write-Log "INFO" "  離線包位置：" -Color Cyan
Write-Log "INFO" "    $BundleRoot" -Color White
Write-Log "INFO" ""
exit 0
