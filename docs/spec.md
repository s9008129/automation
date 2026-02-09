# 功能規格：內部網路網頁素材離線蒐集工具

**專案名稱**: web-material-collector  
**建立日期**: 2026-02-09  
**最後更新**: 2026-02-09  
**狀態**: v1.0.0 — 核心功能已實作（ARIA 快照 ✅ 截圖 ✅ Codegen 錄製 ✅ 互動模式 ✅）  
**環境**: Windows 11 + PowerShell 7.x + Node.js + Playwright

> **專案定位**：一個「離線素材蒐集工具」——在無外部網路的內部網路環境中，透過 Chrome CDP Debug 模式連接已登入的瀏覽器，蒐集 ARIA 快照、截圖、Codegen 錄製等素材，供外部 AI 分析生成自動化腳本。  
> **核心價值**：橋接內部網路（無 AI）與外部環境（有 AI）的鴻溝，實現「人工蒐集 → AI 生成 → 內網執行」的工作流程。

---

## Clarifications

### Session 2026-02-09

- Q: Chrome Debug 模式連接後為什麼找不到正確頁面？ → A: Chrome CDP 會列出內部頁面（`chrome://omnibox-popup`、`chrome://newtab-footer`），必須過濾只保留 `http://` / `https://` 頁面。
- Q: Windows 上 `npx` 為什麼 spawn 失敗？ → A: Node.js v24+ 在 Windows 直接 spawn `npx.cmd` 會觸發 `EINVAL`，改用 `cmd.exe /d /s /c "npx ..."` + `windowsVerbatimArguments: true`。
- Q: 端口 9222 被普通 Chrome 占用怎麼辦？ → A: `launch-chrome.ps1` 會偵測端口佔用者的命令列，區分是我們的 debug Chrome 還是一般 Chrome，並提示用戶處理。

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

- **Chrome 內部頁面干擾**：`getActivePage()` 必須過濾 `chrome://`、`chrome-extension://`、`devtools://`、`about:blank` 等內部頁面
- **端口被非 debug Chrome 占用**：`launch-chrome.ps1` 透過 `Win32_Process.CommandLine` 檢查是否為我們的 debug profile
- **全頁截圖失敗**：某些頁面不支援 `fullPage: true`，自動降級為視窗截圖
- **iframe 超過深度限制**：`iframeDepth` 限制遞迴深度（預設 3，最大 10）
- **Codegen 在 Windows 上 spawn 失敗**：使用 `cmd.exe` 包裝命令，設定 `windowsVerbatimArguments: true`
- **使用者 Ctrl+C 中斷**：攔截 SIGINT/SIGTERM，安全斷開 CDP 連接

---

## 需求 *(必要)*

### 功能需求

#### 核心功能

- **FR-001**: 系統 MUST 透過 Chrome CDP（`connectOverCDP`）連接到使用者已開啟的 Chrome Debug 模式
- **FR-002**: 系統 MUST 過濾 Chrome 內部頁面（`chrome://`、`chrome-extension://`、`devtools://`、`about:blank`），只操作使用者可見的 http/https 頁面
- **FR-003**: 系統 MUST 能擷取頁面 ARIA 快照（包含 iframe 遞迴，深度可設定）
- **FR-004**: 系統 MUST 能擷取頁面截圖（全頁截圖失敗時自動降級為視窗截圖）
- **FR-005**: 系統 MUST 能啟動 Playwright Codegen 錄製使用者互動流程
- **FR-006**: 系統 MUST 能擷取頁面 HTML 原始碼（可選功能）
- **FR-007**: 系統 MUST 在斷開連接時 NEVER 呼叫 `browser.close()`（保持使用者 Chrome 運行）

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
- **SC-006**: Chrome 內部頁面（`chrome://`）被正確過濾，不影響素材蒐集

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

## 📝 變更記錄

| 版本 | 日期 | 變更內容 |
|------|------|------|
| 1.0.0 | 2026-02-09 | 初始版本：User Stories、FR 需求、成功標準、第一性原理分析 |
