# RPA-Cowork：內部網路自動化協作工具

> 離線優先的 RPA 工作流平台：在內網蒐集頁面素材、與 AI 協作生成自動化腳本、再透過統一入口執行任務。讓非技術人員也能打造自己的自動化腳本。

這份 `README.md` 的角色是**專案介紹與快速導覽**。
如果你要的是一步一步照著做的操作手冊、AI 協作方式、任務執行步驟與常見問題，請直接看 [`docs/使用指南.md`](docs/使用指南.md)。

## 這個專案解決什麼問題

很多內部網站只能在公司內網使用，但真正要整理自動化腳本、分析流程或請 AI 協助時，往往是在外部環境進行。

這會出現一個很實際的落差：

- 內網裡有真實頁面、登入狀態與操作流程
- 外部環境有 AI、分析工具與整理能力
- 但兩邊通常不能直接互通

這個專案提供一套完整的 RPA 工作流，形成這條工作鏈：

1. **蒐集素材**：在內網蒐集頁面結構、截圖與操作流程
2. **AI 協作**：把素材帶到外部環境，讓 AI 生成自動化腳本
3. **執行任務**：把腳本帶回內網，一鍵執行自動化任務

> 從「素材蒐集工具」升級為**完整的離線優先 RPA 工作流平台**。

## 三層架構

```
[Layer 1] 素材蒐集          [Layer 2] AI 協作            [Layer 3] 任務執行
─────────────────          ─────────────────            ─────────────────
launch-chrome.ps1    →     Claude / ChatGPT       →     run-task.ps1
collect.ps1                分析 ARIA 快照                src\任務名稱.ts
ARIA 快照、截圖、錄製         生成 .ts 腳本
```

## 完整工作流

```text
有網路的準備電腦                           內網使用電腦                         外部 AI 環境
┌──────────────────────┐              ┌──────────────────────┐              ┌──────────────────────┐
│ prepare-offline-     │              │ 1. install.ps1       │              │ 1. 讀取 ARIA 快照      │
│   bundle.ps1         │  ────────▶   │ 2. 啟動瀏覽器入口      │  ────────▶   │ 2. AI 分析頁面結構      │
│ 打包完整工具包         │              │ 3. collect.ps1       │              │ 3. 生成任務腳本         │
└──────────────────────┘              │ 4. run-task.ps1      │  ◀────────   │                      │
                                      └──────────────────────┘              └──────────────────────┘
```

## 角色分工

### 準備者（有網路的電腦）

準備者在可上網的 Windows 電腦上，將原始專案整理成可直接帶進內網的完整工具包：

```powershell
.\scripts\prepare-offline-bundle.ps1
```

這份工具包會包含內網使用需要的關鍵內容，例如：

- `runtime\node\`：專案內建執行 runtime
- `node_modules\`：離線執行所需依賴
- `.playwright-browsers\`：Playwright Chromium runtime（離線包必備）
- `.env.example`：環境變數範例檔（需要時複製成 `.env` 再填值）
- `install.ps1`、`launch-chrome.ps1`、`launch-edge.ps1`、`collect.ps1`、`new-task.ps1`、`run-task.ps1`：使用者入口

打包時應 **保留 `.env.example`，但不得把已填過值的 `.env` 一起帶進離線包**。如果內網電腦跳出 `node` / `npm` / `npx` 找不到，優先視為工具包不完整，不要在現場手動補 PATH。

### 內網使用者（拿到完整工具包的人）

**步驟一：蒐集素材**

```powershell
.\install.ps1
.\launch-edge.ps1
.\collect.ps1 --browser edge
```

**步驟二：與 AI 協作**（帶出到有 AI 的環境）

把 `materials\` 下同一次任務的 ARIA 快照、截圖、錄製腳本，再加上用 `new-task.ps1` 建好的 `src\任務骨架.ts` 提供給 AI。一般使用者實際要貼給 AI 的生成 / 除錯 Prompt，統一看 [`docs/使用指南.md`](docs/使用指南.md)。

**步驟三：執行任務腳本**

```powershell
.\run-task.ps1 src\你的腳本.ts
```

其中：

- `install.ps1`：檢查離線工具包是否完整，**不是上網安裝器**
- `launch-chrome.ps1`：啟動可供工具連接的 Chrome Debug 視窗
- `launch-edge.ps1`：Edge 替代入口
- `collect.ps1`：開始蒐集素材
- `run-task.ps1`：通用任務執行入口，執行 `src\` 下的任何 `.ts` 腳本

## 核心能力

### 1. ARIA 快照蒐集（AI 分析首選）
把頁面的語意結構存下來，讓 AI 更容易理解按鈕、欄位、表格與互動元素。這是本專案最重要的素材之一。

### 2. 截圖蒐集
把頁面當下畫面保存成圖片，方便後續比對版面、狀態與操作前後差異。

### 3. Codegen 錄製
錄下使用者實際的操作過程，幫助後續重建流程或整理成 Playwright 腳本。

### 4. AI 協作腳本生成
透過標準化的材料包（ARIA 快照 + 錄製腳本 + 截圖），讓任何 AI 都能理解你的系統並生成任務腳本。

### 5. 通用任務執行入口
`run-task.ps1` 是統一的任務執行入口，可執行 `src\` 下任何 AI 生成或人工撰寫的任務腳本。

### 6. 共用基礎模組（src/lib/）
任務腳本開發的基礎設施，包含 env 載入、台北時區日誌、瀏覽器輔助、安全工具與 task bootstrap，確保 AI 生成腳本的一致風格。

### 7. 敏感資訊保護
錄製檔會經過清理流程，避免把密碼欄位等敏感資訊直接寫入產出檔案或版本庫。

## 快速開始

### 我是準備者

```powershell
.\scripts\prepare-offline-bundle.ps1
```

打包完成後，請把**整個產出的資料夾**交給內網使用者，不要只交幾個腳本檔。

### 我是內網使用者（蒐集素材）

```powershell
# 標準 Edge 流程
.\install.ps1
.\launch-edge.ps1
.\collect.ps1 --browser edge

# 若現場仍指定 Chrome
.\install.ps1
.\launch-chrome.ps1
.\collect.ps1
```

### 我要請 AI 幫我建立任務腳本

```powershell
.\new-task.ps1
```

先建立 `src\` 任務骨架，再把同一次 `materials\` 任務資料夾和骨架腳本交給 AI。
Prompt 單一來源請看 [`docs/使用指南.md`](docs/使用指南.md)。
AI 回傳後，直接覆蓋同一個 `src\腳本名稱.ts`，再用 `run-task.ps1` 執行。

### 我要執行自動化任務

```powershell
.\run-task.ps1 src\你的腳本.ts
```

### `collect.ps1` 常見模式

```powershell
.\collect.ps1
.\collect.ps1 --snapshot
.\collect.ps1 --auto
.\collect.ps1 --record 登入流程
.\collect.ps1 --config .\collect-materials-config.json
```

## 任務腳本放置位置

AI 生成或人工撰寫的任務腳本，統一放在 `src\` 目錄：

```
src\
├─ qiz-批次簽核.ts         ← QIZ 電子表單批次簽核
├─ eip-公文簽核.ts         ← EIP 財稅平台公文簽核
└─ vst-資料匯出.ts         ← VST 系統資料匯出
```

## 產出內容 / 結果結構

每次蒐集完成後，通常會在 `materials/` 下看到一個新的任務資料夾：

```text
materials\
└─ YYYYMMDDhhmmss_任務名稱\
   ├─ aria-snapshots\      ← 🔑 AI 分析首選素材
   ├─ screenshots\
   ├─ recordings\
   ├─ metadata.json
   └─ summary-report.md
```

## 技術架構 / 技術棧摘要

### 主要技術

- **Chromium CDP（Debug Protocol）**：連接已登入的 Chrome / Edge 工作階段
- **Playwright ^1.52.0**：負責快照、截圖、錄製與任務執行
- **TypeScript ^5.7.3**：主要程式語言（ESM 模組）
- **tsx ^4.19.0**：TypeScript 執行器（不需要 tsconfig）
- **Node.js >=20.0.0**：執行環境要求
- **PowerShell 7.x**：Windows 主要操作入口

### 架構重點

- **離線優先**：正式使用情境依賴預先打包，不假設可連外網
- **ARIA-first**：優先蒐集頁面結構，方便 AI 後續分析
- **共用基礎模組**：`src/lib/` 提供一致的 env、logger、browser、security、task helper
- **任務資料夾隔離**：每次執行獨立保存成果，方便交接與回溯
- **不強制關閉使用者瀏覽器**：降低對使用者既有工作狀態的干擾
- **內網情境導向**：針對已登入、受限網路與人工配合流程設計

## 安全與限制

### 安全考量

- 不要把帳號、密碼、token、`.env` 等敏感資訊一起帶出內網
- 帶出截圖、HTML 或錄製檔前，仍應人工確認是否含有敏感畫面
- 若要交給 AI 或外部維護者，建議以**同一次任務資料夾**為單位整理
- 版本庫與錄製檔應避免保存明文敏感資訊

### 已知限制

- 需要先啟動可連接的瀏覽器 Debug 視窗（標準流程是 Chrome；若使用 Edge，請改用 `launch-edge.ps1`）
- 主要目標環境是 **Windows 11 + PowerShell 7.x**
- 離線使用依賴事先準備好的完整工具包
- 若要使用 Edge，內網電腦必須已安裝 Microsoft Edge；離線包仍以專案內建 Playwright Chromium runtime 為主
- 遇到高度動態或特殊權限頁面時，仍可能需要人工補充說明與判讀

## 文件導覽

| 文件 | 角色 | 適合對象 |
|------|------|---------|
| `README.md` | 專案介紹與快速導覽 | 第一次認識此專案的人 |
| [`docs/使用指南.md`](docs/使用指南.md) | 一般使用者唯一正式指南（SOP、AI 協作、任務執行、FAQ） | 內網操作使用者、要跟 AI 協作的人 |
| [`docs/spec.md`](docs/spec.md) | 功能規格與設計 | 維護者、開發者 |

## 授權與使用

`package.json` 目前標示為 `MIT`。
若在組織內部情境使用，仍請遵守你所在單位的資料處理與資安規範。
