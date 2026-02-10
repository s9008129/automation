# 功能規格：內部網路網頁素材離線蒐集工具

**專案名稱**: web-material-collector  
**建立日期**: 2026-02-09  
**最後更新**: 2026-02-10（已由 claude-opus-4.6 更新：錄製清理/ARIA 自動快照/Pre-commit Hook）  
**狀態**: v1.2.0 — 核心功能已實作（ARIA 快照 ✅ 截圖 ✅ Codegen 錄製 ✅ 互動模式 ✅ 優雅關閉 ✅ 錄製密碼清理 ✅ 錄製後 ARIA 快照 ✅ Pre-commit Hook ✅）  
**環境**: Windows 11 + PowerShell 7.x + Node.js v20+ + Playwright ^1.52.0 + TypeScript ^5.7.3

> **專案定位**：一個「離線素材蒐集工具」——在無外部網路的內部網路環境中，透過 Chrome CDP Debug 模式連接已登入的瀏覽器，蒐集 ARIA 快照、截圖、Codegen 錄製等素材，供外部 AI 分析生成自動化腳本。  
> **核心價值**：橋接內部網路（無 AI）與外部環境（有 AI）的鴻溝，實現「人工蒐集 → AI 生成 → 內網執行」的工作流程。

---

## 前置條件與啟動命令

- **OS / Shell**：Windows 11 + PowerShell 7.x（目標環境）
- **Node.js**：v20+（由 `setup.ps1` 驗證）
- **Chrome Debug 啟動命令**（PowerShell）：
  ```powershell
  .\launch-chrome.ps1
  # 指定 CDP 端口（預設 9222）
  .\launch-chrome.ps1 -Port 9223
  ```
- **CDP_PORT**：預設 `9222`（CLI `--port` / 設定檔 `cdpPort` 對應同一端口）

---

## Clarifications

### Session 2026-02-09

- Q: Chrome Debug 模式連接後為什麼找不到正確頁面？ → A: Chrome CDP 會列出內部頁面（`chrome://omnibox-popup`、`chrome://newtab-footer`），必須過濾只保留 `http://` / `https://` 頁面。
- Q: Windows 上 `npx` 為什麼 spawn 失敗？ → A: Node.js v24+ 在 Windows 直接 spawn `npx.cmd` 會觸發 `EINVAL`，改用 `cmd.exe /d /s /c "npx ..."` + `windowsVerbatimArguments: true`。
- Q: 端口 9222 被普通 Chrome 占用怎麼辦？ → A: `launch-chrome.ps1` 會偵測端口佔用者的命令列，區分是我們的 debug Chrome 還是一般 Chrome，並提示用戶處理。

### Session 2026-02-10

- Q: `connectOverCDP` 連接後 `page.url()` 回傳空字串怎麼辦？ → A: 預存頁面（連接前已開啟的頁面）的 `page.url()` 可能為空。使用 `CDPSession.send('Runtime.evaluate', { expression: 'location.href' })` 取得真實 URL，若偵測到預存頁面則自動開啟新分頁並導航至同一 URL。
- Q: 使用者按 Ctrl+C 時如何確保 metadata 被寫入？ → A: `SIGINT`/`SIGTERM` 信號觸發 `collector.requestShutdown()`，設定 `isShuttingDown = true`，讓迴圈在下一輪迭代停止，並進入 `finally` 區塊執行 `saveMetadata()` 與 `disconnect()`。
- Q: `.env` 檔案是否應加入 `.gitignore`？ → A: 是，已新增 `.env` 至 `.gitignore`，避免明文憑證被意外提交。

---

## 使用者情境與測試 *(必要)*

### User Story 1 - 互動式蒐集內部網站素材 (Priority: P1)

作為一位需要將內部網站素材帶到外部環境讓 AI 分析的使用者，我希望工具能引導我一步一步蒐集每個頁面的 ARIA 快照和截圖，讓我不需要理解技術細節就能完成素材蒐集。

**為什麼此優先級**：互動模式是大多數使用者的首選，一步一步引導最容易上手。

**驗收情境**：

1. **Given** Chrome 已以 Debug 模式啟動並登入內部網站，**When** 執行 `npm run collect` 並選擇互動模式，**Then** 系統連接到 Chrome 並顯示當前頁面資訊
2. **Given** 系統已連接到 Chrome，**When** 使用者輸入頁面名稱和描述，**Then** 系統自動擷取 ARIA 快照和截圖並儲存到 `materials/` 目錄
3. **Given** 已蒐集一個頁面，**When** 使用者按 Enter，**Then** 系統提示蒐集下一個頁面（使用者需先在 Chrome 中手動切換到目標頁面）
4. **Given** 使用者選擇結束蒐集，**When** 輸入 `q`，**Then** 系統儲存 metadata.json 和 summary-report.md 並安全斷開連接

---

### User Story 2 - 錄製互動流程 (Priority: P1)

作為一位需要記錄登入操作或表單填寫流程的使用者，我希望工具能啟動 Playwright Codegen 錄製我的操作，生成可重播的 TypeScript 腳本。

**為什麼此優先級**：Codegen 錄製是讓 AI 理解使用者操作流程的關鍵素材。

**驗收情境**：

1. **Given** 在互動模式中蒐集了頁面素材，**When** 使用者選擇 `r`（錄製），**Then** 系統提示輸入錄製名稱和起始 URL
2. **Given** 使用者確認開始錄製，**When** 系統啟動 Codegen，**Then** 開啟新的瀏覽器視窗讓使用者操作
3. **Given** Codegen 正在錄製，**When** 使用者關閉錄製視窗，**Then** 系統將錄製結果儲存到 `materials/recordings/` 目錄
4. **Given** 錄製在 Windows 環境執行，**When** 啟動 Codegen，**Then** 使用 `cmd.exe /d /s /c` 包裝命令避免 spawn EINVAL 錯誤
5. **Given** 錄製檔已儲存，**When** 錄製檔包含密碼欄位的 `.fill()` 呼叫，**Then** 系統自動執行 `sanitizeRecording()` 將明文密碼替換為 `process.env.RECORDING_PASSWORD`
6. **Given** 錄製檔已完成清理，**When** 錄製檔中包含 `page.goto()` 呼叫，**Then** 系統自動執行 `extractUrlsFromRecording()` 提取 URL 並逐一擷取 ARIA 快照

---

### User Story 3 - 快照模式快速擷取 (Priority: P2)

作為一位只需要快速擷取當前頁面的使用者，我希望能用一個命令就完成 ARIA 快照和截圖。

**為什麼此優先級**：快照模式適合快速取樣，不需要完整蒐集流程。

**驗收情境**：

1. **Given** Chrome 已以 Debug 模式啟動並瀏覽目標頁面，**When** 執行 `npm run collect:snapshot`，**Then** 系統自動擷取當前頁面的 ARIA 快照和截圖
2. **Given** 系統擷取快照，**When** 頁面包含 iframe，**Then** 系統遞迴擷取所有 iframe 的 ARIA 快照（最深 3 層）

---

### User Story 4 - 自動模式批次蒐集 (Priority: P2)

作為一位需要重複蒐集多個固定頁面的使用者，我希望能透過設定檔定義所有目標頁面，一次性自動蒐集。

**為什麼此優先級**：自動模式適合已經知道要蒐集哪些頁面的進階使用者。

**驗收情境**：

1. **Given** `collect-materials-config.json` 已定義目標頁面列表，**When** 執行 `npm run collect:auto`，**Then** 系統依序導航到每個頁面並蒐集素材
2. **Given** 某個頁面導航失敗，**When** 系統偵測到錯誤，**Then** 記錄錯誤到 metadata.errors 並繼續處理下一個頁面

---

### User Story 5 - Chrome Debug 模式啟動 (Priority: P1)

作為一位非技術人員，我希望執行一個腳本就能啟動 Chrome Debug 模式，不需要理解 CDP 是什麼。

**為什麼此優先級**：這是所有素材蒐集的前提，必須簡單可靠。

**驗收情境**：

1. **Given** Chrome 已安裝，**When** 執行 `.\launch-chrome.ps1`，**Then** 啟動使用獨立 profile 的 Chrome 並開啟 CDP 端口 9222
2. **Given** 端口 9222 已被一般 Chrome 佔用，**When** 執行腳本，**Then** 偵測到非 debug Chrome 並提示使用者處理
3. **Given** Debug Chrome 已在運行，**When** 再次執行腳本，**Then** 偵測到已運行的 debug Chrome 並顯示下一步指引
4. **Given** Chrome 啟動成功，**When** 驗證 CDP 連接，**Then** 請求 `/json/version` 確認版本並記錄所有已開啟頁面到 log

---

### 邊緣案例

- **Chrome 內部頁面干擾**：`getActivePage()` 必須過濾 `chrome://`、`chrome-extension://`、`chrome-untrusted://`、`devtools://`、`about:blank` 等內部頁面
- **端口被非 debug Chrome 占用**：`launch-chrome.ps1` 透過 `Win32_Process.CommandLine` 檢查是否為我們的 debug profile
- **全頁截圖失敗**：某些頁面不支援 `fullPage: true`，自動降級為視窗截圖
- **iframe 超過深度限制**：`iframeDepth` 限制遞迴深度（預設 3，最大 10）
- **Codegen 在 Windows 上 spawn 失敗**：使用 `cmd.exe` 包裝命令，設定 `windowsVerbatimArguments: true`
- **使用者 Ctrl+C 中斷**：攔截 SIGINT/SIGTERM，透過 `requestShutdown()` 優雅關閉，確保 `finally` 區塊執行 `saveMetadata()` 與 `disconnect()`
- **CDP 預存頁面 `page.url()` 為空**：使用 `CDPSession.send('Runtime.evaluate')` 取得真實 URL，若 `page.url() === ''` 則自動開啟新分頁並導航至同一 URL
- **錄製檔含明文密碼**：`sanitizeRecording()` 自動偵測並替換 `.fill()` 中的密碼欄位為 `process.env.RECORDING_PASSWORD`
- **錄製後缺少中間頁面快照**：`extractUrlsFromRecording()` 解析 `page.goto()` URL，`captureSnapshotsForUrls()` 逐一擷取 ARIA 快照
- **敏感資料意外 commit**：`.githooks/pre-commit` 掃描錄製檔中的密碼、token、secret 模式，匹配時阻止 commit

---

## 需求 *(必要)*

### 功能需求

#### 核心功能

- **FR-001**: 系統 MUST 透過 Chrome CDP（`connectOverCDP`）連接到使用者已開啟的 Chrome Debug 模式
- **FR-002**: 系統 MUST 過濾 Chrome 內部頁面（`chrome://`、`chrome-extension://`、`chrome-untrusted://`、`devtools://`、`about:blank`），只操作使用者可見的 http/https 頁面
- **FR-003**: 系統 MUST 能擷取頁面 ARIA 快照（包含 iframe 遞迴，深度可設定）
- **FR-004**: 系統 MUST 能擷取頁面截圖（全頁截圖失敗時自動降級為視窗截圖）
- **FR-005**: 系統 MUST 能啟動 Playwright Codegen 錄製使用者互動流程
- **FR-006**: 系統 MUST 能擷取頁面 HTML 原始碼（可選功能）
- **FR-007**: 系統 MUST 在斷開連接時 NEVER 呼叫 `browser.close()`（保持使用者 Chrome 運行），只將 `this.browser = null`

#### CDP 預存頁面處理

- **FR-021**: 系統 MUST 偵測 `page.url() === ''` 的 CDP 預存頁面，使用 `CDPSession.send('Runtime.evaluate', { expression: 'location.href' })` 取得真實 URL
- **FR-022**: 系統 MUST 在偵測到預存頁面時，自動開啟新分頁（`context.newPage()`）並導航至真實 URL
- **FR-023**: 系統 MUST 在取得頁面標題時先嘗試 `page.title()`，超時 3 秒後降級為 CDPSession 方式

#### 優雅關閉（Graceful Shutdown）

- **FR-024**: 系統 MUST 攔截 `SIGINT`（Ctrl+C）和 `SIGTERM` 信號
- **FR-025**: 收到中斷信號時，系統 MUST 透過 `requestShutdown()` 設定 `isShuttingDown = true`，讓進行中的蒐集迴圈在下一輪迭代停止
- **FR-026**: 系統 MUST 保證 `finally` 區塊執行，確保 `saveMetadata()` 與 `disconnect()` 在中斷時仍能完成

#### 安全需求

- **FR-027**: 原始碼與錄製檔中 MUST NOT 包含明文憑證（帳號密碼），應使用環境變數（如 `NCERT_USERNAME`/`NCERT_PASSWORD`）或 `.env` 檔案
- **FR-028**: `.gitignore` MUST 包含 `.env` 與 `logs/`，防止敏感資料與日誌被提交到版本控制

<!-- Implemented T-04 by claude-opus-4.6 on 2026-02-10 -->

#### 錄製檔密碼清理（sanitizeRecording）

- **FR-032**: 系統 MUST 在錄製結束後自動執行 `sanitizeRecording()`，掃描 `.fill()` 呼叫中的密碼欄位並將明文密碼替換為 `process.env.RECORDING_PASSWORD`
- **FR-033**: `sanitizeRecording()` MUST 在錄製檔開頭加入清理標記 `// ⚠️ 此錄製檔已經過敏感資訊清理`
- **FR-034**: 系統 MUST 支援透過環境變數 `RECORDING_PASSWORD` 設定密碼替換值

<!-- Implemented T-01, T-03 by claude-opus-4.6 on 2026-02-10 -->

#### 錄製後自動擷取 ARIA 快照

- **FR-035**: 系統 MUST 在錄製結束後執行 `extractUrlsFromRecording()`，從錄製檔解析所有 `page.goto()` 呼叫中的 URL
- **FR-036**: 系統 MUST 對提取的 URL 執行 `captureSnapshotsForUrls()`，逐一導航並擷取 ARIA 快照，儲存命名格式為 `{flowName}-url{index}.md`

<!-- Implemented T-05 by claude-opus-4.6 on 2026-02-10 -->

#### Pre-commit Hook 安全防護

- **FR-037**: `.githooks/pre-commit` MUST 在 `git commit` 時呼叫 `scripts/pre-commit-scan.ps1` 掃描 `materials/recordings/*.ts`
- **FR-038**: `pre-commit-scan.ps1` MUST 掃描密碼（`.fill` 明文）、token、secret 模式，偵測到匹配時 MUST 以 exit code 1 阻止 commit
- **FR-039**: 使用者 MUST 透過 `git config core.hooksPath .githooks` 啟用 pre-commit hook

#### 操作模式

- **FR-008**: 系統 MUST 支援互動模式（一步一步引導蒐集）
- **FR-009**: 系統 MUST 支援自動模式（依設定檔批次蒐集）
- **FR-010**: 系統 MUST 支援快照模式（快速擷取當前頁面）
- **FR-011**: 系統 MUST 支援錄製模式（直接啟動 Codegen）

#### 輸出格式

- **FR-012**: 系統 MUST 輸出 `metadata.json`（蒐集記錄、頁面統計、錯誤記錄）
- **FR-013**: 系統 MUST 輸出 `summary-report.md`（摘要報告、檔案結構說明）
- **FR-014**: ARIA 快照 MUST 包含頁面 URL、標題、擷取時間、專案名稱等 header 資訊

#### 日誌與診斷

- **FR-015**: 系統 MUST 產生結構化 log 檔案（含時間戳、層級、環境資訊、錯誤堆疊）
- **FR-016**: log 檔案 MUST 記錄 CDP 連接後所有頁面的 URL 和 `isUserPage` 狀態
- **FR-017**: 所有 catch 區塊 MUST 將錯誤記錄到 log 和 `metadata.errors` 陣列
- **補充**：log 檔名規則為 `logs\setup-YYYYMMDD-HHMMSS.log`、`logs\launch-chrome-YYYYMMDD-HHMMSS.log`、`logs\collect-materials-YYYYMMDD-HHMMSS.log`（時間戳使用台北時間）

#### metadata.json 規範

- **FR-029**: `metadata.json` MUST 包含以下欄位：`projectName`、`collectedAt`、`timezone`、`toolVersion`、`platform`、`nodeVersion`、`playwrightVersion`、`logFile`、`totalPages`、`collectedPages`、`recordings`、`errors`
- **FR-030**: `metadata.json` 的 `timezone` 欄位 MUST 為 `Asia/Taipei (UTC+8)`，所有時間戳記 MUST 使用 `getTaipeiISO()` 產生（格式：`YYYY-MM-DDTHH:mm:ss+08:00`）
- **FR-031**: log 檔案格式 MUST 為 `[ISO8601時間戳][層級] emoji 訊息`，層級為 `INFO`/`WARN`/`ERROR`/`CONTEXT`

#### Windows 相容

- **FR-018**: 系統 MUST 在 Windows 上使用 `cmd.exe /d /s /c` 啟動子程序（避免 `spawn EINVAL`）
- **FR-019**: `launch-chrome.ps1` MUST 偵測端口佔用並區分 debug Chrome 與一般 Chrome
- **FR-020**: `setup.ps1` MUST 一鍵完成環境安裝（Node.js 檢查、npm install、Playwright Chromium 下載）

### 關鍵實體

- **CollectConfig（蒐集設定）**：專案名稱、CDP 端口、輸出目錄、蒐集選項（ARIA/截圖/HTML/Codegen）、目標頁面列表、互動流程列表
- **MaterialMetadata（素材後設資料）**：蒐集時間、環境資訊、頁面統計、錄製記錄、錯誤記錄
- **PageTarget（目標頁面）**：頁面名稱、URL、描述、等待策略、操作動作
- **ErrorRecord（錯誤記錄）**：頁面名稱、錯誤訊息、時間戳、堆疊追蹤

---

## 成功標準 *(必要)*

### 可衡量成果

- **SC-001**: 使用者執行 `.\setup.ps1` 即可完成環境安裝，無需手動操作
- **SC-002**: 使用者執行 `.\launch-chrome.ps1` 即可啟動 Chrome Debug 模式，包含端口衝突處理
- **SC-003**: 互動模式下蒐集 ARIA 快照和截圖的成功率達 95% 以上
- **SC-004**: Codegen 錄製在 Windows 11 + Node.js v24+ 環境下正常啟動
- **SC-005**: 所有錯誤都記錄在 log 檔案和 metadata.json 中，AI 可透過 log 診斷問題根因
- **SC-006**: Chrome 內部頁面（`chrome://`、`chrome-untrusted://` 等）被正確過濾，不影響素材蒐集
- **SC-007**: 使用者按 Ctrl+C 後，metadata.json 與 summary-report.md 仍能正確寫入
- **SC-008**: `.gitignore` 包含 `.env` 與 `logs/`，敏感資料不被提交

---

## 第一性原理分析 *(參考)*

### 問題本質分解

```
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
```

### 技術約束的推導

```
約束一：為何使用 CDP 而不是直接啟動 Playwright？
├── 前提：使用者需要手動登入內部網站（可能有雙重驗證）
├── Playwright 直接啟動 → 無法使用已登入的 session
├── CDP 連接 → 可以「看到」使用者已登入的頁面
├── 結論：MUST 使用 connectOverCDP

約束二：為何需要過濾 Chrome 內部頁面？
├── 前提：Chrome 開啟 CDP 後，內部頁面（Omnibox Popup 等）也會出現在 pages 列表
├── 若不過濾 → getActivePage() 會選到 chrome://omnibox-popup
├── 結論：MUST 過濾 chrome:// 開頭的 URL

約束三：為何 Windows 上 spawn 需要特殊處理？
├── 前提：Node.js v24+ 對 Windows spawn 行為有重大變更
├── 直接 spawn('npx.cmd') → 觸發 EINVAL
├── 結論：MUST 用 cmd.exe /d /s /c 包裝命令
```

---

## 📜 SDD 開發法（Specification-Driven Development）

### 核心原則：文件即可執行資產

| 原則 | 說明 |
|------|------|
| 文件是真理來源 | 程式碼必須符合文件規格，不是相反 |
| 先文件後程式碼 | 任何功能開發前必須先更新規格文件 |
| 文件即測試 | 驗收標準（Given-When-Then）直接轉換為驗證流程 |
| 文件即溝通 | 所有技術決策記錄在文件中，減少口頭溝通成本 |

### SDD 文件清單

| 文件 | 路徑 | 可執行性 |
|------|------|---------|
| 功能規格 | `docs/spec.md` | ✅ Given-When-Then 可直接轉換為測試案例 |
| 使用指南 | `docs/使用指南.md` | ✅ 步驟可直接複製執行 |
| README | `README.md` | ✅ 快速開始可直接複製執行 |
| AI 開發準則 | `.github/copilot-instructions.md` | ✅ AI 開發規範 |

---

## 🔄 Auto Commit 策略

每次完成任務後 MUST 執行 git commit。Commit 訊息格式：

```
<type>(<scope>): <簡短摘要>
```

| Type | 用途 |
|------|------|
| `feat` | 新功能 |
| `fix` | 錯誤修復 |
| `docs` | 文件更新 |
| `refactor` | 重構 |
| `chore` | 雜項 |

- Commit 訊息 MUST 使用繁體中文（zh-TW），技術術語可保留英文

---

## 🔒 安全準則

- 原始碼與錄製檔中 **MUST NOT** 包含明文帳號密碼
- 自動化腳本需要憑證時，MUST 使用環境變數（如 `NCERT_USERNAME`/`NCERT_PASSWORD`）或 `.env` 檔案
- `.gitignore` MUST 包含 `.env` 與 `logs/`
- `safeFileName()` 防止路徑穿越攻擊
- `validateUrl()` 只允許 `http:`/`https:`/`about:` 協定
- 不記錄使用者密碼到日誌

---

## 🛑 SIGINT/SIGTERM 優雅關閉流程

```typescript
// 模組層級的 collector 參考
let activeCollector: MaterialCollector | null = null;

process.on('SIGINT', () => {
  if (activeCollector) {
    activeCollector.requestShutdown();   // 設定 isShuttingDown = true
  } else {
    process.exit(0);
  }
});

// MaterialCollector 內部
class MaterialCollector {
  private isShuttingDown = false;
  requestShutdown(): void { this.isShuttingDown = true; }

  async collectInteractive(): Promise<void> {
    try {
      while (!this.isShuttingDown) {
        // 蒐集頁面...
      }
    } finally {
      this.saveMetadata();         // 保證 metadata.json 寫入
      this.generateSummaryReport(); // 保證 summary-report.md 寫入
      await this.disconnect();      // 斷開連線（不關閉 Chrome）
    }
  }
}
```

---

## ✅ 重點修補清單

| 編號 | 變更摘要 | 驗證指令 | 接受標準 | 回滾方法 |
|------|---------|---------|---------|---------|
| T-01 | 新增 `chrome-untrusted://` 至內部頁面過濾清單 | 檢查 `isUserPageByUrl()` 中包含 `chrome-untrusted://` | 該協定頁面被過濾 | `git checkout collect-materials.ts` |
| T-02 | CDP 預存頁面自動重新附加（`page.url()===''` 處理） | 連線後觀察 log 中 `偵測到 CDP 預存頁面` | 自動開新分頁並導航 | `git checkout collect-materials.ts` |
| T-03 | SIGINT/SIGTERM 優雅關閉（`requestShutdown()`） | 蒐集中按 Ctrl+C，檢查 metadata.json 是否存在 | metadata 與 report 正確寫入 | `git checkout collect-materials.ts` |
| T-04 | CDPSession 解析真實 URL/Title（替代 `page.url()` 空值） | 查看 log 中 `resolvePageUrl` 記錄 | syncUrl 為空時 realUrl 有值 | `git checkout collect-materials.ts` |
| T-05 | `.gitignore` 新增 `.env` | `cat .gitignore \| Select-String ".env"` | 輸出包含 `.env` | `git checkout .gitignore` |
| T-06 | metadata.json timezone 欄位為 `Asia/Taipei (UTC+8)` | `Get-Content materials\metadata.json \| Select-String timezone` | 值為 `Asia/Taipei (UTC+8)` | 無需回滾（讀取驗證） |
| T-07 | spec.md 新增 FR-021~FR-031 | 檢視 `docs\spec.md` 中 FR 編號 | 包含 FR-021 至 FR-031 | `git checkout docs\spec.md` |
| T-08 | 使用指南新增安全與優雅關閉段落 | 檢視 `docs\使用指南.md` | 包含 SIGINT/安全準則段落 | `git checkout docs\使用指南.md` |
| T-09 | spec.md/使用指南.md 新增 SDD 與 Auto Commit 說明 | 檢視文件 | 包含 SDD 開發法與 Commit 規範 | `git checkout docs\spec.md docs\使用指南.md` |
| T-10 | 錄製檔密碼自動清理（sanitizeRecording） | 錄製含密碼流程後檢查 `.ts` 檔案 | 密碼被替換為 `process.env.RECORDING_PASSWORD` | `git checkout collect-materials.ts` |
| T-11 | 錄製後自動擷取中間頁面 ARIA 快照 | 錄製後檢查 `materials/aria-snapshots/` | 出現 `{flowName}-url*.md` 快照檔案 | `git checkout collect-materials.ts` |
| T-12 | Pre-commit Hook 掃描敏感資訊 | `git config core.hooksPath .githooks` 後嘗試 commit 含密碼的錄製檔 | commit 被阻止 | `git config --unset core.hooksPath` |

---

## 📝 變更記錄

| 版本 | 日期 | 變更內容 |
|------|------|------|
| 1.2.0 | 2026-02-10 | 新增 FR-032~FR-039（錄製檔密碼清理、錄製後自動 ARIA 快照、Pre-commit Hook 安全防護）、新增 User Story 2 驗收情境 5-6、新增邊緣案例（密碼清理、中間頁面快照、敏感資料 commit）、新增修補清單 T-10~T-12 |
| 1.1.0 | 2026-02-10 | 已由 claude-opus-4.6 子代理更新：新增 FR-021~FR-031（CDP 預存頁面、優雅關閉、安全、metadata 時區、log 格式）、新增 SDD/Auto Commit/安全準則/SIGINT 流程/修補清單段落、更新 SC-006~SC-008、更新邊緣案例與 Clarifications |
| 1.0.0 | 2026-02-09 | 初始版本：User Stories、FR 需求、成功標準、第一性原理分析 |
