<#
.SYNOPSIS
    解析專案可用的 Node.js 執行環境（優先專案內建，再退回系統安裝）

.DESCRIPTION
    供其他 PowerShell 腳本共用：統一取得專案根目錄、node.exe 路徑、版本資訊，
    以及可直接透過 node.exe 執行的 tsx / Playwright CLI 路徑，不必依賴 npm / npx。

.EXAMPLE
    . "$PSScriptRoot\resolve-node-runtime.ps1"
    $runtime = Resolve-NodeRuntime -RequireTsx -RequirePlaywright
    & $runtime.NodeExePath $runtime.TsxCliPath "collect-materials.ts" "--snapshot"

.EXAMPLE
    .\scripts\resolve-node-runtime.ps1 -RequireTsx | Format-List
#>

[CmdletBinding()]
param(
    [string]$ProjectRoot = (Join-Path $PSScriptRoot ".."),
    [int]$MinimumMajorVersion = 20,
    [switch]$RequireTsx,
    [switch]$RequirePlaywright
)

Set-StrictMode -Version 3.0
$ErrorActionPreference = "Stop"
$script:IsDotSourced = $MyInvocation.InvocationName -eq '.'

function ConvertTo-AbsolutePath {
    param(
        [Parameter(Mandatory)]
        [string]$Path
    )

    return [System.IO.Path]::GetFullPath($Path)
}

function Join-MessageLines {
    param(
        [string[]]$Lines
    )

    return (($Lines | ForEach-Object {
                if ($null -eq $_) { '' } else { [string]$_ }
            }) -join [Environment]::NewLine).TrimEnd()
}

function Get-ProjectRuntimeSearchRoots {
    param(
        [Parameter(Mandatory)]
        [string]$ProjectRoot
    )

    return @(
        (Join-Path $ProjectRoot "runtime"),
        (Join-Path $ProjectRoot "tools"),
        (Join-Path $ProjectRoot "vendor"),
        (Join-Path $ProjectRoot ".runtime"),
        (Join-Path $ProjectRoot ".tools")
    ) | ForEach-Object { ConvertTo-AbsolutePath -Path $_ }
}

function Get-ProjectNodeCandidates {
    param(
        [Parameter(Mandatory)]
        [string]$ProjectRoot
    )

    $searchRoots = Get-ProjectRuntimeSearchRoots -ProjectRoot $ProjectRoot
    $candidates = [System.Collections.Generic.List[object]]::new()
    $seenPaths = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)

    foreach ($searchRoot in $searchRoots) {
        if (-not (Test-Path -Path $searchRoot -PathType Container)) {
            continue
        }

        $directFolders = @(
            $searchRoot,
            (Join-Path $searchRoot "node"),
            (Join-Path $searchRoot "nodejs")
        )

        foreach ($folder in $directFolders) {
            $nodeExePath = Join-Path $folder "node.exe"
            if ((Test-Path -Path $nodeExePath -PathType Leaf) -and $seenPaths.Add($nodeExePath)) {
                $candidates.Add([pscustomobject]@{
                    Path             = ConvertTo-AbsolutePath -Path $nodeExePath
                    IsProjectRuntime = $true
                    RuntimeKind      = "project-portable"
                    ResolvedFrom     = ConvertTo-AbsolutePath -Path $folder
                })
            }
        }

        $portableFolders = Get-ChildItem -Path $searchRoot -Directory -ErrorAction SilentlyContinue |
            Where-Object {
                $_.Name -match '^node($|[-._])' -or
                $_.Name -match '^nodejs($|[-._])' -or
                $_.Name -match '^node-v\d+'
            }

        foreach ($folder in $portableFolders) {
            $nodeExePath = Join-Path $folder.FullName "node.exe"
            if ((Test-Path -Path $nodeExePath -PathType Leaf) -and $seenPaths.Add($nodeExePath)) {
                $candidates.Add([pscustomobject]@{
                    Path             = ConvertTo-AbsolutePath -Path $nodeExePath
                    IsProjectRuntime = $true
                    RuntimeKind      = "project-portable"
                    ResolvedFrom     = ConvertTo-AbsolutePath -Path $folder.FullName
                })
            }
        }
    }

    return [object[]]$candidates
}

function Get-SystemNodeCandidates {
    $candidates = [System.Collections.Generic.List[object]]::new()
    $seenPaths = [System.Collections.Generic.HashSet[string]]::new([System.StringComparer]::OrdinalIgnoreCase)

    try {
        $command = Get-Command -Name "node" -CommandType Application -ErrorAction Stop | Select-Object -First 1
        if ($command -and $command.Source -and $seenPaths.Add($command.Source)) {
            $candidates.Add([pscustomobject]@{
                Path             = ConvertTo-AbsolutePath -Path $command.Source
                IsProjectRuntime = $false
                RuntimeKind      = "system-install"
                ResolvedFrom     = "PATH"
            })
        }
    } catch {
        # PATH 中沒有 node 時，改檢查常見安裝位置。
    }

    $commonInstallPaths = @(
        "${env:ProgramFiles}\nodejs\node.exe",
        "${env:ProgramFiles(x86)}\nodejs\node.exe",
        "${env:LOCALAPPDATA}\Programs\nodejs\node.exe"
    )

    foreach ($installPath in $commonInstallPaths) {
        if (-not $installPath) {
            continue
        }

        if ((Test-Path -Path $installPath -PathType Leaf) -and $seenPaths.Add($installPath)) {
            $candidates.Add([pscustomobject]@{
                Path             = ConvertTo-AbsolutePath -Path $installPath
                IsProjectRuntime = $false
                RuntimeKind      = "system-install"
                ResolvedFrom     = "Common install path"
            })
        }
    }

    return [object[]]$candidates
}

function Get-NodeVersionInfo {
    param(
        [Parameter(Mandatory)]
        [string]$NodeExePath
    )

    $versionOutput = @(& $NodeExePath "--version" 2>&1)
    $exitCodeVariable = Get-Variable -Name LASTEXITCODE -ErrorAction SilentlyContinue
    $exitCode = if ($exitCodeVariable) { [int]$exitCodeVariable.Value } else { 0 }
    $versionText = $null

    if ($versionOutput.Count -gt 0) {
        $versionText = $versionOutput[0].ToString().Trim()
    }

    if ($exitCode -ne 0 -or [string]::IsNullOrWhiteSpace($versionText)) {
        $errorDetails = @(
            "無法讀取 Node.js 版本資訊。"
            "位置：$NodeExePath"
            "ExitCode：$exitCode"
        )

        if (-not [string]::IsNullOrWhiteSpace($versionText)) {
            $errorDetails += "輸出：$versionText"
        }

        throw (Join-MessageLines $errorDetails)
    }

    $normalizedVersion = $versionText -replace '^[vV]', ''
    $parsedVersion = $null
    if (-not [System.Version]::TryParse($normalizedVersion, [ref]$parsedVersion)) {
        throw (Join-MessageLines @(
            "Node.js 版本格式無法辨識：$versionText"
            "位置：$NodeExePath"
        ))
    }

    return [pscustomobject]@{
        RawVersion = $versionText
        Version    = $parsedVersion
        Major      = $parsedVersion.Major
    }
}

function Resolve-ProjectCliPath {
    param(
        [Parameter(Mandatory)]
        [string]$ProjectRoot,

        [Parameter(Mandatory)]
        [string]$RelativePath,

        [Parameter(Mandatory)]
        [string]$DisplayName,

        [switch]$Required
    )

    $fullPath = ConvertTo-AbsolutePath -Path (Join-Path $ProjectRoot $RelativePath)
    $exists = Test-Path -Path $fullPath -PathType Leaf

    if ($Required -and -not $exists) {
        throw (Join-MessageLines @(
            "❌ 找不到 $DisplayName 執行入口。"
            "預期路徑：$fullPath"
            ""
            "這通常代表專案相依套件尚未準備完成。"
            "請確認已帶入完整專案資料夾（含 node_modules），或先執行安裝流程。"
        ))
    }

    return [pscustomobject]@{
        Path   = $fullPath
        Exists = $exists
    }
}

function Resolve-NodeRuntime {
    [CmdletBinding()]
    param(
        [string]$ProjectRoot = (Join-Path $PSScriptRoot ".."),
        [int]$MinimumMajorVersion = 20,
        [switch]$RequireTsx,
        [switch]$RequirePlaywright
    )

    $resolvedProjectRoot = ConvertTo-AbsolutePath -Path $ProjectRoot
    if (-not (Test-Path -Path $resolvedProjectRoot -PathType Container)) {
        throw (Join-MessageLines @(
            "❌ 找不到專案根目錄。"
            "指定路徑：$resolvedProjectRoot"
        ))
    }

    $projectCandidates = @(Get-ProjectNodeCandidates -ProjectRoot $resolvedProjectRoot)
    $systemCandidates = @(Get-SystemNodeCandidates)
    $orderedCandidates = @($projectCandidates) + @($systemCandidates)
    $rejections = [System.Collections.Generic.List[string]]::new()

    $selectedRuntime = $null
    $selectedVersion = $null

    foreach ($candidate in $orderedCandidates) {
        try {
            $versionInfo = Get-NodeVersionInfo -NodeExePath $candidate.Path
            if ($versionInfo.Major -lt $MinimumMajorVersion) {
                $rejections.Add("- $($candidate.Path) → 版本 $($versionInfo.RawVersion)（需要 v$MinimumMajorVersion 以上）")
                continue
            }

            $selectedRuntime = $candidate
            $selectedVersion = $versionInfo
            break
        } catch {
            $rejections.Add("- $($candidate.Path) → $($_.Exception.Message -replace '\r?\n', ' ')")
        }
    }

    if (-not $selectedRuntime) {
        $searchRoots = Get-ProjectRuntimeSearchRoots -ProjectRoot $resolvedProjectRoot

        if ($orderedCandidates.Count -eq 0) {
            throw (Join-MessageLines @(
                "❌ 找不到可用的 Node.js 執行環境。"
                ""
                "此工具需要 Node.js v$MinimumMajorVersion 以上。"
                "已檢查："
                "- 專案內建 runtime："
                ($searchRoots | ForEach-Object { "  - $_" })
                "- 系統安裝：PATH 與常見的 Windows 安裝路徑"
                ""
                "請確認下列其中一項已完成："
                "1. 將可攜版 Node.js 放到 runtime\node\ 或 tools\node\ 之類的專案目錄"
                "2. 或安裝 Node.js v$MinimumMajorVersion 以上後，重新開啟 PowerShell 視窗"
            ))
        }

        throw (Join-MessageLines @(
            "❌ 找到了 Node.js，但目前沒有可用的 v$MinimumMajorVersion 以上執行環境。"
            ""
            "已檢查結果："
            $rejections
            ""
            "請改用專案內建的可攜版 Node.js，或升級系統安裝的 Node.js 後再重試。"
        ))
    }

    $tsxCli = Resolve-ProjectCliPath -ProjectRoot $resolvedProjectRoot -RelativePath "node_modules\tsx\dist\cli.mjs" -DisplayName "tsx" -Required:$RequireTsx
    $playwrightCli = Resolve-ProjectCliPath -ProjectRoot $resolvedProjectRoot -RelativePath "node_modules\playwright\cli.js" -DisplayName "Playwright" -Required:$RequirePlaywright
    $tsxCmd = Resolve-ProjectCliPath -ProjectRoot $resolvedProjectRoot -RelativePath "node_modules\.bin\tsx.cmd" -DisplayName "tsx.cmd"
    $playwrightCmd = Resolve-ProjectCliPath -ProjectRoot $resolvedProjectRoot -RelativePath "node_modules\.bin\playwright.cmd" -DisplayName "playwright.cmd"

    $nodeDirectoryPath = ConvertTo-AbsolutePath -Path (Split-Path -Parent $selectedRuntime.Path)
    $npmCmdPath = ConvertTo-AbsolutePath -Path (Join-Path $nodeDirectoryPath "npm.cmd")
    $npxCmdPath = ConvertTo-AbsolutePath -Path (Join-Path $nodeDirectoryPath "npx.cmd")
    $projectBrowserPath = ConvertTo-AbsolutePath -Path (Join-Path $resolvedProjectRoot ".playwright-browsers")

    return [pscustomobject]@{
        ProjectRoot           = $resolvedProjectRoot
        MinimumMajorVersion   = $MinimumMajorVersion
        NodeExePath           = $selectedRuntime.Path
        NodeVersion           = $selectedVersion.RawVersion
        NodeMajorVersion      = $selectedVersion.Major
        IsProjectRuntime      = $selectedRuntime.IsProjectRuntime
        RuntimeKind           = $selectedRuntime.RuntimeKind
        NodeResolvedFrom      = $selectedRuntime.ResolvedFrom
        NodeDirectoryPath     = $nodeDirectoryPath
        NodeModulesPath       = ConvertTo-AbsolutePath -Path (Join-Path $resolvedProjectRoot "node_modules")
        ProjectBrowserPath    = $projectBrowserPath
        NpmCmdPath            = $npmCmdPath
        NpmCmdExists          = Test-Path -Path $npmCmdPath -PathType Leaf
        NpxCmdPath            = $npxCmdPath
        NpxCmdExists          = Test-Path -Path $npxCmdPath -PathType Leaf
        TsxCliPath            = $tsxCli.Path
        TsxCliExists          = $tsxCli.Exists
        TsxCmdPath            = $tsxCmd.Path
        TsxCmdExists          = $tsxCmd.Exists
        PlaywrightCliPath     = $playwrightCli.Path
        PlaywrightCliExists   = $playwrightCli.Exists
        PlaywrightCmdPath     = $playwrightCmd.Path
        PlaywrightCmdExists   = $playwrightCmd.Exists
        RuntimeSearchRoots    = Get-ProjectRuntimeSearchRoots -ProjectRoot $resolvedProjectRoot
    }
}

if (-not $script:IsDotSourced) {
    try {
        Resolve-NodeRuntime -ProjectRoot $ProjectRoot -MinimumMajorVersion $MinimumMajorVersion -RequireTsx:$RequireTsx -RequirePlaywright:$RequirePlaywright
    } catch {
        Write-Host $_.Exception.Message -ForegroundColor Red
        exit 1
    }
}
