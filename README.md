# 內部網路網頁素材離線蒐集工具

> 一個為內部網路場景設計的離線優先工具：連接已登入的 Chromium 系列瀏覽器（預設 Chrome，也支援 Microsoft Edge），蒐集頁面結構、畫面與操作流程素材，方便後續交給 AI 分析、整理與生成自動化腳本。

這份 `README.md` 的角色是**專案介紹與快速導覽**。
如果你要的是一步一步照著做的操作手冊，請直接看 [`docs/使用指南.md`](docs/使用指南.md)。
若你們單位固定使用 **Microsoft Edge**，可直接看獨立的 [`docs/使用指南-Edge.md`](docs/使用指南-Edge.md)。

## 這個專案解決什麼問題

很多內部網站只能在公司內網使用，但真正要整理自動化腳本、分析流程或請 AI 協助時，往往是在外部環境進行。

這會出現一個很實際的落差：

- 內網裡有真實頁面、登入狀態與操作流程
- 外部環境有 AI、分析工具與整理能力
- 但兩邊通常不能直接互通

這個專案的任務，就是把「內網裡的人實際看到的頁面與操作線索」整理成一份可攜帶的素材包，形成這條工作鏈：

1. 在內網蒐集頁面素材
2. 把素材帶到外部環境分析
3. 讓 AI 協助整理成自動化腳本
4. 再把腳本帶回內網驗證與執行

> 它的重點是**蒐集高品質素材**，不是直接取代後續的腳本設計與驗證工作。

## 專案如何運作

```text
有網路的準備電腦                           內網使用電腦                         外部 AI 環境
┌──────────────────────┐              ┌──────────────────────┐              ┌──────────────────────┐
│ 1. prepare bundle    │              │ 1. install.ps1       │              │ 1. 讀取蒐集成果        │
│ 2. 複製整個資料夾     │  ────────▶   │ 2. 啟動瀏覽器入口      │  ────────▶   │ 2. 分析頁面與流程      │
│                      │              │ 3. collect.ps1       │              │ 3. 整理自動化腳本      │
└──────────────────────┘              └──────────────────────┘              └──────────────────────┘
```

整體可分成兩個主要角色：

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
- `install.ps1`、`launch-chrome.ps1`、`launch-edge.ps1`、`collect.ps1`：一般使用者入口

打包時應 **保留 `.env.example`，但不得把已填過值的 `.env` 一起帶進離線包**。如果內網電腦跳出 `node` / `npm` / `npx` 找不到，優先視為工具包不完整，不要在現場手動補 PATH。

### 內網使用者（拿到完整工具包的人）

內網使用者拿到完整工具包後，請先走 **標準 Chrome 流程**：

```powershell
.\install.ps1
.\launch-chrome.ps1
.\collect.ps1
```

如果現場指定使用 **Microsoft Edge**，改用這組指令：

```powershell
.\install.ps1
.\launch-edge.ps1
.\collect.ps1 --browser edge
```

其中：

- `install.ps1`：檢查離線工具包是否完整，**不是上網安裝器**
- `launch-chrome.ps1`：標準啟動入口，啟動可供工具連接的 Chrome Debug 視窗
- `launch-edge.ps1`：Edge 替代入口，啟動可供工具連接的 Microsoft Edge Debug 視窗
- `collect.ps1`：開始蒐集素材；若前一步使用 Edge，請加上 `--browser edge`

## 核心能力

### 1. ARIA 快照蒐集
把頁面的語意結構存下來，讓 AI 更容易理解按鈕、欄位、表格與互動元素。這是本專案最重要的核心素材之一。

### 2. 截圖蒐集
把頁面當下畫面保存成圖片，方便後續比對版面、狀態與操作前後差異。

### 3. Codegen 錄製
錄下使用者實際的操作過程，幫助後續重建流程或整理成 Playwright 腳本。

### 4. 可選 HTML 原始碼輸出
在需要時保留 HTML 原始碼，補足畫面與語意結構之外的上下文資訊。

### 5. 敏感資訊保護
錄製檔會經過清理流程，避免把密碼欄位等敏感資訊直接寫入產出檔案或版本庫。

### 6. 摘要報告與問題紀錄
每次任務都會留下 `metadata.json`、`summary-report.md` 與日誌，方便交接、除錯與追蹤。

## 快速開始

如果你只想先知道最短路徑，可以直接看這裡。

### 我是準備者

```powershell
.\scripts\prepare-offline-bundle.ps1
```

打包完成後，請把**整個產出的資料夾**交給內網使用者，不要只交幾個腳本檔。

### 我是內網使用者

```powershell
# 標準 Chrome 流程
.\install.ps1
.\launch-chrome.ps1
.\collect.ps1

# 若現場指定使用 Edge
.\install.ps1
.\launch-edge.ps1
.\collect.ps1 --browser edge
```

### `collect.ps1` 常見模式

```powershell
.\collect.ps1
.\collect.ps1 --snapshot
.\collect.ps1 --auto
.\collect.ps1 --record 登入流程
.\collect.ps1 --config .\collect-materials-config.json
```

- `.\collect.ps1`：互動模式，適合大多數使用情境
- `--snapshot`：快速擷取目前頁面
- `--auto`：依設定檔自動執行蒐集
- `--record <name>`：直接進入錄製模式
- `--config <path>`：指定設定檔執行
- 若使用 Edge，請改用 `--browser edge`，或在設定檔中把 `"browser"` 設為 `"edge"`

> 更完整的白話 SOP、角色分流與問題排除，請看 [`docs/使用指南.md`](docs/使用指南.md)。

## 產出內容 / 結果結構

每次蒐集完成後，通常會在 `materials/` 下看到一個新的任務資料夾：

```text
materials\
└─ YYYYMMDDhhmmss_任務名稱\
   ├─ aria-snapshots\
   ├─ screenshots\
   ├─ recordings\
   ├─ metadata.json
   └─ summary-report.md
```

常見內容用途如下：

- `aria-snapshots\`：頁面語意結構快照
- `screenshots\`：畫面截圖
- `recordings\`：互動錄製檔
- `metadata.json`：本次任務的結構化紀錄
- `summary-report.md`：本次任務的摘要整理

如果執行中發生問題，通常也可以到 `logs\` 查看對應日誌。

## 技術架構 / 技術棧摘要

本專案的核心做法，是透過 **Chromium branded browser 的 CDP（Debug Protocol）** 連接到已登入的瀏覽器（Chrome / Edge），再由 Playwright 負責蒐集頁面素材。

### 主要技術

- **Chromium CDP（Debug Protocol）**：連接已登入的 Chrome / Edge 工作階段
- **Playwright ^1.52.0**：負責快照、截圖與錄製能力
- **TypeScript ^5.7.3**：主要程式語言
- **Node.js >=20.0.0**：執行環境要求
- **PowerShell 7.x**：Windows 主要操作入口

### 架構重點

- **離線優先**：正式使用情境依賴預先打包，不假設可連外網
- **ARIA-first**：優先蒐集頁面結構，方便 AI 後續分析
- **任務資料夾隔離**：每次執行獨立保存成果，方便交接與回溯
- **不強制關閉使用者瀏覽器**：降低對使用者既有工作狀態的干擾
- **Edge 視為系統前置需求**：若使用 Edge，要求內網電腦已安裝 Microsoft Edge；離線包不內嵌 branded Edge 本體
- **內網情境導向**：針對已登入、受限網路與人工配合流程設計

## 安全與限制

### 安全考量

- 不要把帳號、密碼、token、`.env` 等敏感資訊一起帶出內網
- 帶出截圖、HTML 或錄製檔前，仍應人工確認是否含有敏感畫面
- 若要交給 AI 或外部維護者，建議以**同一次任務資料夾**為單位整理
- 版本庫與錄製檔應避免保存明文敏感資訊

### 已知限制

- 這是一個**素材蒐集工具**，不是最終腳本生成器
- 需要先啟動可連接的瀏覽器 Debug 視窗（標準流程是 Chrome；若使用 Edge，請改用 `launch-edge.ps1` 並在蒐集時加上 `--browser edge`）
- 主要目標環境是 **Windows 11 + PowerShell 7.x**
- 離線使用依賴事先準備好的完整工具包
- 若要使用 Edge，內網電腦必須已安裝 Microsoft Edge；離線包仍以專案內建 Playwright Chromium runtime 為主
- 遇到高度動態或特殊權限頁面時，仍可能需要人工補充說明與判讀

## 文件導覽

### `README.md`
適合第一次認識這個專案的人。重點是回答：這是什麼工具、它解決什麼問題、整體怎麼運作、下一步該看哪份文件。

### [`docs/使用指南.md`](docs/使用指南.md)
給實際操作的人使用，內容偏向白話 SOP、角色分流、步驟說明與問題排除。

### [`docs/spec.md`](docs/spec.md)
給維護者、開發者或需要追蹤功能邊界的人，內容偏向功能規格、設計原則與技術決策。

## 授權與使用

`package.json` 目前標示為 `MIT`。
若在組織內部情境使用，仍請遵守你所在單位的資料處理與資安規範。
