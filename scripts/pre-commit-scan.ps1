# pre-commit-scan.ps1 — Implemented T-05 by claude-opus-4.6 on 2026-02-10
# 掃描 materials/recordings/*.ts 中的敏感模式（密碼、token 等）
# 若偵測到敏感資訊，阻止 commit 並提示修正

$ErrorActionPreference = 'Stop'
$exitCode = 0

$patterns = @(
    '\.fill\([^,]+,\s*''[^'']{4,}''\)',   # .fill(selector, 'non-empty-password')
    'password\s*[:=]\s*[''"][^''"]{4,}',    # password = 'xxx' or password: 'xxx'
    'token\s*[:=]\s*[''"][^''"]{4,}',       # token = 'xxx'
    'secret\s*[:=]\s*[''"][^''"]{4,}'       # secret = 'xxx'
)

$recordings = Get-ChildItem -Path "materials/recordings" -Filter "*.ts" -ErrorAction SilentlyContinue

if (-not $recordings) {
    exit 0
}

foreach ($file in $recordings) {
    $content = Get-Content -Path $file.FullName -Raw -ErrorAction SilentlyContinue
    if (-not $content) { continue }
    foreach ($pat in $patterns) {
        if ($content -match $pat) {
            Write-Host "❌ 敏感資訊偵測: $($file.Name) 匹配模式 [$pat]" -ForegroundColor Red
            $exitCode = 1
        }
    }
}

if ($exitCode -ne 0) {
    Write-Host ""
    Write-Host "🚫 commit 被阻止：錄製檔中偵測到疑似敏感資訊。" -ForegroundColor Red
    Write-Host "   請執行 sanitizeRecording 清理後再 commit。" -ForegroundColor Yellow
    Write-Host ""
}

exit $exitCode
