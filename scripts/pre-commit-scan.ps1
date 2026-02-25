# pre-commit-scan.ps1
# 用途：在 commit 前掃描 materials/recordings/*.ts 是否包含疑似敏感資訊（密碼、token 等）。
# 結果：
# - 沒有命中規則：正常結束（exit 0，可 commit）
# - 命中任一規則：顯示警告並結束（exit 1，阻止 commit）

# 發生未預期錯誤就直接停止，避免漏掃描。
$ErrorActionPreference = 'Stop'

# 預設可通過；只要命中一條規則就改為 1（阻止 commit）。
$exitCode = 0

# 敏感資料偵測規則（正規表示式）：
# 目標是抓出常見「看起來像明文憑證」的內容。
$patterns = @(
    '\.fill\([^,]+,\s*''[^'']{4,}''\)',   # .fill(selector, 'non-empty-password')
    'password\s*[:=]\s*[''"][^''"]{4,}',    # password = 'xxx' or password: 'xxx'
    'token\s*[:=]\s*[''"][^''"]{4,}',       # token = 'xxx'
    'secret\s*[:=]\s*[''"][^''"]{4,}'       # secret = 'xxx'
)

# 只掃描錄製腳本；資料夾不存在時不報錯，直接視為沒有可掃描檔案。
$recordings = Get-ChildItem -Path "materials/recordings" -Filter "*.ts" -ErrorAction SilentlyContinue

# 沒有錄製檔就直接放行，維持 pre-commit 流程順暢。
if (-not $recordings) {
    exit 0
}

# 逐檔逐規則比對；命中時列印檔名與規則，方便快速定位修正。
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

# 失敗處理與輸出：統一提示如何補救（先清理再 commit）。
if ($exitCode -ne 0) {
    Write-Host ""
    Write-Host "🚫 commit 被阻止：錄製檔中偵測到疑似敏感資訊。" -ForegroundColor Red
    Write-Host "   請執行 sanitizeRecording 清理後再 commit。" -ForegroundColor Yellow
    Write-Host ""
}

# 回傳掃描結果給 git hook（0=成功，1=阻擋）。
exit $exitCode
