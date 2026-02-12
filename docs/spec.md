# 功能規格：內部網路網頁素材離線蒐集工具

**專案名稱**: web-material-collector
**建立日期**: 2026-02-09
**最後更新**: 2026-02-11（v1.3.0 — 文件全面更新：ARIA-first 工作流、sanitize 修正方向、.env 指引、pre-commit 掃描）
**狀態**: v1.3.0 — 核心功能已實作（ARIA 快照 ✅ 截圖 ✅ Codegen 錄製 ✅ 互動模式 ✅ 優雅關閉 ✅ 錄製密碼清理 ✅ Pre-commit Hook ✅ ARIA-first 工作流 ✅ T-03 停用 ✅）
**環境**: Windows 11 + PowerShell 7.x + Node.js v20+ + Playwright ^1.52.0 + TypeScript ^5.7.3

> **專案定位**：一個「離線素材蒐集工具」——在無外部網路的內部網路環境中，透過 Chrome CDP Debug 模式連接已登入的瀏覽器，蒐集 ARIA 快照、截圖、Codegen 錄製等素材，供外部 AI 分析生成自動化腳本。
> **核心價值**：橋接內部網路（無 AI）與外部環境（有 AI）的鴻溝，實現「人工蒐集 → AI 生成 → 內網執行」的工作流程。

---

## 📋 目錄

1. [專案總覽與目標](#1-專案總覽與目標)
2. [功能需求與限制](#2-功能需求與限制)
3. [日誌與時間戳規格](#3-日誌與時間戳規格)
4. [安全與審計要求](#4-安全與審計要求)
5. [API / Hook 列表](#5-api--hook-列表)
6. [使用者情境與測試](#6-使用者情境與測試)
7. [成功標準](#7-成功標準)
8. [第一性原理分析](#8-第一性原理分析)
9. [SDD 開發法](#9-sdd-開發法)
10. [專案文件索引](#10-專案文件索引)
11. [變更記錄](#11-變更記錄)

---

## 1. 專案總覽與目標

### 1.1 用白話說

很多組織的內部網路（Intranet）與外部網際網路隔離。員工在內網操作業務系統，但無法使用雲端 AI 工具。本專案的目標是：

1. **在內網**：讓任何人（不需要程式設計經驗）透過簡單的指令，把網頁的「骨架資料」蒐集下來。
2. **帶出到外網**：把蒐集到的骨架資料交給 AI，請 AI 生成自動化腳本。
3. **帶回內網**：把 AI 寫好的腳本帶回內網執行，自動完成重複性工作。

`
內部網路（無外部網路）                    外部環境（有網路）
┌─────────────────────┐              ┌─────────────────────┐
│  1. 啟動 Chrome Debug │              │  5. 將素材交給 AI     │
│  2. 登入內部網站      │  ──帶出──▶  │  6. AI 生成自動化腳本  │
│  3. 蒐集素材          │              │  7. 帶回內網測試      │
│  4. 匯出素材檔案      │  ◀──帶入──  │                      │
└─────────────────────┘              └─────────────────────┘
`

### 1.2 核心功能

| 功能 | 說明 | 技術 |
|------|------|------|
| 📸 ARIA 快照蒐集 | 擷取頁面語意結構（AI 分析的核心素材） | Playwright ARIA API |
| 📷 截圖蒐集 | 擷取頁面視覺截圖 | Playwright Screenshot |
| 🎬 Codegen 錄製 | 錄製使用者互動流程 | Playwright Codegen |
| 📄 HTML 原始碼 | 擷取頁面 HTML（可選） | Playwright Content API |

### 1.3 技術棧

| 層級 | 技術 | 理由 |
|------|------|------|
| 瀏覽器連接 | **Chrome CDP（Debug Protocol）** | 連接到使用者已登入的 Chrome |
| 自動化引擎 | **Playwright ^1.52.0** | 企業級成熟度、跨平台 |
| 執行環境 | **Node.js v20+ + tsx** | TypeScript 直接執行 |
| 腳本語言 | **TypeScript ^5.7.3** | 型別安全、AI 友善 |

### 1.4 前置條件

- **OS / Shell**：Windows 11 + PowerShell 7.x（目標環境，也相容 macOS / Linux）
- **Node.js**：v20+（由 setup.ps1 驗證）
- **Chrome**：已安裝 Google Chrome
- **CDP_PORT**：預設 9222（CLI --port / 設定檔 cdpPort 對應同一端口）

---

## 2. 功能需求與限制

### 2.1 核心功能需求

- **FR-001**: 系統 MUST 透過 Chrome CDP（connectOverCDP）連接到使用者已開啟的 Chrome Debug 模式
- **FR-002**: 系統 MUST 過濾 Chrome 內部頁面（chrome://、chrome-extension://、chrome-untrusted://、devtools://、bout:blank），只操作使用者可見的 http/https 頁面
- **FR-003**: 系統 MUST 能擷取頁面 ARIA 快照（包含 iframe 遞迴，深度可設定）
- **FR-004**: 系統 MUST 能擷取頁面截圖（全頁截圖失敗時自動降級為視窗截圖）
- **FR-005**: 系統 MUST 能啟動 Playwright Codegen 錄製使用者互動流程
- **FR-006**: 系統 MUST 能擷取頁面 HTML 原始碼（可選功能）
- **FR-007**: 系統 MUST 在斷開連接時 NEVER 呼叫 rowser.close()（保持使用者 Chrome 運行），只將 	his.browser = null

### 2.2 CDP 連線原則（Non-Negotiable）

| 原則 | 說明 |
|------|------|
| **NEVER 強制關閉使用者 Chrome** | 使用 connectOverCDP 時，斷開連接只做 	his.browser = null，避免中斷使用者工作 |
| **過濾 Chrome 內部頁面** | chrome://、chrome-extension://、chrome-untrusted://、devtools://、bout:blank 不是使用者頁面 |
| **CDP 預存頁面處理** | page.url() === '' 的頁面使用 CDPSession.send('Runtime.evaluate') 取得真實 URL，並自動開新分頁導航 |

相關功能需求：

- **FR-021**: 系統 MUST 偵測 page.url() === '' 的 CDP 預存頁面，使用 CDPSession 取得真實 URL
- **FR-022**: 系統 MUST 在偵測到預存頁面時，自動開啟新分頁（context.newPage()）並導航至真實 URL
- **FR-023**: 系統 MUST 在取得頁面標題時先嘗試 page.title()，超時 3 秒後降級為 CDPSession 方式

### 2.3 ARIA-first 工作流（⚠️ 重要設計決策）

#### 為什麼禁用錄製後自動補抓 URL（T-03 disabled）

原本設計中，錄製完成後系統會自動解析錄製檔中的 page.goto() URL（透過 xtractUrlsFromRecording()），然後逐一導航擷取 ARIA 快照（透過 captureSnapshotsForUrls()）。

**此功能已被停用**，原因如下：

1. **Session 依賴問題**：錄製檔中的 URL 通常指向需要登入才能存取的頁面。自動導航時無法保證已登入狀態，導致擷取到的是登入頁或錯誤頁面。
2. **Codegen 使用獨立瀏覽器**：Playwright Codegen 會啟動自己的瀏覽器視窗，與 CDP 連接的使用者 Chrome 是不同的瀏覽器實例，兩者的 session/cookie 不共享。
3. **不可靠的結果**：即使能導航，擷取到的 ARIA 快照可能不代表使用者實際看到的頁面狀態。

#### 推薦的 ARIA-first 工作流程

`
❌ 舊流程（已停用）：錄製 → 自動解析 URL → 自動擷取快照
✅ 新流程（ARIA-first）：先互動式擷取 ARIA 快照 → 再錄製 Codegen
`

**步驟**：
1. 使用互動模式（
pm run collect）逐頁擷取 ARIA 快照與截圖
2. 在每個頁面完成 ARIA 擷取後，選擇 
 進入錄製模式
3. 在錄製視窗中操作完整流程，關閉視窗結束錄製
4. 錄製檔自動經過 sanitizeRecording() 清理敏感資訊

> 💡 **好處**：先擷取 ARIA 能確保每個頁面的快照都是在已登入、正確狀態下擷取的。

### 2.4 錄製檔 Sanitize 原則（Non-Negotiable）

> **核心規則**：所有敏感資料 **MUST NOT** 以明碼出現在版本庫（repo）或任何產出檔案中。

#### Sanitize 機制

- **FR-032**: 錄製結束後系統自動執行 sanitizeRecording()，掃描 .fill() 呼叫中的密碼欄位
- **FR-033**: sanitizeRecording() MUST 在錄製檔開頭加入清理標記 // ⚠️ 此錄製檔已經過敏感資訊清理
- **FR-034**: 密碼欄位的明文值 MUST 替換為 process.env.RECORDING_PASSWORD 佔位符（placeholder），而**不是**將環境變數的實際值寫入檔案

#### ⚠️ 修正方向說明

早期實作中 sanitizeRecording() 存在漏洞：它會讀取 process.env.RECORDING_PASSWORD 的**實際值**並寫入錄製檔，等同於把明碼寫入版本庫。正確做法是將敏感值替換為**字串形式的佔位符**（如字面上的 process.env.RECORDING_PASSWORD），讓錄製檔在執行時才動態讀取環境變數。

`	ypescript
// ❌ 錯誤做法（把實際密碼寫入檔案）：
.fill(selector, '')  // 實際值被展開

// ✅ 正確做法（寫入佔位符字串）：
.fill(selector, process.env.RECORDING_PASSWORD)        // 字面量佔位符
`

### 2.5 .env 使用指引

#### 檔案規範

| 項目 | 說明 |
|------|------|
| 檔名 | .env（位於專案根目錄） |
| 載入機制 | loadDotEnv() 函式在程式啟動時讀取，僅在 process.env 中不存在該 key 時才設定（不覆蓋已存在的環境變數） |
| 版本控制 | .env 已在 .gitignore 中，**MUST NOT** 被提交到 Git |
| 範例檔 | 建議提供 .env.example（見下方） |

#### .env.example 範例

`nv
# 內部網路網頁素材蒐集工具 — 環境變數範例
# 複製此檔案為 .env 並填入實際值
# ⚠️ .env 檔案不可提交到 Git（已在 .gitignore 中排除）

# 錄製檔中密碼欄位的替換值（sanitizeRecording 使用）
RECORDING_PASSWORD=

# 自動化腳本憑證（若需要）
NCERT_USERNAME=
NCERT_PASSWORD=
`

#### loadDotEnv() 行為

`
程式啟動 → loadDotEnv()
  ├── 找到 .env → 逐行解析 KEY=VALUE
  │   └── 若 process.env[KEY] 不存在 → 設定之
  │   └── 若 process.env[KEY] 已存在 → 跳過（不覆蓋）
  └── 找不到 .env → 靜默跳過（不報錯）
`

### 2.6 操作模式

- **FR-008**: 系統 MUST 支援互動模式（一步一步引導蒐集）
- **FR-009**: 系統 MUST 支援自動模式（依設定檔批次蒐集）
- **FR-010**: 系統 MUST 支援快照模式（快速擷取當前頁面）
- **FR-011**: 系統 MUST 支援錄製模式（直接啟動 Codegen）

### 2.7 優雅關閉（Graceful Shutdown）

- **FR-024**: 系統 MUST 攔截 SIGINT（Ctrl+C）和 SIGTERM 信號
- **FR-025**: 收到中斷信號時，系統 MUST 透過 
equestShutdown() 設定 isShuttingDown = true
- **FR-026**: 系統 MUST 保證 inally 區塊執行，確保 saveMetadata() 與 disconnect() 在中斷時仍能完成

### 2.8 輸出格式

- **FR-012**: 系統 MUST 輸出 metadata.json（蒐集記錄、頁面統計、錯誤記錄）
- **FR-013**: 系統 MUST 輸出 summary-report.md（摘要報告、檔案結構說明）
- **FR-014**: ARIA 快照 MUST 包含頁面 URL、標題、擷取時間、專案名稱等 header 資訊

### 2.9 Windows 特殊說明

- **FR-018**: 系統 MUST 在 Windows 上使用 cmd.exe /d /s /c 啟動子程序（避免 spawn EINVAL）
- **FR-019**: launch-chrome.ps1 MUST 偵測端口佔用並區分 debug Chrome 與一般 Chrome
- **FR-020**: setup.ps1 MUST 一鍵完成環境安裝（Node.js 檢查、npm install、Playwright Chromium 下載）
- 路徑使用 path.join() 跨平台處理（Windows 反斜線 \ vs Unix 正斜線 /）
- PowerShell 腳本 MUST 通過 Parser::ParseFile 驗證
- 啟用 Git Hooks 的指令為 git config core.hooksPath .githooks

### 2.10 macOS / Linux 相容性

- **FR-040**: macOS / Linux MUST 使用 scripts/launch-chrome.sh 啟動 Chrome Debug 模式
- **FR-041**: macOS / Linux MUST 使用 scripts/setup.sh（或 npm run setup）安裝依賴
- **FR-042**: 離線環境可使用 npm run setup:offline，需預先準備 node_modules 與 Playwright 瀏覽器目錄（建議 .playwright-browsers/ + PLAYWRIGHT_BROWSERS_PATH）
- **FR-043**: 若無法安裝 Playwright，系統 MUST 提供 scripts/alt-verify-macos.sh 作為人工/半自動驗收替代流程（使用 osascript + screencapture），並將產出存放於 materials/alt-verify-*/

### 2.11 安全需求

- **FR-027**: 原始碼與錄製檔中 MUST NOT 包含明文憑證，應使用環境變數或 .env 檔案
- **FR-028**: .gitignore MUST 包含 .env、logs/、materials/、chrome-debug-profile/

---

## 3. 日誌與時間戳規格

### 3.1 時區標準

本專案統一使用 **Asia/Taipei (UTC+8)** 作為所有時間戳記的時區標準。

### 3.2 時間戳格式

| 用途 | 函式 | 格式 | 範例 |
|------|------|------|------|
| 日誌行、metadata.json | getTaipeiISO() | YYYY-MM-DDTHH:mm:ss+08:00 | 2026-02-10T14:30:00+08:00 |
| 檔名後綴（log、runId） | getTaipeiTimestampForFile() | YYYYMMDD-HHmmss | 20260210-143000 |
| 顯示用 | getTaipeiTime() | 台灣地區格式 | 2026/2/10 下午2:30:00 |

### 3.3 日誌檔案規範

- **FR-015**: 系統 MUST 產生結構化 log 檔案（含時間戳、層級、環境資訊、錯誤堆疊）
- **FR-016**: log 檔案 MUST 記錄 CDP 連接後所有頁面的 URL 和 isUserPage 狀態
- **FR-017**: 所有 catch 區塊 MUST 將錯誤記錄到 log 和 metadata.errors 陣列

#### 日誌檔名規則

| 日誌類型 | 檔名格式 | 來源 |
|---------|---------|------|
| 安裝日誌 | logs\setup-YYYYMMDD-HHMMSS.log | setup.ps1 |
| Chrome 啟動日誌 | logs\launch-chrome-YYYYMMDD-HHMMSS.log | launch-chrome.ps1 |
| 素材蒐集日誌 | logs\collect-materials-YYYYMMDD-HHMMSS.log | collect-materials.ts |

#### 日誌行格式

- **FR-031**: 格式為 [YYYY-MM-DDTHH:mm:ss+08:00][層級] emoji 訊息
- 層級為 INFO / WARN / ERROR / CONTEXT

### 3.4 metadata.json 規範

- **FR-029**: metadata.json MUST 包含以下欄位：projectName、collectedAt、	imezone、	oolVersion、platform、
odeVersion、playwrightVersion、logFile、	otalPages、collectedPages、
ecordings、rrors
- **FR-030**: metadata.json 的 	imezone 欄位 MUST 為 Asia/Taipei (UTC+8)，所有時間戳記 MUST 使用 getTaipeiISO() 產生

---

## 4. 安全與審計要求

### 4.1 基本安全原則

- 原始碼與錄製檔中 **MUST NOT** 包含明文帳號密碼
- 自動化腳本需要憑證時，MUST 使用環境變數（如 NCERT_USERNAME/NCERT_PASSWORD）或 .env 檔案
- .gitignore MUST 包含 .env、logs/、materials/
- safeFileName() 防止路徑穿越攻擊
- alidateUrl() 只允許 http:/https:/bout: 協定
- 不記錄使用者密碼到日誌

### 4.2 Pre-commit 掃描機制

- **FR-037**: .githooks/pre-commit MUST 在 git commit 時呼叫 scripts/pre-commit-scan.ps1 掃描 materials/recordings/*.ts
- **FR-038**: pre-commit-scan.ps1 MUST 掃描以下模式，偵測到匹配時 MUST 以 exit code 1 阻止 commit：

| 掃描模式 | 說明 |
|---------|------|
| .fill(selector, 'non-empty-password') | 密碼欄位的明文值 |
| password = 'xxx' / password: 'xxx' | 密碼變數賦值 |
| 	oken = 'xxx' / 	oken: 'xxx' | Token 明文 |
| secret = 'xxx' / secret: 'xxx' | Secret 明文 |

- **FR-039**: 使用者 MUST 透過以下指令啟用 pre-commit hook：
  `powershell
  git config core.hooksPath .githooks
  `

### 4.3 CI 建議

建議在 CI/CD 管線中加入以下檢查：
1. TypeScript 編譯檢查：
px tsc --noEmit
2. 敏感資訊掃描：pwsh -File scripts\pre-commit-scan.ps1
3. .env 未被意外提交：驗證 .gitignore 包含 .env

### 4.4 審查步驟

在提交或合併程式碼前，建議執行以下審查：
1. 確認錄製檔（materials/recordings/*.ts）中不含明文密碼
2. 確認 .env 未被加入暫存區（git status 檢查）
3. 執行 pwsh -File scripts\pre-commit-scan.ps1 驗證無敏感資訊洩漏
4. 檢查 sanitizeRecording() 的輸出是否為佔位符而非實際值

---

## 5. API / Hook 列表

以下列出 collect-materials.ts 中的主要函式與注意事項：

### 5.1 工具函式（模組層級）

| 函式 | 用途 | 注意事項 |
|------|------|---------|
| loadDotEnv() | 讀取專案根目錄下的 .env 檔案並注入 process.env | 只在該 key 不存在時設定（不覆蓋已有環境變數）；找不到 .env 時靜默跳過 |
| getTaipeiISO() | 產生 ISO 8601 台北時間字串 | 格式：YYYY-MM-DDTHH:mm:ss+08:00 |
| getTaipeiTimestampForFile() | 產生適合檔名的時間戳 | 格式：YYYYMMDD-HHmmss，用於 log 檔名與 runId |
| getTaipeiTime() | 產生台灣地區顯示格式時間 | 用於 console 顯示 |
| safeFileName(name) | 將字串轉為安全檔名 | 防止路徑穿越攻擊 |
| alidateUrl(url) | 驗證 URL 協定 | 只允許 http:/https:/bout: |

### 5.2 MaterialCollector 類別方法

| 方法 | 用途 | 注意事項 |
|------|------|---------|
| sanitizeRecording(filePath) | 清理錄製檔中的敏感資訊 | ⚠️ 密碼欄位的值應替換為 process.env.RECORDING_PASSWORD 佔位符，而非環境變數的實際值 |
| xtractUrlsFromRecording(filePath) | 從錄製檔提取 page.goto() URL | ⛔ **已停用（T-03 disabled）**：因 session 依賴問題無法可靠運作 |
| captureSnapshotsForUrls(urls, flowName) | 為提取的 URL 自動擷取 ARIA 快照 | ⛔ **已停用（T-03 disabled）**：搭配 extractUrlsFromRecording 使用，一併停用 |
| startCodegenRecording(flowName, startUrl, instructions) | 啟動 Playwright Codegen 錄製 | Windows 上使用 cmd.exe /d /s /c 包裝；程式會在啟動前提示使用者在 Codegen 視窗完成錄製後請關閉該視窗；視窗關閉並生成檔案後會自動呼叫 sanitizeRecording()，並在 CLI 顯示後續選單（繼續 / 重新錄製 / 擷取 ARIA / 結束）。 |
| connect() | 透過 CDP 連接到 Chrome | 使用 connectOverCDP，連接後記錄所有頁面到 log |
| disconnect() | 斷開與 Chrome 的連接 | 只做 	his.browser = null，NEVER 呼叫 rowser.close() |
| 
equestShutdown() | 設定優雅關閉旗標 | 設定 isShuttingDown = true，讓迴圈在下一輪停止 |
| collectAll() | 自動模式完整蒐集 | 依設定檔的 pages 列表逐一導航與蒐集 |
| collectInteractive() | 互動模式蒐集 | 一步一步引導使用者，最多 100 頁 |
| collectSnapshot() | 快照模式 | 快速擷取當前頁面 |
| getActivePage() | 取得使用者可見的活躍頁面 | 自動過濾 Chrome 內部頁面 |
| 
esolvePageUrl(page) | 解析頁面真實 URL | 處理 CDP 預存頁面 page.url() === '' 的情況 |
| 
esolvePageTitle(page) | 解析頁面標題 | 先嘗試 page.title()，超時降級為 CDPSession |
| saveMetadata() | 儲存 metadata.json | 在 finally 區塊中確保執行 |
| generateSummaryReport() | 產生 summary-report.md | 在 finally 區塊中確保執行 |

### 5.3 Git Hooks

| Hook | 檔案 | 說明 |
|------|------|------|
| pre-commit | .githooks/pre-commit | Shell wrapper，呼叫 scripts/pre-commit-scan.ps1 |
| pre-commit-scan.ps1 | scripts/pre-commit-scan.ps1 | 掃描 materials/recordings/*.ts 中的密碼、token、secret 模式 |

---

## 6. 使用者情境與測試

### User Story 1 - 互動式蒐集內部網站素材 (Priority: P1)

作為一位需要將內部網站素材帶到外部環境讓 AI 分析的使用者，我希望工具能引導我一步一步蒐集每個頁面的 ARIA 快照和截圖，讓我不需要理解技術細節就能完成素材蒐集。

**驗收情境**：

1. **Given** Chrome 已以 Debug 模式啟動並登入內部網站，**When** 執行 
pm run collect 並選擇互動模式，**Then** 系統連接到 Chrome 並顯示當前頁面資訊
2. **Given** 系統已連接到 Chrome，**When** 使用者輸入頁面名稱和描述，**Then** 系統自動擷取 ARIA 快照和截圖並儲存到 materials/ 目錄
3. **Given** 已蒐集一個頁面，**When** 使用者按 Enter，**Then** 系統提示蒐集下一個頁面
4. **Given** 使用者選擇結束蒐集，**When** 輸入 q，**Then** 系統儲存 metadata.json 和 summary-report.md 並安全斷開連接

### User Story 2 - 錄製互動流程 (Priority: P1)

作為一位需要記錄登入操作或表單填寫流程的使用者，我希望工具能啟動 Playwright Codegen 錄製我的操作。

**驗收情境**：

1. **Given** 在互動模式中蒐集了頁面素材，**When** 使用者選擇 
，**Then** 系統提示輸入錄製名稱和起始 URL
2. **Given** 使用者確認開始錄製，**When** 系統啟動 Codegen，**Then** 開啟新的瀏覽器視窗讓使用者操作
3. **Given** Codegen 正在錄製，**When** 使用者關閉錄製視窗，**Then** 系統將錄製結果儲存到 materials/recordings/ 目錄
4. **Given** 錄製在 Windows 環境執行，**When** 啟動 Codegen，**Then** 使用 cmd.exe /d /s /c 包裝命令避免 spawn EINVAL 錯誤
5. **Given** 錄製檔已儲存，**When** 錄製檔包含 .fill() 呼叫，**Then** 系統自動執行 sanitizeRecording() 將明文密碼替換為 process.env.RECORDING_PASSWORD 佔位符

> ⚠️ **注意**：User Story 2 驗收情境 6（錄製後自動擷取 URL 的 ARIA 快照）已因 T-03 disabled 而移除。請改用 ARIA-first 工作流（先互動擷取、再錄製）。

### User Story 3 - 快照模式快速擷取 (Priority: P2)

**驗收情境**：
1. **Given** Chrome 已以 Debug 模式啟動並瀏覽目標頁面，**When** 執行 
pm run collect:snapshot，**Then** 系統自動擷取當前頁面的 ARIA 快照和截圖
2. **Given** 頁面包含 iframe，**Then** 系統遞迴擷取所有 iframe 的 ARIA 快照（最深 3 層）

### User Story 4 - 自動模式批次蒐集 (Priority: P2)

**驗收情境**：
1. **Given** collect-materials-config.json 已定義目標頁面列表，**When** 執行 
pm run collect:auto，**Then** 系統依序導航到每個頁面並蒐集素材
2. **Given** 某個頁面導航失敗，**Then** 記錄錯誤到 metadata.errors 並繼續處理下一個頁面

### User Story 5 - Chrome Debug 模式啟動 (Priority: P1)

**驗收情境**：
1. **Given** Chrome 已安裝，**When** 執行 .\launch-chrome.ps1，**Then** 啟動使用獨立 profile 的 Chrome 並開啟 CDP 端口 9222
2. **Given** 端口 9222 已被一般 Chrome 佔用，**Then** 偵測到非 debug Chrome 並提示使用者處理
3. **Given** Debug Chrome 已在運行，**Then** 偵測到已運行的 debug Chrome 並顯示下一步指引

### 邊緣案例

| 案例 | 處理方式 |
|------|---------|
| Chrome 內部頁面干擾 | getActivePage() 過濾 chrome:// 等 URL |
| 端口被非 debug Chrome 占用 | launch-chrome.ps1 透過 Win32_Process.CommandLine 檢查 |
| 全頁截圖失敗 | 自動降級為視窗截圖 |
| iframe 超過深度限制 | iframeDepth 限制遞迴（預設 3，最大 10） |
| Codegen 在 Windows 上 spawn 失敗 | 使用 cmd.exe 包裝 + windowsVerbatimArguments: true |
| 使用者 Ctrl+C 中斷 | 
equestShutdown() → inally 區塊儲存 metadata |
| CDP 預存頁面 page.url() 為空 | CDPSession 取得真實 URL，開新分頁導航 |
| 錄製檔含明文密碼 | sanitizeRecording() 自動替換為佔位符 |
| 敏感資料意外 commit | .githooks/pre-commit 掃描阻止 |

---

## 7. 成功標準

| 編號 | 標準 |
|------|------|
| SC-001 | 使用者執行 .\setup.ps1 即可完成環境安裝，無需手動操作 |
| SC-002 | 使用者執行 .\launch-chrome.ps1 即可啟動 Chrome Debug 模式，包含端口衝突處理 |
| SC-003 | 互動模式下蒐集 ARIA 快照和截圖的成功率達 95% 以上 |
| SC-004 | Codegen 錄製在 Windows 11 + Node.js v20+ 環境下正常啟動 |
| SC-005 | 所有錯誤都記錄在 log 檔案和 metadata.json 中，AI 可透過 log 診斷問題根因 |
| SC-006 | Chrome 內部頁面被正確過濾，不影響素材蒐集 |
| SC-007 | 使用者按 Ctrl+C 後，metadata.json 與 summary-report.md 仍能正確寫入 |
| SC-008 | .gitignore 包含 .env 與 logs/，敏感資料不被提交 |
| SC-009 | 錄製檔經過 sanitize 後不含明文密碼 |
| SC-010 | pre-commit hook 能阻止含敏感資訊的錄製檔被 commit |

---

## 8. 第一性原理分析

### 問題本質分解

`
用戶的真實需求：
├── 內部網路無 AI：無法直接讓 AI 分析內部網站
├── 需要素材帶出：需要結構化素材（不是截圖就好）
├── 非技術人員：不懂 CDP、ARIA、Playwright 是什麼
└── 重複使用：需要對多個內部網站重複蒐集

從第一性原理推導：
├── 「無 AI」→ 需要離線蒐集工具 → 需要本地 Playwright
├── 「結構化素材」→ 需要 ARIA 快照 → 比截圖更有 AI 分析價值
├── 「非技術人員」→ 需要互動式引導 → 需要腳本化啟動（一鍵式）
└── 「重複使用」→ 需要設定檔驅動 → 需要自動模式
`

### 技術約束的推導

`
約束一：為何使用 CDP 而不是直接啟動 Playwright？
├── 前提：使用者需要手動登入內部網站（可能有雙重驗證）
├── Playwright 直接啟動 → 無法使用已登入的 session
├── CDP 連接 → 可以「看到」使用者已登入的頁面
└── 結論：MUST 使用 connectOverCDP

約束二：為何 ARIA-first 而非錄製後自動補抓？
├── 前提：Codegen 使用獨立瀏覽器（非 CDP 連接的 Chrome）
├── 自動解析 URL 後導航 → session 不共享 → 擷取到錯誤頁面
├── 先在已登入的 Chrome 中擷取 ARIA → 保證正確狀態
└── 結論：MUST 先 ARIA 後 Codegen（T-03 disabled）

約束三：為何 Windows 上 spawn 需要特殊處理？
├── 前提：Node.js v24+ 對 Windows spawn 行為有重大變更
├── 直接 spawn('npx.cmd') → 觸發 EINVAL
└── 結論：MUST 用 cmd.exe /d /s /c 包裝命令
`

---

## 9. SDD 開發法

### 核心原則：文件即可執行資產

| 原則 | 說明 |
|------|------|
| 文件是真理來源 | 程式碼必須符合文件規格，不是相反 |
| 先文件後程式碼 | 任何功能開發前必須先更新規格文件 |
| 文件即測試 | 驗收標準（Given-When-Then）直接轉換為驗證流程 |
| 文件即溝通 | 所有技術決策記錄在文件中，減少口頭溝通成本 |

### Auto Commit 策略

每次完成任務後 MUST 執行 git commit。Commit 訊息格式：

`
<type>(<scope>): <簡短摘要>
`

| Type | 用途 |
|------|------|
| eat | 新功能 |
| ix | 錯誤修復 |
| docs | 文件更新 |
| 
efactor | 重構 |
| chore | 雜項 |
| security | 安全相關 |

- Commit 訊息 MUST 使用繁體中文（zh-TW），技術術語可保留英文

---

## 10. 專案文件索引

| 文件 | 路徑 | 說明 |
|------|------|------|
| 功能規格 | docs/spec.md | 本文件 — Given-When-Then 可直接轉換為測試案例 |
| 使用指南 | docs/使用指南.md | 完整使用教學，步驟可直接複製執行 |
| README | README.md | 快速開始指引 |
| AI 開發準則 | .github/copilot-instructions.md | AI 開發規範與安全原則 |
| Commit 指引 | docs/commit.md | Commit 訊息規範與流程 |
| 任務審查報告 | docs/任務審查報告.md | 歷次改善計畫的審查結果與發現 |

---

## NCERT 月報下載腳本（download-ncert-report.ts）——SDD 與驗證計畫

本節記錄 download-ncert-report.ts 的規格驅動開發（SDD）要點與可驗證的測試計畫，旨在確保在內部網路（離線／Intranet）環境下可靠、安全與可觀察地自動擷取 NCERT 月報並產出可供 AI 分析之素材（ARIA snapshot、截圖、原始 HTML、下載檔案與結構化日誌）。以下內容以實務可執行的 Given-When-Then 驗收標準與逐步實機測試流程為基礎，並列出穩定性策略與 CI 建議。

### 目的
- 自動登入 NCERT 系統、定位月報條目、下載月報檔案（PDF）並同時蒐集可供後續 AI/人工作業分析的輔助素材（ARIA snapshot、screenshot、network log、console log、metadata），所有輸出以安全檔名與時區標記歸檔。

### 範圍與限制
- 範圍：單一 NCERT 站台（內網）之月報列表頁（典型路徑 /Post2/list.do）；會處理動態載入和展開行為，但不負責跨站匯入或外部 API。
- 限制：必須在離線環境與本專案預先安裝之依賴下運行（Node + tsx、Playwright 已預安裝）；憑證由環境變數提供（禁止將明文寫入程式或日誌）。
- OS 與執行環境優先支援 Windows 11 + PowerShell 7.x，且所有 timestamp 使用 Asia/Taipei (UTC+8)。

### 功能需求（FR）
- FR-101：能從環境變數讀取 NCERT 帳號/密碼並以安全方式登入網站（不得在日誌中寫出密碼）。
- FR-102：定位並導航至月報列表頁（優先使用 /Post2/list.do 作為 fallback）。
- FR-103：解析列表中每筆月報的 metadata（發布日期、標題、下載連結、id）。
- FR-104：支援下載單筆或一批（月/年度範圍）之月報 PDF 並以 safeFileName 規則儲存。
- FR-105：在下載每筆資料前後產生 ARIA snapshot 與 screenshot，儲存對應 metadata 關聯檔。
- FR-106：提供 Robust Reveal Strategy 以處理隱藏或延遲渲染的表格行或展開內容，並在必要時自動重試或 fallback。
- FR-107：驗證下載檔案基本完整性（檔頭魔術值、最小檔案大小），並紀錄校驗結果。
- FR-108：錯誤隔離：單筆失敗不應中止整批作業，並且記錄完整 error stack 與重試次數；若全部筆次失敗則回傳非零退出碼。
- FR-109：輸出結構化（日誌 JSONL）與可選的人類可讀日誌，均含 Asia/Taipei 時區 timestamp。
- FR-110：執行前對所有外部 URL 使用 validateUrl() 過濾（只允許 http/https/about），對檔名使用 safeFileName()，並在不合格時跳過與記錄原因。

### 非功能需求
- 可用性/可靠性：在網路短暫不穩時採用重試（預設 3 次、指數回退），總重試時間上限 30 秒（視情境可配置）。
- 穩定性：不得強制關閉使用者互動的 Chrome（遵循 connectOverCDP 原則）；對 chrome:// 等內部頁面進行過濾。
- 日誌：採 JSON Lines（每行一個 JSON 物件）為主，關鍵欄位：ts（ISO8601+08:00）、level、event、ctx（小型物件）。
- 時區：所有 timestamp 與輸出目錄標記必須使用 Asia/Taipei（UTC+8）。
- 安全性：憑證只能透過環境變數注入（NCERT_USERNAME / NCERT_PASSWORD）；日誌不得包含敏感內容。
- 離線能力：不依賴外部第三方 API（所有資源在內網或本地可取得）。
- 觀察性：必須能產生完整的調試包（ARIA、screenshot、console、network HAR、error stack、metadata）。

### 驗收標準（Given - When - Then）
- Scenario 1 — 成功下載
  - Given 已設定有效 NCERT_USERNAME/NCERT_PASSWORD，網站可連線且列表頁可取得，
  - When 執行腳本下載「最新月份」，
  - Then 產出下載檔案 output\downloads\{safeFileName}.pdf，日誌包含 event=DOWNLOAD_COMPLETED 且程序以 exit code 0 結束。
- Scenario 2 — 隱藏行 reveal
  - Given 月報項目需展開才能顯示下載連結（動態展開）且 initial load 未顯示，
  - When 腳本執行 Robust Reveal Strategy，
  - Then 成功擴展並產出 aria-snapshot.json 與 screenshot.png，日誌包含 event=REVEAL_SUCCESS。
- Scenario 3 — 非法 URL 被過濾
  - Given 列表內出現不允許的 URL（例如 javascript: 或 data:），
  - When 腳本解析該項目,
  - Then 該項目會被跳過並產生 event=VALIDATE_URL_FAILED 記錄，且不會嘗試下載該資源。
- Scenario 4 — 部分下載失敗但整體容錯
  - Given 某筆下載在第一次嘗試時失敗（短暫網路或 5xx），
  - When 腳本依照重試策略重試 3 次仍失敗,
  - Then 該筆記錄 error stack 與 attempts，繼續處理下一筆，最終產出一份 failed-items.json 並以非零退出碼反映「無成功檔案」情況（若至少有一成功則 exit 0）。

### 測試與驗證計畫
- 測試要點（整體）
  - 驗證登入流程、列表解析、reveal 與下載動作；同時驗證所有 debug artifact 是否按規格產出並正確關聯。
  - 所有測試皆於 PowerShell 7.x 中執行，並使用 Asia/Taipei 時區標示輸出目錄。

- 前置（只需執行一次）
  1. 安裝相依套件：在專案根目錄執行
     - npm ci
  2. 型別檢查（CI 與本地檢查）：
     - npx tsc --noEmit

- 實機測試步驟（step-by-step；Windows PowerShell 範例）
  1. 開啟 PowerShell 7.x（pwsh）。
  2. 建立 timestamped 輸出資料夾：
     - $ts = (Get-Date).ToString('yyyyMMdd_HHmmss'); $out = "output\ncert-report\$ts"; New-Item -Path $out -ItemType Directory -Force
  3. 設定必要環境變數（以安全方式注入憑證）：
     - $env:NCERT_USERNAME = 'your_user'; $env:NCERT_PASSWORD = 'your_password'; $env:OUTPUT_DIR = $out; $env:RECORD_ARTIFACTS = '1'
  4. 執行前檢查並啟動腳本（同時將 console 與 stderr 寫入檔案）：
     - npx tsx src\download-ncert-report.ts 2>&1 | Tee-Object -FilePath "$out\console.log"
       （若腳本支援 --config/--outDir 選項，請加上相應參數）
  5. 等待腳本完成後，彙整 artifacts（若腳本未自行寫入，手動複製以下檔案至 $out）：
     - ARIA snapshot(s): $out\aria\{pageSlug}_{ts}.json
     - Screenshots: $out\screenshots\{pageSlug}_{ts}.png
     - Network HAR: $out\network\{pageSlug}_{ts}.har
     - Console log: $out\console.log
     - Error stacks: $out\errors\{itemId}_{ts}.stack.txt
     - Metadata: $out\metadata.json
     - Downloads: $out\downloads\{safeFileName}.pdf
     - Failed items: $out\failed-items.json (若有)
  6. 驗證檔案完整性（PowerShell 範例檢查 PDF header）：
     - $f = "$out\downloads\sample.pdf"; $h = -join (([System.IO.File]::ReadAllBytes($f))[0..3] | ForEach-Object {[char]$_}); if ($h -eq '%PDF' -and (Get-Item $f).Length -gt 10240) { 'PASS' } else { 'FAIL' }
  7. 驗證日誌與事件：
     - 確認 $out\console.log 或 JSONL 日誌中包含 DOWNLOAD_COMPLETED、REVEAL_SUCCESS、VALIDATE_URL_FAILED 等事件，並檢查每筆記錄是否含 ts（+08:00）。

- 調試資料清單（必須收集並上傳 / 保留於測試提交包）
  - ARIA snapshot：materials\aria-snapshots\{pageSlug}_{ts}.json（或 $out\aria\…）
  - Screenshot：materials\recordings\screenshots\{pageSlug}_{ts}.png（或 $out\screenshots\…）
  - Console log：$out\console.log（包含腳本 stdout/stderr）
  - Network log：$out\network\{pageSlug}_{ts}.har（HAR 格式）
  - Error stack：$out\errors\{itemId}_{ts}.stack.txt
  - Timestamped metadata：$out\metadata.json（包含 run_id、ts、url、user、out_dir、counts）
  - 若使用錄製（materials\recordings），請將新錄製放至 materials\recordings 並註明對應測試案例。

- 如何判定測試是否通過（summary）
  - 自動判定：腳本以 exit code 0 結束且至少一筆檔案成功下載、日誌中存在 DOWNLOAD_COMPLETED 且 downloads 目錄內 PDF 通過魔術字與大小檢查。
  - 人工判定：檢視 ARIA snapshot & screenshot 是否清楚且與 metadata 關聯，network.har 無致命錯誤，failed-items.json 若存在須有合理記錄。

### 穩定性策略（Robust Reveal Strategy 摘要）
- 目的：在面對動態渲染或需展開之內容時可靠取得下載連結與可存量資料。
- 步驟（演算法化描述，不貼程式碼）：
  1. 嘗試等待目標 selector 為 visible，timeout 初始值 3000ms；visibilityRetry = 3。
  2. 若不可見，嘗試找到「展開/更多」按鈕並發出 click（最多 revealClickRetry = 3 次），每次 click 後等待 baseDelay = 500ms，採用指數回退（乘以 2）。
  3. 若仍未見內容，嘗試 scrollIntoView + hover（重試 2 次，各等待 1000ms）。
  4. 如上述步驟皆失敗且檢查到表格不符合預期（例如缺少第二列——STRICT_SECOND_ROW 檢查），則觸發 fallback：以 /Post2/list.do 作為替代入口重新嘗試一次完整流程。
  5. 若 fallback 仍失敗，記錄 event=REVEAL_FAILED 與 detail（attempts、lastSelectorState），並將該項目列入 failed-items.json。
- 預設值：visibilityTimeout=3000ms、visibilityRetry=3、revealClickRetry=3、totalRevealTimeout 上限 10000ms；可由環境變數或設定檔覆寫。
- 何時採用 fallback：在三類情況下採用 /Post2/list.do fallback —（1）多重 reveal 嘗試失敗且 STRICT_SECOND_ROW 失敗，（2）頁面 content-type 非預期或被攔截，（3）validateUrl 對主頁面失敗時。

### 故障回退與觀察性（Observability）
- STRICT_SECOND_ROW：若該旗標啟用（預設關閉/可配），當解析表格時若第二列非預期格式即視為嚴重結構變更並觸發 fallback 與高度細節日誌（含 DOM 摘要與 ARIA snapshot）。
- safeFileName：所有下載檔案與 artifact 檔名必須透過 safeFileName() 處理（移除特殊字、空白、限制長度）；日誌需要記錄原始 title 與 safeFileName 對應以利追蹤。
- validateUrl：在導航或下載前過濾 URL（只允許 http / https / about），不合法則記錄 VALIDATE_URL_FAILED 並 skip。
- 當採用 fallback（/Post2/list.do）時，日誌應包含欄位 fallback.source 與 fallback.reason 以利後續 root-cause 分析。

### CI 建議檢查
- 基本型別與建構檢查：
  - npx tsc --noEmit
- 套件安裝（CI job）：
  - npm ci --silent
- 靜態檢查與 pre-commit：
  - 在 CI pipeline 中加入 pre-commit secret scan（例如 trufflehog 或 repo 的 pre-commit hooks），以及檢查 materials/recordings 的錄製不含明文敏感資料。
- E2E 驗證（代表性驗證）：
  - 在有可用測試目標（內網測試環境）時，使用一個 sandbox 測試帳號執行腳本並驗證 artifacts，將結果上傳為 pipeline artifacts 供人工審核。

### 日誌格式與範例
- 建議 JSONL 欄位（必填）：ts (ISO8601+08:00)、level、event、msg（簡短訊息）、ctx（JSON 物件，包含 url、attempt、itemId、safeFileName 等）。
- 範例（兩行）：
  - {"ts":"2026-02-09T15:04:05+08:00","level":"INFO","event":"NAVIGATE","msg":"navigate to list","ctx":{"url":"https://ncert.internal/Post2/list.do","attempt":1}}
  - {"ts":"2026-02-09T15:04:12+08:00","level":"ERROR","event":"DOWNLOAD_FAILED","msg":"timeout after retries","ctx":{"itemId":"2026-01","safeFileName":"NCERT_2026-01.pdf","attempts":3,"stack":"Error: RequestTimeout ..."}}

---

## 11. 變更記錄

| 版本 | 日期 | 變更內容 |
|------|------|------|
| 1.3.0 | 2026-02-11 | 文件全面更新：新增 ARIA-first 工作流說明（T-03 disabled 理由）、修正 sanitize 方向說明（佔位符 vs 實際值）、新增 .env 使用指引與 .env.example、新增 API/Hook 列表（含 loadDotEnv、deprecated 標記）、新增時間戳格式規格、新增安全審計步驟與 CI 建議、新增專案文件索引、更新 SC-009/SC-010 |
| 1.2.0 | 2026-02-10 | 新增 FR-032~FR-039（錄製檔密碼清理、錄製後自動 ARIA 快照、Pre-commit Hook 安全防護） |
| 1.1.0 | 2026-02-10 | 新增 FR-021~FR-031（CDP 預存頁面、優雅關閉、安全、metadata 時區、log 格式）、SDD/Auto Commit/安全準則 |
| 1.0.0 | 2026-02-09 | 初始版本：User Stories、FR 需求、成功標準、第一性原理分析 |
