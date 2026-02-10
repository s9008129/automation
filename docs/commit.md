# Commit 與 Push 完整指引

> **版本**：2.0.0
> **更新日期**：2026-02-10
> **適用範圍**：`web-material-collector` 專案所有貢獻者（人類與 AI 自動化）

---

## 目錄

1. [目的與適用範圍](#1-目的與適用範圍)
2. [Commit Message 規範](#2-commit-message-規範)
3. [本地 Commit 流程（完整步驟）](#3-本地-commit-流程完整步驟)
4. [安全檢查清單](#4-安全檢查清單)
5. [推送與遠端作業](#5-推送與遠端作業)
6. [CI 自動化檢查](#6-ci-自動化檢查)
7. [Author 欄位與自動化 Bot](#7-author-欄位與自動化-bot)
8. [附錄：Git Hooks 管理](#8-附錄git-hooks-管理)

---

## 1. 目的與適用範圍

### 目的

本文件規範 `web-material-collector` 專案的 **commit 訊息格式**、**提交流程**、**安全檢查**，確保：

- 每一筆 commit 都有清晰的語意與可追溯性
- 敏感資訊（密碼、token）不會被意外提交至版本庫
- 人類開發者與 AI 自動化 bot 遵循相同標準

### 適用範圍

| 對象 | 說明 |
|------|------|
| 人類開發者 | 手動提交程式碼變更 |
| AI 自動化 bot | GitHub Copilot、Claude Code 等 AI 輔助工具自動提交 |
| CI/CD 管線 | 自動化驗證與品質閘門 |

### 語言規範

- **Commit 訊息**：繁體中文（zh-TW），技術名詞可保留英文
- **時區**：Asia/Taipei（UTC+8）

---

## 2. Commit Message 規範

### 格式

```
<type>(<scope>): <簡短摘要>

## 意圖與情境
- 用戶想要達成什麼目標
- 在什麼背景下提出需求

## 執行內容
- 具體做了哪些修改
- 新增/修改/刪除了哪些檔案

## 決策理由
- 為什麼選擇這個方案
- 第一性原理分析結果

## 執行結果
- 達成了什麼效果
- 驗證結果（通過/失敗）
```

> **注意**：`## 意圖與情境` 以下的 body 段落為**建議但非必要**。簡單修改可以只寫首行摘要。

### Type 列表

| Type | 用途 | 範例 |
|------|------|------|
| `feat` | 新功能 | 新增 ARIA 快照蒐集功能 |
| `fix` | 修復 Bug | 修正 iframe 遞迴深度溢位問題 |
| `docs` | 文件變更 | 更新使用指南的設定說明 |
| `refactor` | 重構（不影響功能） | 抽取 CDP 連接邏輯為獨立模組 |
| `chore` | 雜務（設定、依賴更新） | 升級 Playwright 至 1.52.0 |
| `security` | 安全性修復 | 強化錄製檔密碼清理機制 |

### Scope 使用範例

| Scope | 涵蓋範圍 | 說明 |
|-------|---------|------|
| `core` | `collect-materials.ts` | 主程式核心邏輯 |
| `recording` | `materials/recordings/` | Codegen 錄製檔相關 |
| `docs` | `docs/`、`README.md` | 文件 |
| `config` | `tsconfig.json`、`package.json`、設定檔 | 專案設定 |
| `scripts` | `scripts/`、`launch-chrome.ps1`、`setup.ps1` | 腳本工具 |
| `hooks` | `.githooks/`、`pre-commit-scan.ps1` | Git hooks |
| `security` | 安全相關變更 | 跨模組安全修復 |

### 範例訊息

**簡單修改（只寫首行）：**

```
docs(docs): 更新 commit 指引文件至 v2.0
```

```
fix(core): 修正 CDP 連接逾時未正確處理的問題
```

```
chore(config): 升級 @types/node 至 ^20.17.10
```

**完整格式（重要變更）：**

```
feat(recording): 自動清理錄製檔密碼並建立 pre-commit 掃描

## 意圖與情境
- 用戶錄製操作流程時，Playwright Codegen 會記錄輸入的密碼明文
- 需要在 commit 前自動偵測並清理敏感資訊

## 執行內容
- 新增 scripts/pre-commit-scan.ps1 掃描腳本
- 新增 .githooks/pre-commit hook
- 掃描 .fill()、password、token、secret 模式

## 決策理由
- 使用 PowerShell 腳本確保 Windows 11 環境相容
- 正則匹配 4 字元以上的值，避免誤判空字串

## 執行結果
- 通過：含密碼的錄製檔被正確阻擋
- 通過：無敏感資訊的檔案正常提交
```

---

## 3. 本地 Commit 流程（完整步驟）

### 前置條件

確認 Git hooks 已啟用：

```powershell
git config core.hooksPath .githooks
```

### 步驟 1：確認工作樹狀態

```powershell
git --no-pager status --short
```

確認有哪些檔案被修改、新增或刪除。

### 步驟 2：TypeScript 編譯檢查

```powershell
npx tsc --noEmit
```

- ✅ 無輸出 → 編譯通過
- ❌ 有錯誤 → **必須修正後才能繼續**

> 本專案 `tsconfig.json` 啟用了 `strict` 模式，包含 `noUnusedLocals`、`noUnusedParameters`、`noImplicitReturns`。

### 步驟 3：手動執行 Pre-commit 掃描（建議）

即使 hook 會自動執行，建議先手動確認：

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/pre-commit-scan.ps1
```

- ✅ 無輸出且 exit code 為 0 → 安全
- ❌ 出現 `❌ 敏感資訊偵測` → 參見 [處理被阻擋的 commit](#處理被阻擋的-commit)

### 步驟 4：加入暫存區

```powershell
# 加入所有變更
git add -A

# 或精確選擇檔案
git add collect-materials.ts docs/commit.md
```

### 步驟 5：檢視暫存內容

```powershell
git --no-pager diff --staged --name-only
```

確認只有預期的檔案被暫存。

### 步驟 6：提交

```powershell
# 人類開發者
git commit -m "feat(core): 新增 ARIA 快照蒐集功能"

# AI 自動化 bot（指定 author）
git commit -m "docs(docs): 更新 commit 指引文件" --author="Automation Bot <automation@local>"
```

### 處理被阻擋的 Commit

若 pre-commit hook 偵測到敏感資訊並阻止 commit：

```
❌ 敏感資訊偵測: recording-login.ts 匹配模式 [\.fill\(...\)]
🚫 commit 被阻止：錄製檔中偵測到疑似敏感資訊。
   請執行 sanitizeRecording 清理後再 commit。
```

**處理步驟：**

1. **檢視問題檔案**：

   ```powershell
   # 查看哪些錄製檔含有敏感資訊
   Select-String -Path "materials\recordings\*.ts" -Pattern "\.fill\(|password\s*[:=]|token\s*[:=]|secret\s*[:=]"
   ```

2. **清理敏感資訊**：將硬編碼的密碼替換為環境變數

   ```typescript
   // ❌ 錯誤：密碼明文
   await page.fill('#password', 'MyS3cretPass!');

   // ✅ 正確：使用環境變數
   await page.fill('#password', process.env.RECORDING_PASSWORD ?? '');
   ```

3. **重新執行掃描確認**：

   ```powershell
   pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/pre-commit-scan.ps1
   echo "Exit code: $LASTEXITCODE"
   ```

4. **確認通過後重新提交**：

   ```powershell
   git add -A && git commit -m "security(recording): 清理錄製檔中的敏感資訊"
   ```

> ⚠️ **緊急狀況**：若確認為誤判且需要臨時跳過 hook（**不建議**）：
>
> ```powershell
> git commit --no-verify -m "chore: 緊急提交（已人工確認無敏感資訊）"
> ```

---

## 4. 安全檢查清單

### 自動保護（.gitignore）

以下項目已被 `.gitignore` 排除，**不會**被 `git add` 加入：

| 路徑 | 說明 | 狀態 |
|------|------|------|
| `.env` | 環境變數（密碼、帳號） | ✅ 已排除 |
| `materials/` | 蒐集素材（含錄製檔） | ✅ 已排除 |
| `logs/` | 執行日誌 | ✅ 已排除 |
| `chrome-debug-profile/` | Chrome 除錯設定檔 | ✅ 已排除 |
| `node_modules/` | 依賴套件 | ✅ 已排除 |
| `dist/` | 編譯輸出 | ✅ 已排除 |
| `*.js` / `*.d.ts` / `*.js.map` | 編譯產物 | ✅ 已排除 |

### Pre-commit Hook 自動掃描

`.githooks/pre-commit` 會在每次 commit 前自動執行 `scripts/pre-commit-scan.ps1`，掃描以下模式：

| 模式 | 偵測目標 | 範例 |
|------|---------|------|
| `.fill(selector, 'password')` | Playwright 密碼填入 | `.fill('#pwd', 'abc123')` |
| `password = 'xxx'` | 密碼變數賦值 | `password: 'MySecret'` |
| `token = 'xxx'` | Token 賦值 | `token = 'eyJhbG...'` |
| `secret = 'xxx'` | Secret 賦值 | `secret: 'sk-123456'` |

### 手動快速檢查命令

在 commit 前，可用以下命令快速掃描整個專案：

```powershell
# 1. 確認 .env 未被追蹤
git --no-pager ls-files .env

# 2. 確認 materials/ 和 logs/ 未被追蹤
git --no-pager ls-files materials/ logs/

# 3. 掃描暫存檔案中的敏感關鍵字
git --no-pager diff --staged -S "password" --name-only
git --no-pager diff --staged -S "token" --name-only
git --no-pager diff --staged -S "secret" --name-only

# 4. 整合檢查（一條命令）
git --no-pager diff --staged | Select-String -Pattern "password|token|secret|\.env|api.key" -CaseSensitive:$false
```

> 以上命令若**無輸出**，表示安全。若有輸出，請逐一檢查是否為敏感資訊。

### 環境變數規範

本專案使用以下環境變數存放敏感資訊，**禁止在程式碼中硬編碼**：

| 變數名稱 | 用途 |
|---------|------|
| `NCERT_USERNAME` | 內部網站登入帳號 |
| `NCERT_PASSWORD` | 內部網站登入密碼 |
| `RECORDING_PASSWORD` | 錄製檔中的替代密碼 |

---

## 5. 推送與遠端作業

### 推送至遠端

```powershell
# 推送當前分支
git push origin HEAD

# 首次推送新分支
git push -u origin <branch-name>
```

### 推送前檢查

```powershell
# 確認本地與遠端的差異
git --no-pager log --oneline origin/main..HEAD

# 確認沒有意外的大檔案
git --no-pager diff --stat origin/main..HEAD
```

### 衝突處理

```powershell
# 拉取遠端變更（使用 rebase 保持線性歷史）
git pull --rebase origin main

# 若有衝突，解決後繼續
git add <resolved-files>
git rebase --continue
```

### 分支命名建議

| 模式 | 範例 |
|------|------|
| `feat/<description>` | `feat/aria-snapshot-collection` |
| `fix/<description>` | `fix/cdp-timeout-handling` |
| `docs/<description>` | `docs/commit-guidelines-v2` |
| `chore/<description>` | `chore/upgrade-playwright` |

---

## 6. CI 自動化檢查

若要在 CI 管線中實作品質閘門，建議包含以下檢查命令：

### 基本檢查（建議必要）

```yaml
# GitHub Actions 範例
steps:
  # TypeScript 編譯檢查
  - name: TypeScript Check
    run: npx tsc --noEmit

  # Pre-commit 敏感資訊掃描
  - name: Sensitive Data Scan
    run: pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/pre-commit-scan.ps1

  # 確認 .gitignore 有效（無追蹤的敏感檔案）
  - name: Check No Sensitive Files Tracked
    run: |
      $tracked = git ls-files .env materials/ logs/ chrome-debug-profile/
      if ($tracked) {
        Write-Error "❌ 敏感檔案被追蹤: $tracked"
        exit 1
      }
    shell: pwsh
```

### Commit 訊息格式驗證

```powershell
# 驗證最新 commit 訊息是否符合 <type>(<scope>): <summary> 格式
$msg = git --no-pager log -1 --pretty=%s
if ($msg -notmatch '^(feat|fix|docs|refactor|chore|security)\([a-z0-9-]+\):\s.+') {
    Write-Error "❌ Commit 訊息格式不符：$msg"
    Write-Error "   期望格式：<type>(<scope>): <摘要>"
    exit 1
}
Write-Host "✅ Commit 訊息格式正確：$msg"
```

### 完整 CI 檢查腳本（可直接使用）

```powershell
# scripts/ci-check.ps1 — 可用於 CI 管線
$ErrorActionPreference = 'Stop'
$failed = $false

Write-Host "=== 1/3 TypeScript 編譯檢查 ===" -ForegroundColor Cyan
try {
    npx tsc --noEmit
    Write-Host "✅ TypeScript 檢查通過" -ForegroundColor Green
} catch {
    Write-Host "❌ TypeScript 檢查失敗" -ForegroundColor Red
    $failed = $true
}

Write-Host "`n=== 2/3 敏感資訊掃描 ===" -ForegroundColor Cyan
& pwsh -NoProfile -ExecutionPolicy Bypass -File scripts/pre-commit-scan.ps1
if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ 敏感資訊掃描通過" -ForegroundColor Green
} else {
    Write-Host "❌ 敏感資訊掃描失敗" -ForegroundColor Red
    $failed = $true
}

Write-Host "`n=== 3/3 追蹤檔案檢查 ===" -ForegroundColor Cyan
$tracked = git ls-files .env materials/ logs/ chrome-debug-profile/
if ($tracked) {
    Write-Host "❌ 敏感檔案被追蹤: $tracked" -ForegroundColor Red
    $failed = $true
} else {
    Write-Host "✅ 無敏感檔案被追蹤" -ForegroundColor Green
}

if ($failed) { exit 1 }
Write-Host "`n🎉 所有 CI 檢查通過！" -ForegroundColor Green
```

---

## 7. Author 欄位與自動化 Bot

### 允許的 Author 欄位

| 身份 | Author 格式 | 使用時機 |
|------|------------|---------|
| 人類開發者 | Git 預設設定（`user.name` + `user.email`） | 日常手動開發 |
| Automation Bot | `Automation Bot <automation@local>` | AI 自動化任務完成後自動 commit |
| GitHub Copilot | `GitHub Copilot <copilot@github.com>` | Copilot CLI 輔助變更 |
| Claude Code | `Claude Code <claude@anthropic.com>` | Claude Code 輔助變更 |

### 自動化 Bot Commit 使用方式

AI 自動化 bot 在完成任務後 **MUST** 執行 git commit（專案規範）。

**標準自動化 commit 命令：**

```powershell
git add -A
git commit -m "feat(core): 新增頁面截圖蒐集功能" --author="Automation Bot <automation@local>"
```

**完整自動化流程（可複製貼上）：**

```powershell
# 1. 編譯檢查
npx tsc --noEmit

# 2. 暫存所有變更
git add -A

# 3. 確認暫存內容
git --no-pager diff --staged --name-only

# 4. 提交（指定 bot author）
git commit -m "feat(core): 功能描述" --author="Automation Bot <automation@local>"

# 5. 推送（若有遠端）
git push origin HEAD
```

### Bot Commit 識別

若需在日誌中篩選自動化 commit：

```powershell
# 列出所有 Automation Bot 的 commit
git --no-pager log --oneline --author="Automation Bot"

# 列出所有非人類的 commit
git --no-pager log --oneline --author="automation@local" --author="copilot@github.com" --author="claude@anthropic.com"
```

---

## 8. 附錄：Git Hooks 管理

### 啟用 Pre-commit Hook

```powershell
git config core.hooksPath .githooks
```

### 確認 Hook 狀態

```powershell
git config --get core.hooksPath
# 預期輸出：.githooks
```

### 臨時停用 Hook（僅供測試）

```powershell
# 停用
git config --unset core.hooksPath

# 重新啟用
git config core.hooksPath .githooks
```

> ⚠️ **警告**：停用 hook 後提交的內容不會經過敏感資訊掃描，務必在測試後立即重新啟用。

### Hook 檔案結構

```
.githooks/
└── pre-commit              # Shell 腳本入口（呼叫 PowerShell）

scripts/
└── pre-commit-scan.ps1     # 實際掃描邏輯（PowerShell）
```

---

> 📌 **總結**：遵循本指引可確保每一筆 commit 都語意清晰、安全無虞、可追溯。
> 如有疑問，請參閱 `docs/spec.md` 或 `docs/使用指南.md`。

---

## 最近提交記錄（自動產生）

### feat(cross-platform): 增強 macOS 驗收流程與離線驗證替代方案

## 意圖與情境
- 目標：讓本專案在 macOS 環境可以順利完成驗收流程（啟動 Chrome Debug、導航到指定頁面、擷取 ARIA 快照、產生 codegen 錄製），並在無法安裝 Node.js 依賴（如 Playwright）的環境下，提供可執行的替代驗證方案。
- 背景：執行 acceptance 腳本時發現系統在缺少 `playwright` 套件時會直接崩潰，導致無法完成驗收；且專案要求支援離線環境。

## 執行內容（變更摘要）
- 新增：`scripts/alt-verify-macos.sh`（macOS 替代驗證腳本，使用 osascript + curl + screencapture）
- 修改：`scripts/acceptance-macos.sh`（啟動前檢查 `node_modules/playwright` 並提供友善提示）
- 修改：`README.md`、`docs/spec.md`、`docs/使用指南.md`（加入 alt-verify 與離線驗證說明）

## 驗證步驟（簡述）
1. 線上模式：在可上網電腦執行 `npm run setup`，然後 `./scripts/acceptance-macos.sh`。
2. 離線模式：在有網路機器準備 `node_modules` 與 Playwright 瀏覽器快取（複製到 `.playwright-browsers/`），設定環境變數 `PLAYWRIGHT_BROWSERS_PATH`，在離線機器執行 `./scripts/acceptance-macos.sh --offline` 或使用 `./scripts/alt-verify-macos.sh` 作替代驗證。

## 影響檔案
- 新增：`scripts/alt-verify-macos.sh`
- 修改：`scripts/acceptance-macos.sh`, `README.md`, `docs/spec.md`, `docs/使用指南.md`

---

（此區為自動附加的最近提交摘要，非歷史變更記錄。若需更完整的 commit log，請使用 `git log --oneline` 檢視。）

### fix(scripts): 修正 run-setup.mjs 的 Illegal return 導致 npm run setup 失敗

## 意圖與情境
- 問題：在 Node.js ESM（.mjs）模組中，頂層使用 `return` 會拋出 `SyntaxError: Illegal return statement`，導致 `npm run setup` 在部分環境（Node v25+）失敗。
- 目標：以最小範圍修正，讓 `npm run setup` 在 ESM 環境下能夠正常運行且不改變原本的執行行為。

## 執行內容
- 修改：`scripts/run-setup.mjs`
  - 移除對 `runCommand('pwsh', ...)` 的頂層 `return` 使用，改為在 pwsh 不存在時再執行 `powershell`，避免在模組頂層出現 `return`。

## 決策理由
- 最小侵入性：不改變 `runCommand` 的退出行為（成功時仍使用 `process.exit(status)`），僅修正呼叫端以符合 ESM 規範。
- 可回溯：修正容易理解且不影響 Windows/Linux/macOS 的既有流程。

## 執行結果
- 驗證：在 Node v25 環境下執行 `npm run setup` 不再拋出 Illegal return，流程會依序嘗試 pwsh 或 powershell，或在非 Windows 系統執行 bash 腳本。

---

### fix(scripts): 修正 run-launch-chrome.mjs 的 Illegal return 導致 npm run start:chrome 失敗

## 意圖與情境
- 問題：與 run-setup.mjs 類似，scripts/run-launch-chrome.mjs 在 ESM 頂層使用 `return`，導致 `npm run start:chrome` 在 Node v25+ 拋出 `SyntaxError: Illegal return statement`。
- 目標：以最小變動修正該腳本，保持既有行為（嘗試 pwsh -> powershell），同時符合 ESM 規範。

## 執行內容
- 修改：`scripts/run-launch-chrome.mjs`
  - 變更呼叫邏輯：將 `if (runCommand('pwsh', psArgs)) return;` 改為在 pwsh 失敗時才執行 powershell（避免頂層 return）。

## 決策理由
- 保持行為一致：不更動 runCommand 的退出策略，僅調整呼叫端以避免 ESM 語法錯誤。

## 執行結果
- 驗證：在 Node v25 環境下執行 `npm run start:chrome` 不會再因 Illegal return 而崩潰；如系統為非 Windows，會執行 scripts/launch-chrome.sh。

---

### fix(scripts): 改進 sanitizeRecording（錄製檔敏感資訊清理）

## 意圖與情境
- 問題：錄製檔中仍有機會出現字面量的帳號/密碼（例如 `.fill('NCERT_USERNAME')`），原因在於早期的 sanitizeRecording 只處理 `.fill(selector, 'value')` 的雙參形式，未處理鏈式呼叫的單參 `.fill('value')` 或 `page.getByRole(...).fill('value')`，且會誤改註解中的示範程式碼。
- 目標：以最小侵入性改進 sanitizeRecording，確保：
  1. 可處理單參與雙參的 `.fill()` / `.type()` 呼叫
  2. 根據上下文（如 getByRole 的 name 為「帳號」或「密碼」）將帳號替換為 `process.env.NCERT_USERNAME`（字面佔位符），密碼替換為 `process.env.RECORDING_PASSWORD`（字面佔位符）
  3. 保護註解與 block comment，避免誤改

## 執行內容
- 修改：`collect-materials.ts`
  - 將 sanitizeRecording 改為逐行處理，跳過單行註解與 block comment，並加入多種 regex 覆蓋案例：雙參 `.fill(selector, '...')`，getByRole 單參 `.fill('...')`（區分帳號/密碼），locator 包含 password 的 selector，以及最後的單參降級處理。
- 修改：`materials/recordings/m-report-download.ts`
  - 將錄製檔中的字面量替換為環境變數佔位符：
    - 帳號: `process.env.NCERT_USERNAME`
    - 密碼: `process.env.RECORDING_PASSWORD`

## 決策理由
- 優先兼容現有文件與環境變數命名（保留 NCERT_* 命名以兼容既有說明），而將錄製檔內的密碼欄位統一使用 `process.env.RECORDING_PASSWORD` 作為執行時佔位符，避免在 sanitize 時寫入實際密碼。

## 執行結果
- 驗證：在本機執行文字檢索與簡易測試後，`materials/recordings/m-report-download.ts` 不含明文密碼或帳號；sanitizeRecording 在樣本輸入上的行為符合規範（保持註解、不重寫 process.env 佔位符）。

---
