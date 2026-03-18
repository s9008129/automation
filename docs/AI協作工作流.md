# AI 協作工作流指南

> **適用對象**：希望透過 AI 生成自動化腳本的非技術使用者
> **前置條件**：已完成素材蒐集（`collect.ps1`）

---

## 工作流總覽

```
① 蒐集素材           ② 準備 AI 材料       ③ AI 協作生成        ④ 執行腳本
─────────────       ─────────────       ─────────────       ─────────────
launch-edge.ps1     整理材料包           貼給 AI             run-task.ps1
collect.ps1    →    按本文說明     →     描述任務需求    →    src\任務名.ts
產出 materials\     參考 prompt.md       AI 生成 .ts 腳本
```

---

## 第一步：蒐集素材

請先確認已完成素材蒐集，並在 `materials\` 目錄下看到類似這樣的資料夾：

```
materials\
└─ 20260318111335_我的任務\
   ├─ aria-snapshots\    ← 🔑 最重要：頁面語意結構
   ├─ screenshots\       ← 視覺參考截圖
   ├─ recordings\        ← 操作錄製腳本
   ├─ metadata.json      ← 環境資訊
   └─ summary-report.md  ← 本次蒐集摘要
```

如尚未蒐集，請先參考 [使用指南.md](使用指南.md) 完成蒐集步驟。

---

## 第二步：準備 AI 材料

將下列檔案的**內容**提供給 AI（複製貼上文字，或附加檔案）：

### 必要材料（依重要性排序）

| 材料 | 來源 | 說明 |
|------|------|------|
| **ARIA 快照** | `aria-snapshots\*.txt` | 🔑 最重要！讓 AI 看懂頁面結構 |
| **錄製腳本** | `recordings\*.ts` | 使用者操作流程（含已知 bug，需 AI 修正）|
| **截圖** | `screenshots\*.png` | 視覺參考（複雜版面時特別有用） |
| **metadata.json** | `metadata.json` | 環境資訊（URL、瀏覽器版本等） |

### 可選材料

| 材料 | 來源 | 何時需要 |
|------|------|---------|
| **HTML 原始碼** | `html\*.html` | 版面特別複雜或 ARIA 快照不夠詳細時 |
| **摘要報告** | `summary-report.md` | 提供背景說明時 |

---

## 第三步：AI 協作說明

### 推薦的 AI 工具

- **Claude**（claude.ai）：最理解 Playwright 的 AI
- **GitHub Copilot**：程式碼生成能力強
- **ChatGPT（GPT-4+）**：也可使用

### 基本 Prompt 結構

將下方 prompt 貼給 AI，並附上素材檔案內容：

```
我需要一支 TypeScript 自動化腳本，協助我完成以下任務：

[任務描述]
例如：自動批次處理 QIZ 電子表單系統中，符合條件的待簽核案件

[相關限制]
例如：需要處理登入流程、有多頁表格需全部遍歷

以下是頁面的 ARIA 快照（頁面語意結構）：
[貼上 aria-snapshots/*.txt 的內容]

以下是我的操作錄製（參考用，可能有 bug 需修正）：
[貼上 recordings/*.ts 的內容]

請嚴格遵守以下規範生成腳本：
1. TypeScript ESM 模組（import/export，禁止 require）
2. 使用 tsx 執行（不是 ts-node）
3. 放在 src\ 目錄，命名格式：src\{系統代碼}-{任務名稱}.ts
4. 讀取 .env 使用自製 loadDotEnv()（不引入 dotenv 套件）
5. 瀏覽器使用 channel: 'msedge'，headless: false
6. 密碼等敏感資訊從 .env 讀取，不硬編碼
7. CAS ticket 透過 waitForURL 等待（不硬編碼 ticket）
8. 面向使用者的訊息使用正體中文
9. 有分頁時用 while 迴圈完整處理所有頁面
10. 從 src/lib/ 匯入共用 helper：
    - import { loadDotEnv } from './lib/env.js'
    - import { log, logError, initLogger, printHeader } from './lib/logger.js'
    - import { launchTaskBrowser, closeTaskBrowser } from './lib/browser.js'
```

### 更詳細的 Prompt 範本

詳細的 AI 協作 Prompt 模板請參考 [`prompt.md`](../prompt.md)。

---

## 第四步：接收並存放腳本

1. AI 生成腳本後，確認腳本符合規範
2. 複製腳本內容，儲存到 `src\` 目錄下
3. 命名規範：`src\{系統代碼}-{任務名稱}.ts`

```
src\
├─ qiz-批次簽核.ts     ← QIZ 電子表單系統的批次簽核
├─ eip-公文簽核.ts     ← EIP 財稅雲端平台的公文簽核
└─ vst-資料匯出.ts     ← VST 系統的資料匯出
```

---

## 第五步：設定 .env 環境變數

如果腳本需要帳號密碼等敏感資訊，請設定 `.env` 檔案：

```powershell
# 複製範本
Copy-Item .env.example .env

# 用文字編輯器填入實際值
notepad .env
```

`.env` 填寫範例：

```
# 系統帳號（依實際系統填入）
USERNAME=your_username
PASSWORD=your_password

# 目標系統 URL（若需要自訂）
EIP_URL=https://eip-lts.voa.fia.gov.tw
```

> ⚠️ `.env` 含有敏感資訊，**絕對不要傳送給他人或放入版本庫**。

---

## 第六步：執行任務腳本

```powershell
.\run-task.ps1 src\你的腳本.ts
```

### 常見執行方式

```powershell
# 基本執行
.\run-task.ps1 src\qiz-批次簽核.ts

# 帶參數執行（參數原封不動傳給腳本）
.\run-task.ps1 src\eip-公文簽核.ts --dry-run
.\run-task.ps1 src\vst-資料匯出.ts --output D:\exports
```

---

## 常見問題

### AI 生成的腳本出現錯誤怎麼辦？

1. 把錯誤訊息複製給 AI
2. 附上 `logs\` 目錄中最新的日誌檔案
3. 說明卡在哪個步驟

### 腳本能執行但結果不對？

1. 用 `collect.ps1` 再蒐集一次最新的 ARIA 快照
2. 把更新的快照和截圖提供給 AI
3. 說明期望的結果與實際結果的差異

### 如何更新已有的腳本？

直接把 `src\` 下的腳本檔案貼給 AI，說明需要修改的部分即可。

---

> **下一步**：了解腳本的技術規範請看 [任務腳本開發規範.md](任務腳本開發規範.md)；
> 執行任務的詳細說明請看 [執行任務指南.md](執行任務指南.md)。
