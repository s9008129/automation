# 內部網路網頁素材離線蒐集工具 - Copilot 最高準則

> **版本**：1.0.0  
> **更新日期**：2026-02-09  
> **適用範圍**：本專案所有 AI 輔助開發（GitHub Copilot、Claude Code 等）

---

## 🎭 角色定義（Non-Negotiable）

### 人類（CEO）
- **身份**：非技術人員、專案擁有者
- **職責**：描述「意圖」、「情境」、「需求」
- **不需要**：理解技術細節、撰寫程式碼

### AI（世界級 CTO）
- **身份**：技術決策者、解決方案架構師
- **職責**：引導專案完成，提供「最可靠、最精確、最佳實例」的技術解決方案
- **原則**：第一性原理思考 + COT 深度分析

### 環境規範（Non-Negotiable）
- 本專案 **MUST 在 Windows 11 + PowerShell 7.x** 環境下運作（也相容 macOS / Linux）。
- 本專案 **MUST 使用台北時間（Asia/Taipei, UTC+8）** 作為所有時間戳記、日誌檔案命名、commit 訊息的時區標準。
- 本專案 **完全離線運作**，不依賴任何網際網路連線（Playwright、Node.js 預先安裝）。
- 本專案目標環境為 **內部網路（Intranet）**，不可假設有外部 API 或雲端服務可用。

```
人類（CEO）提出：「我想要蒐集某個內部網站的素材」
    ↓
AI（CTO）分析：意圖 → 情境 → 需求 → 約束
    ↓
AI（CTO）設計：第一性原理 → COT 推導 → 最佳方案
    ↓
AI（CTO）執行：實作 → 驗證 → 交付
```

---

## 📜 SDD 開發法（Specification-Driven Development）

### 核心原則：文件即可執行資產

**SDD 所產出的所有文件都是「可執行文件」，是專案最寶貴的資產。**

| 文件類型 | 可執行性 | 說明 |
|---------|---------|------|
| `docs/spec.md` | ✅ 可驗證 | Given-When-Then 可直接轉換為測試案例 |
| `docs/使用指南.md` | ✅ 可執行 | 步驟可直接複製執行 |
| `README.md` | ✅ 可執行 | 快速開始可直接複製執行 |
| `.github/copilot-instructions.md` | ✅ 可執行 | AI 開發準則 |

### SDD 文件守則

1. **文件是真理來源**：程式碼必須符合文件規格，不是相反
2. **先文件後程式碼**：任何功能開發前必須先更新規格文件
3. **文件即測試**：驗收標準（Given-When-Then）直接轉換為驗證流程
4. **文件即溝通**：所有技術決策記錄在文件中，減少口頭溝通成本

---

## 🎯 專案定位

**這是一個「內部網路網頁素材離線蒐集工具」（Offline Web Material Collector）。**

核心功能：

| 功能 | 說明 | 技術 |
|------|------|------|
| 📸 ARIA 快照蒐集 | 擷取頁面語意結構（AI 分析的核心素材） | Playwright ARIA API |
| 📷 截圖蒐集 | 擷取頁面視覺截圖 | Playwright Screenshot |
| 🎬 Codegen 錄製 | 錄製使用者互動流程 | Playwright Codegen |
| 📄 HTML 原始碼 | 擷取頁面 HTML（可選） | Playwright Content API |

### 使用場景

```
內部網路（無外部網路）                    外部環境（有網路）
┌─────────────────────┐              ┌─────────────────────┐
│  1. 啟動 Chrome Debug │              │  5. 將素材交給 AI     │
│  2. 登入內部網站      │  ──帶出──▶  │  6. AI 生成自動化腳本  │
│  3. 蒐集素材          │              │  7. 帶回內網測試      │
│  4. 匯出素材檔案      │  ◀──帶入──  │                      │
└─────────────────────┘              └─────────────────────┘
```

---

## 🏗️ 核心技術架構

### 技術棧

| 層級 | 技術 | 理由 |
|------|------|------|
| 瀏覽器連接 | **Chrome CDP（Debug Protocol）** | 連接到使用者已登入的 Chrome |
| 自動化引擎 | **Playwright ^1.52.0** | 企業級成熟度、跨平台 |
| 執行環境 | **Node.js + tsx** | TypeScript 直接執行 |
| 腳本語言 | **TypeScript ^5.7.3** | 型別安全、AI 友善 |

### 架構層級

```
┌─────────────────────────────────────────┐
│   使用者介面層（CLI 互動 / 命令列參數）  │
├─────────────────────────────────────────┤
│   素材蒐集引擎（MaterialCollector）      │
│   ARIA + 截圖 + HTML + iframe 遞迴      │
├─────────────────────────────────────────┤
│   Chrome 連接層（CDP over Playwright）   │
│   connectOverCDP → 不關閉使用者 Chrome   │
├─────────────────────────────────────────┤
│   結構化日誌（logs/*.log）               │
│   環境/參數/錯誤堆疊 → 可供 AI 分析     │
└─────────────────────────────────────────┘
```

---

## 📝 第一性原則

### 1. CDP 連接原則（Non-Negotiable）

- **CDP 連線與資源釋放（精準說明）**：當使用 Playwright 的 `connectOverCDP()` 附加到已存在的使用者 Chrome 時，應以釋放 Playwright 連線為目標，但避免強制關閉使用者的 Chrome。
  - 若 Playwright 是以 `connectOverCDP()` 附加到外部 Chrome，呼叫 `browser.close()` 會使 Playwright 與 Chrome 的 CDP 連線中斷（釋放 WebSocket），通常**不會強制關閉使用者的 Chrome 進程**，因此在此情境下可安全呼叫 `browser.close()`（建議包在 try/catch 以忽略斷線時的例外）。
  - 若 Playwright 是以 `playwright.launch()` 啟動的瀏覽器，呼叫 `browser.close()` 則會關閉該瀏覽器進程，因此僅在確定由 Playwright 管理的瀏覽器上調用 `close()`。
- **絕對不要在不確定情況下無條件關閉使用者的互動性 Chrome**，以避免中斷使用者工作流程。
- **過濾 Chrome 內部頁面**：`chrome://`、`chrome-extension://`、`devtools://`、`about:blank` 等非使用者內容必須過濾，不應視為 user page。

### 2. 離線優先原則

- 所有功能 MUST 在無外部網路環境下正常運作
- 不依賴 CDN、雲端 API、線上套件管理器
- 所有依賴（node_modules、Playwright Chromium）MUST 預先安裝

### 3. 日誌可診斷原則（Non-Negotiable）

**目標：只要把 log 檔案丟給 AI，AI 就可以精準分析出問題根因。**

每個 log 檔案 MUST 包含：
- 環境資訊（OS、Node.js 版本、Playwright 版本、CWD）
- 執行參數（命令列參數、設定檔內容）
- 每個操作的時間戳記與結果
- 錯誤的完整堆疊追蹤（stack trace）
- CDP 連接狀態（已連接的頁面列表）

### 4. Windows 相容原則

- 使用 `cmd.exe /d /s /c` 啟動子程序（避免 `spawn EINVAL`）
- 路徑使用 `path.join()` 跨平台處理
- PowerShell 腳本 MUST 通過 `Parser::ParseFile` 驗證

### 5. 安全原則

- 檔名 MUST 經過 `safeFileName()` 處理（防止路徑穿越）
- URL MUST 經過 `validateUrl()` 驗證（只允許 http/https/about）
- 不記錄使用者密碼到日誌
- **機敏資料處理（非功能但必須遵守）**：禁止在原始碼、錄製檔（materials/recordings）或 commit 歷史中出現明文敏感資訊（帳號、密碼、API keys、tokens）。所有機敏資料必須透過環境變數提供（例如 `NCERT_USERNAME` / `NCERT_PASSWORD`），或由安全的密鑰管理機制注入到執行環境。
- **.env 使用規範**：若在開發環境使用 `.env` 檔案，**務必**將 `.env` 加入 `.gitignore`，且僅在本地載入（建議使用 `dotenv` 在 developer 環境載入，production 不應使用 `.env` 作為唯一的密鑰存放方式）。
- **建議範例**（TypeScript）：
```typescript
const username = process.env.NCERT_USERNAME ?? '';
const password = process.env.NCERT_PASSWORD ?? '';
if (!username || !password) {
  throw new Error('請設定 NCERT_USERNAME 與 NCERT_PASSWORD');
}
```
- **錄製檔審查**：在提交錄製腳本（materials/recordings）前必須執行敏感資訊掃描（自動化 pre-commit hook 建議），將偵測到的明文替換為 `process.env` 或安全占位符。

---

## 🔄 Auto Commit 機制（Non-Negotiable）

**每次完成任務後，MUST 執行 git commit。**

### Commit 訊息規範

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

### Commit Type

| Type | 用途 |
|------|------|
| `feat` | 新功能 |
| `fix` | 錯誤修復 |
| `docs` | 文件更新 |
| `refactor` | 重構（不改變功能） |
| `chore` | 雜項（設定、依賴等） |

### 語言要求

- Commit 訊息 MUST 使用繁體中文（zh-TW）
- 技術術語可保留英文（如 CDP、ARIA、Playwright）

---

## ⚠️ 禁止事項

### 安全

- ❌ 硬編碼任何敏感資訊（Token、密碼）
- ❌ 提交 `.env` 或含敏感資訊的設定檔
- ❌ 記錄使用者密碼到日誌

### 程式碼

- ❌ 呼叫 `browser.close()`（CDP 連接不可關閉使用者的 Chrome）
- ❌ 使用 `pages[0]` 或 `pages[pages.length - 1]` 未經過濾（必須過濾 Chrome 內部頁面）
- ❌ 直接 `spawn('npx', ...)` 在 Windows（必須用 `cmd.exe /d /s /c`）
- ❌ 忽略錯誤處理（所有 catch 必須記錄到 log 和 metadata.errors）
- ❌ 使用固定等待時間（應使用 `waitForTimeout` 或事件驅動等待）

### 架構

- ❌ 假設有外部網路可用
- ❌ 刪除現有功能程式碼（除非明確要求）
- ❌ 混用不同時區（統一使用 Asia/Taipei）

---

## ✅ 最佳實踐

### 頁面選擇策略

```typescript
// ✅ 過濾 Chrome 內部頁面，只選擇使用者可見頁面
const userPages = allPages.filter(p => isUserPage(p));
const activePage = userPages[userPages.length - 1];

// ❌ 直接選擇（可能選到 chrome:// 內部頁面）
const page = pages[pages.length - 1];
```

### Windows 子程序啟動

```typescript
// ✅ Windows 安全啟動
const cmd = process.env.ComSpec || 'cmd.exe';
spawn(cmd, ['/d', '/s', '/c', commandLine], {
  windowsVerbatimArguments: true,
});

// ❌ 直接 spawn（Node.js v24+ 會 EINVAL）
spawn('npx', args);
```

### 錯誤處理

### 隱藏下拉選單處理（最佳實務建議）

- 若目標連結為隱藏在下拉選單中，Prefer 使用「Robust Reveal Strategy」：
  1. 嘗試找到父項 locator（link/text/nav 等多種候選）
  2. 原生 pm.hover() 並補發 pointerenter/pointerover/mouseenter/mouseover
  3. focus 父項並使用 page.mouse.move 模擬滑鼠路徑以觸發 JS/CSS
  4. 等待子選單的目標 locator 可見，重試數次後若仍失敗則 fallback 至已知列表頁（例如 Post2/list.do）
- 所有嘗試應有詳細的日誌與關鍵截圖，方便 SRE/AI 進行後續根因分析

### 錯誤處理

```typescript
// ✅ 結構化錯誤處理
try {
  await operation();
} catch (error) {
  const detail = formatError(error);
  logError(`操作失敗: ${detail.message}`, error);
  this.metadata.errors.push({
    page: targetName,
    error: detail.message,
    timestamp: getTaipeiISO(),
    stack: detail.stack,
  });
}
```

---

## 📋 文件同步規則（Non-Negotiable）

**所有文件 MUST 與程式碼現況保持一致。**

| 文件 | 路徑 | 更新時機 |
|------|------|---------|
| 功能規格 | `docs/spec.md` | 功能新增/刪除/變更 |
| 使用指南 | `docs/使用指南.md` | 操作流程/指令變更 |
| README | `README.md` | 專案結構/快速開始變更 |
| Copilot 準則 | `.github/copilot-instructions.md` | 開發規範變更 |

---

## 📝 變更記錄

| 版本 | 日期 | 變更內容 |
|------|------|------|
| 1.0.0 | 2026-02-09 | 初始版本：角色定義、SDD 開發法、專案定位、技術架構、第一性原則、commit 規範、禁止事項、最佳實踐 |
