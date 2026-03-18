<#
.SYNOPSIS
    Windows 一鍵安裝 / 檢查入口

.DESCRIPTION
    給一般使用者與技術人員共用的安裝腳本。
    - 一般使用者：拿到完整離線包後，直接執行即可檢查是否可用
    - 技術人員：若目前是在原始專案資料夾，且電腦上有可用的 Node.js / npm，
      腳本會協助補齊 node_modules 與專案內建 Playwright 瀏覽器元件（Chromium runtime）

.NOTES
    - 一般使用者建議直接執行 .\install.ps1
    - 若要產出可帶進內網的完整離線包，請由技術人員執行：
      .\scripts\prepare-offline-bundle.ps1

.EXAMPLE
    .\setup.ps1

.EXAMPLE
    .\setup.ps1 -Offline
#>

[CmdletBinding()]
param(
    [switch]$Offline
)

Set-StrictMode -Version 3.0
$ErrorActionPreference = "Stop"

$ProjectRoot = [System.IO.Path]::GetFullPath($PSScriptRoot)
$ResolveNodeScript = Join-Path $ProjectRoot "scripts\resolve-node-runtime.ps1"
$NodeModulesPath = Join-Path $ProjectRoot "node_modules"
$LocalBrowserPath = Join-Path $ProjectRoot ".playwright-browsers"
$RequiredEntries = @(
    @{ Name = "install.ps1"; Path = (Join-Path $ProjectRoot "install.ps1") },
    @{ Name = "collect.ps1"; Path = (Join-Path $ProjectRoot "collect.ps1") },
    @{ Name = "run-task.ps1"; Path = (Join-Path $ProjectRoot "run-task.ps1") },
    @{ Name = "launch-chrome.ps1"; Path = (Join-Path $ProjectRoot "launch-chrome.ps1") },
    @{ Name = "launch-edge.ps1"; Path = (Join-Path $ProjectRoot "launch-edge.ps1") },
    @{ Name = "collect-materials.ts"; Path = (Join-Path $ProjectRoot "collect-materials.ts") },
    @{ Name = ".env.example"; Path = (Join-Path $ProjectRoot ".env.example") },
    @{ Name = "scripts\resolve-node-runtime.ps1"; Path = $ResolveNodeScript }
)

$script:TaipeiTimeZone = [System.TimeZoneInfo]::FindSystemTimeZoneById("Taipei Standard Time")
$LogDir = Join-Path $ProjectRoot "logs"
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null

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

$LogFile = Join-Path $LogDir ("setup-" + (Format-TaipeiTimestamp -ForFile) + ".log")

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
    }
    finally {
        Pop-Location
        foreach ($key in $Environment.Keys) {
            [System.Environment]::SetEnvironmentVariable($key, $previousValues[$key], "Process")
        }
    }
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

function Get-BrowserCandidates {
    $candidates = [System.Collections.Generic.List[string]]::new()

    foreach ($candidate in @(
            $LocalBrowserPath,
            $env:PLAYWRIGHT_BROWSERS_PATH,
            (Join-Path $env:LOCALAPPDATA "ms-playwright"),
            (Join-Path $env:USERPROFILE ".cache\ms-playwright")
        )) {
        if ([string]::IsNullOrWhiteSpace($candidate)) {
            continue
        }

        if (-not $candidates.Contains($candidate)) {
            $candidates.Add($candidate)
        }
    }

    return [string[]]$candidates
}

function Resolve-FallbackBrowserSource {
    foreach ($candidate in (Get-BrowserCandidates)) {
        if (Test-PlaywrightBrowserDirectory -Path $candidate) {
            return $candidate
        }
    }

    return $null
}

function Add-Warning {
    param(
        [string]$Message
    )

    if (-not $script:Warnings.Contains($Message)) {
        $script:Warnings.Add($Message)
        Write-LogOnly "WARN" $Message
    }
}

function Add-Failure {
    param(
        [string]$Message
    )

    if (-not $script:Failures.Contains($Message)) {
        $script:Failures.Add($Message)
        Write-LogOnly "ERROR" $Message
    }
}

function Ensure-RequiredEntries {
    Write-Log "INFO" ""
    Write-Log "INFO" "  [4/4] 檢查 Windows 操作入口..." -Color White

    $missingEntries = [System.Collections.Generic.List[string]]::new()
    foreach ($entry in $RequiredEntries) {
        if (-not (Test-Path -Path $entry.Path -PathType Leaf)) {
            $missingEntries.Add($entry.Name)
        }
    }

    if ($missingEntries.Count -eq 0) {
        Write-Log "INFO" "  ✅ install / collect / launch（Chrome / Edge）與 .env.example 已就緒" -Color Green
        return
    }

    $message = "缺少必要操作入口：{0}" -f ($missingEntries -join "、")
    Write-Log "ERROR" "  ❌ $message" -Color Red
    Add-Failure $message
}

function Ensure-RuntimeHelper {
    if (-not $script:RuntimeHelperLoaded) {
        $message = "缺少可用的 scripts\resolve-node-runtime.ps1，無法判斷可用執行環境。"
        Write-Log "ERROR" "  ❌ $message" -Color Red
        Add-Failure $message
        return $false
    }

    if (-not (Get-Command -Name "Resolve-NodeRuntime" -CommandType Function -ErrorAction SilentlyContinue)) {
        $message = "已載入 runtime helper，但找不到 Resolve-NodeRuntime 函式。"
        Write-Log "ERROR" "  ❌ $message" -Color Red
        Add-Failure $message
        return $false
    }

    Write-Log "INFO" "  ✅ 已載入 runtime helper" -Color Green
    return $true
}

function Resolve-AvailableRuntime {
    try {
        return Resolve-NodeRuntime -ProjectRoot $ProjectRoot -MinimumMajorVersion 20
    }
    catch {
        $message = "找不到可用的 Node.js v20+ 執行環境。"
        Write-Log "ERROR" "  ❌ $message" -Color Red
        Write-LogOnly "ERROR" $_.Exception.Message
        Add-Failure $message
        return $null
    }
}

function Ensure-Dependencies {
    param(
        [Parameter(Mandatory)]
        [pscustomobject]$Runtime
    )

    Write-Log "INFO" ""
    Write-Log "INFO" "  [2/4] 檢查必要套件..." -Color White

    $hasNodeModules = Test-Path -Path $Runtime.NodeModulesPath -PathType Container
    $hasTsx = $Runtime.TsxCliExists
    $hasPlaywrightCli = $Runtime.PlaywrightCliExists

    if ($hasNodeModules -and $hasTsx -and $hasPlaywrightCli) {
        Write-Log "INFO" "  ✅ node_modules、tsx 與 Playwright CLI 已就緒" -Color Green
        return $true
    }

    $missingParts = [System.Collections.Generic.List[string]]::new()
    if (-not $hasNodeModules) { $missingParts.Add("node_modules") }
    if (-not $hasTsx) { $missingParts.Add("tsx CLI") }
    if (-not $hasPlaywrightCli) { $missingParts.Add("Playwright CLI") }

    if ($Offline) {
        $message = "這份安裝包不完整：缺少必要套件內容（{0}）。" -f ($missingParts -join "、")
        Write-Log "ERROR" "  ❌ $message" -Color Red
        Add-Failure $message
        return $false
    }

    if (-not $Runtime.NpmCmdExists) {
        $message = "缺少必要套件，且目前找不到可用的 npm，無法自動補齊：{0}" -f ($missingParts -join "、")
        Write-Log "ERROR" "  ❌ $message" -Color Red
        Add-Failure $message
        return $false
    }

    Write-Log "WARN" "  ⚠️  發現缺少套件，將自動執行 npm ci 補齊" -Color Yellow
    $exitCode = Invoke-LoggedCommand -FilePath $Runtime.NpmCmdPath -Arguments @("ci", "--no-fund", "--no-audit")
    if ($exitCode -ne 0) {
        $message = "npm ci 失敗（ExitCode: $exitCode）"
        Write-Log "ERROR" "  ❌ $message" -Color Red
        Add-Failure $message
        return $false
    }

    try {
        $verifiedRuntime = Resolve-NodeRuntime -ProjectRoot $ProjectRoot -MinimumMajorVersion 20 -RequireTsx -RequirePlaywright
        Write-Log "INFO" "  ✅ 已自動補齊 node_modules 與 CLI 入口" -Color Green
        $script:ResolvedRuntime = $verifiedRuntime
        return $true
    }
    catch {
        $message = "套件安裝後仍找不到 tsx 或 Playwright CLI。"
        Write-Log "ERROR" "  ❌ $message" -Color Red
        Write-LogOnly "ERROR" $_.Exception.Message
        Add-Failure $message
        return $false
    }
}

function Ensure-PlaywrightBrowser {
    param(
        [Parameter(Mandatory)]
        [pscustomobject]$Runtime
    )

    Write-Log "INFO" ""
    Write-Log "INFO" "  [3/4] 檢查專案內建 Playwright 瀏覽器元件（Chromium runtime）..." -Color White

    $localBrowserReady = Test-PlaywrightBrowserDirectory -Path $Runtime.ProjectBrowserPath
    if ($localBrowserReady) {
        $env:PLAYWRIGHT_BROWSERS_PATH = $Runtime.ProjectBrowserPath
        Write-Log "INFO" "  ✅ 已內建 Chromium runtime：$($Runtime.ProjectBrowserPath)" -Color Green
        return $true
    }

    $fallbackSource = Resolve-FallbackBrowserSource
    if ($fallbackSource -and $fallbackSource -ne $Runtime.ProjectBrowserPath) {
        if ($Offline) {
            $message = "這份安裝包不完整：缺少專案內建的 .playwright-browsers（目前只找到本機快取：$fallbackSource）。"
            Write-Log "ERROR" "  ❌ $message" -Color Red
            Add-Failure $message
            return $false
        }

        $warning = "目前可暫用本機瀏覽器快取：$fallbackSource；若要帶到別台電腦，建議先執行 .\scripts\prepare-offline-bundle.ps1"
        Write-Log "WARN" "  ⚠️  $warning" -Color Yellow
        Add-Warning $warning
        return $true
    }

    if ($Offline) {
        $message = "這份安裝包不完整：缺少專案內建 Playwright Chromium runtime（.playwright-browsers）。即使使用 Edge 模式，離線包仍需包含此目錄。"
        Write-Log "ERROR" "  ❌ $message" -Color Red
        Add-Failure $message
        return $false
    }

    if (-not $Runtime.PlaywrightCliExists) {
        $message = "缺少 Playwright CLI，無法自動安裝專案內建 Chromium runtime。"
        Write-Log "ERROR" "  ❌ $message" -Color Red
        Add-Failure $message
        return $false
    }

    Write-Log "WARN" "  ⚠️  尚未找到專案內建 Chromium runtime，將自動安裝到 .playwright-browsers" -Color Yellow
    New-Item -ItemType Directory -Force -Path $Runtime.ProjectBrowserPath | Out-Null

    $exitCode = Invoke-LoggedCommand -FilePath $Runtime.NodeExePath -Arguments @(
        $Runtime.PlaywrightCliPath,
        "install",
        "chromium"
    ) -Environment @{
        PLAYWRIGHT_BROWSERS_PATH = $Runtime.ProjectBrowserPath
    }

    if ($exitCode -ne 0) {
        $message = "Playwright Chromium runtime 安裝失敗（ExitCode: $exitCode）"
        Write-Log "ERROR" "  ❌ $message" -Color Red
        Add-Failure $message
        return $false
    }

    if (-not (Test-PlaywrightBrowserDirectory -Path $Runtime.ProjectBrowserPath)) {
        $message = "Chromium runtime 安裝後仍找不到 .playwright-browsers 內容。"
        Write-Log "ERROR" "  ❌ $message" -Color Red
        Add-Failure $message
        return $false
    }

    $env:PLAYWRIGHT_BROWSERS_PATH = $Runtime.ProjectBrowserPath
    Write-Log "INFO" "  ✅ 已安裝到 $($Runtime.ProjectBrowserPath)" -Color Green
    return $true
}

function Write-Outcome {
    param(
        [pscustomobject]$Runtime
    )

    Write-Log "INFO" ""
    Write-Log "INFO" "  ----------------------------------------" -Color DarkGray
    Write-Log "INFO" "  安裝摘要" -Color Cyan
    Write-Log "INFO" "  ----------------------------------------" -Color DarkGray

    if ($Runtime) {
        Write-Log "INFO" "  Node.js: $($Runtime.NodeVersion)" -Color Green
        Write-Log "INFO" "  執行來源: $($Runtime.NodeExePath)" -Color Gray
    }

    if ($Warnings.Count -gt 0) {
        Write-Log "INFO" ""
        Write-Log "WARN" "  注意事項：" -Color Yellow
        foreach ($warning in $Warnings) {
            Write-Log "INFO" "    - $warning" -Color Yellow
        }
    }

    if ($Failures.Count -gt 0) {
        Write-Log "INFO" ""
        if ($Offline) {
            Write-Log "ERROR" "  ❌ 這份安裝包不完整" -Color Red
            Write-Log "INFO" "  一般使用者請聯絡提供安裝包的人員重新打包。" -Color Yellow
            Write-Log "INFO" "  技術人員可在原始專案執行：" -Color Yellow
        } else {
            Write-Log "ERROR" "  ❌ 安裝未完成" -Color Red
            Write-Log "INFO" "  請先補齊上方缺少項目，或由技術人員執行：" -Color Yellow
        }
        Write-Log "INFO" "    .\scripts\prepare-offline-bundle.ps1" -Color White
        Write-Log "INFO" ""
        exit 1
    }

    Write-Log "INFO" ""
    Write-Log "INFO" "  ========================================" -Color Green
    Write-Log "INFO" "  ✅ 安裝完成" -Color Green
    Write-Log "INFO" "  ========================================" -Color Green
    Write-Log "INFO" ""
    Write-Log "INFO" "  下一步：" -Color Cyan
    Write-Log "INFO" "  1. 標準流程請執行 .\launch-chrome.ps1" -Color White
    Write-Log "INFO" "     若現場指定使用 Edge，改執行 .\launch-edge.ps1" -Color White
    Write-Log "INFO" "  2. 在瀏覽器中登入你的內部網站" -Color White
    Write-Log "INFO" "  3. 回到 PowerShell 執行 .\collect.ps1（Edge 請加 --browser edge）" -Color White
    Write-Log "INFO" "  4. 蒐集完素材、AI 生成腳本後，執行 .\run-task.ps1 src\腳本名稱.ts" -Color White
    Write-Log "INFO" ""
}

$Warnings = [System.Collections.Generic.List[string]]::new()
$Failures = [System.Collections.Generic.List[string]]::new()
$ResolvedRuntime = $null
$RuntimeHelperLoaded = $false

Write-LogOnly "INFO" "Script: $PSCommandPath"
Write-LogOnly "INFO" "PowerShell: $($PSVersionTable.PSVersion)"
Write-LogOnly "INFO" "OS: $([System.Environment]::OSVersion.VersionString)"
Write-LogOnly "INFO" "User: $env:USERNAME"
Write-LogOnly "INFO" "CWD: $PWD"
Write-LogOnly "INFO" "ProjectRoot: $ProjectRoot"
Write-LogOnly "INFO" "OfflineSwitch: $Offline"
Write-LogOnly "INFO" "LogFile: $LogFile"

Write-Log "INFO" ""
Write-Log "INFO" "  ========================================" -Color Cyan
Write-Log "INFO" "  🔧 素材蒐集工具 - Windows 安裝" -Color Cyan
Write-Log "INFO" "  ========================================" -Color Cyan
Write-Log "INFO" ""
Write-Log "INFO" "  🧾 安裝日誌: $LogFile" -Color Gray
if ($Offline) {
    Write-Log "INFO" "  ℹ️  已使用離線檢查模式，不會自動下載缺少的套件或瀏覽器。" -Color Gray
} else {
    Write-Log "INFO" "  ℹ️  若這是原始專案資料夾，腳本會自動補齊缺少的套件或瀏覽器。" -Color Gray
}
Write-Log "INFO" ""

if (Test-Path -Path $ResolveNodeScript -PathType Leaf) {
    try {
        . $ResolveNodeScript
        $runtimeResolver = Get-Command -Name "Resolve-NodeRuntime" -CommandType Function -ErrorAction SilentlyContinue
        if ($runtimeResolver) {
            Set-Item -Path Function:\script:Resolve-NodeRuntime -Value $runtimeResolver.ScriptBlock
        }
        $RuntimeHelperLoaded = $true
        Write-LogOnly "INFO" "Runtime helper loaded from: $ResolveNodeScript"
    }
    catch {
        Write-LogOnly "ERROR" $_.Exception.Message
        if ($_.ScriptStackTrace) {
            Write-LogOnly "ERROR" $_.ScriptStackTrace
        }
    }
}

if (Ensure-RuntimeHelper) {
    Write-Log "INFO" ""
    Write-Log "INFO" "  [1/4] 檢查 Node.js runtime..." -Color White
    $ResolvedRuntime = Resolve-AvailableRuntime
    if ($ResolvedRuntime) {
        Write-Log "INFO" "  ✅ Node.js $($ResolvedRuntime.NodeVersion)" -Color Green
        Write-Log "INFO" "  執行檔位置: $($ResolvedRuntime.NodeExePath)" -Color Gray

        if ($ResolvedRuntime.IsProjectRuntime) {
            Write-Log "INFO" "  已使用專案內建 runtime" -Color Gray
        } else {
            if ($Offline) {
                $message = "這份安裝包不完整：目前使用的是系統 Node.js，尚未內建專案 runtime。"
                Write-Log "ERROR" "  ❌ $message" -Color Red
                Add-Failure $message
            } else {
                $warning = "目前使用的是系統 Node.js。若要帶到沒有 Node.js / npm 的內網電腦，請先執行 .\scripts\prepare-offline-bundle.ps1"
                Write-Log "WARN" "  ⚠️  $warning" -Color Yellow
                Add-Warning $warning
            }
        }

        Ensure-Dependencies -Runtime $ResolvedRuntime | Out-Null
        if ($script:ResolvedRuntime) {
            $ResolvedRuntime = $script:ResolvedRuntime
        } else {
            try {
                $ResolvedRuntime = Resolve-NodeRuntime -ProjectRoot $ProjectRoot -MinimumMajorVersion 20 -RequireTsx -RequirePlaywright
            } catch {
                Write-LogOnly "ERROR" $_.Exception.Message
                Add-Failure "找不到可用的 tsx 或 Playwright CLI。"
            }
        }

        if ($ResolvedRuntime) {
            Ensure-PlaywrightBrowser -Runtime $ResolvedRuntime | Out-Null
        }
    }
}

Ensure-RequiredEntries
Write-Outcome -Runtime $ResolvedRuntime
