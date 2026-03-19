# RPA-Cowork：內網自動化協作工具

> 先在內網蒐集頁面素材，再交給 AI 補完腳本，最後回到內網執行任務。

`README.md` 只負責**專案介紹與快速導覽**。
如果你要照步驟操作、建立腳本、跟 AI 協作或查 FAQ，請直接看 [`docs/使用指南.md`](docs/使用指南.md)。

- **第一次認識專案**：看 `README.md`
- **實際操作 / 跟 AI 合作**：看 [`docs/使用指南.md`](docs/使用指南.md)
- **維護與規格細節**：看 [`docs/spec.md`](docs/spec.md)

---

## 這個專案解決什麼問題

很多內部網站只能在公司內網使用，但真正要整理自動化腳本、分析流程或請 AI 協助時，往往是在外部環境進行。

這個專案的目標，就是把這件事拆成一條清楚主線：

1. **在內網蒐集素材**：保留頁面結構、截圖、錄製檔
2. **在外部與 AI 協作**：讓 AI 依照骨架檔與同一次任務附件補完腳本
3. **回到內網執行任務**：統一用 `run-task.ps1` 執行 `src\` 裡的腳本

> 它不是單純的「錄製工具」，而是一個**離線優先的內網自動化協作流程**。

---

## 工作流程總覽

```text
[1. 準備離線包]
scripts\prepare-offline-bundle.ps1

          ↓

[2. 內網蒐集素材]
install.ps1
launch-edge.ps1
collect.ps1 --browser edge

          ↓

[3. 與 AI 協作補完腳本]
new-task.ps1
依 docs/使用指南.md 提供骨架檔與附件給 AI

          ↓

[4. 回內網執行任務]
run-task.ps1 src\你的腳本.ts
```

---

## 快速開始

### 我是準備離線包的人（技術準備者）

```powershell
.\scripts\prepare-offline-bundle.ps1
```

打包完成後，請把**整個產出的資料夾**交給內網使用者，不要只交幾個 `.ps1` 檔。

離線包至少應包含：

- `runtime\node\`
- `node_modules\`
- `.playwright-browsers\`
- `.env.example`
- `install.ps1`
- `launch-edge.ps1`
- `collect.ps1`
- `new-task.ps1`
- `run-task.ps1`

> ⚠️ **修改原始碼後必須重新打包。** 如果你更動了 `src/lib/`、`package.json`、Playwright 版本或任何影響執行期的檔案，請重跑 `prepare-offline-bundle.ps1` 再交付。舊離線包不會自動反映這些變更。

### 我是內網使用者

第一次使用，先照這 4 步：

```powershell
.\install.ps1          # 驗證離線包完整性（不會連網下載任何東西）
.\launch-edge.ps1
.\collect.ps1 --browser edge
.\new-task.ps1
```

> 🛑 **如果 `install.ps1` 出現紅字錯誤**，代表離線包有缺件。請**立即停止**，把畫面截圖或 `logs\` 資料夾傳給技術準備者處理。**不要自行安裝 Node.js 或 npm**——離線包本身應該已經包含所有執行期依賴。

然後把：

- `new-task.ps1` 建好的 `src\任務骨架.ts`
- 同一次任務的 `aria-snapshots\`、`screenshots\`、`recordings\`、`metadata.json`

帶到可使用 AI 的環境，照 [`docs/使用指南.md`](docs/使用指南.md) 的方式交給 AI。

最後回到內網執行：

```powershell
.\run-task.ps1 src\你的腳本.ts
```

> 如果現場仍指定 Chrome，請把 `launch-edge.ps1` 改成 `launch-chrome.ps1`，並把 `collect.ps1 --browser edge` 改成 `collect.ps1`。

### 要跟 AI 合作？

先用 `new-task.ps1` 建立 `src\任務骨架.ts`，
再把**骨架檔 + 同一次 materials 任務資料夾**交給 AI。

一般使用者不用自己拼 Prompt。
請直接照 [`docs/使用指南.md`](docs/使用指南.md) 的「請 AI 幫你做腳本」操作。

---

## 核心能力

### 1. ARIA 快照蒐集
把頁面的語意結構存下來，讓 AI 更容易理解按鈕、欄位、表格與互動元素。

### 2. 截圖蒐集
把頁面當下的畫面保存下來，方便 AI 與人員一起比對狀態。

### 3. 錄製操作流程
錄下使用者實際操作過程，讓 AI 更容易重建流程。

### 4. 單一任務骨架與統一執行入口
`new-task.ps1` 負責建立骨架，`run-task.ps1` 負責執行任務，所有 AI 生成腳本統一放在 `src\`。

### 5. 共用基礎模組
`src/lib/` 提供 env、logger、browser、security、task bootstrap，降低 AI 生成腳本發散的機率。

### 6. 離線優先
正式使用情境預設依賴完整離線包，不要求一般使用者在現場自行補安裝。

---

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

其中：

- `aria-snapshots\`：AI 分析頁面結構的核心素材
- `screenshots\`：補充畫面狀態
- `recordings\`：補充操作流程
- `metadata.json`：補充這次任務的背景資訊

---

## 文件導覽

| 文件 | 內容 | 適合誰 |
|------|------|--------|
| `README.md` | 專案介紹、流程總覽、快速導覽 | 第一次接觸專案的人 |
| [`docs/使用指南.md`](docs/使用指南.md) | 唯一正式使用指南：蒐集素材、AI 協作 Prompt、執行任務、FAQ | 一般使用者 |
| [`docs/spec.md`](docs/spec.md) | 功能規格與設計細節 | 維護者、開發者 |
| [`Fleet_Prompt.md`](Fleet_Prompt.md) | repo-local fleet orchestration prompt | 需要規劃多代理工作的維護者 |

---

## 已知限制與注意事項

- **機敏資料不出內網**：不要把 `.env`、帳號、密碼、token 帶出內網環境
- **離線包缺件 → 找準備者**：若 `install.ps1` 報告缺少 `runtime\node\`、`node_modules\` 或 `.playwright-browsers\`，請回到技術準備者重新打包，不要在現場自行補裝
- **Edge 需預先安裝**：離線包以專案內建的 Playwright Chromium runtime 為主；如需使用 Edge，目標電腦必須已安裝 Microsoft Edge
- **SSO / 彈窗 / 跳轉頁面**：內部系統常見 SSO 登入重導向或彈出新視窗，這是第一次執行腳本時最常見的失敗原因。遇到時請依 [`docs/使用指南.md`](docs/使用指南.md) 的說明讓 AI 調整腳本
- **動態或特殊權限頁面**：高度動態內容仍可能需要人工補充說明，讓 AI 正確理解頁面結構

---

## 授權與使用

`package.json` 目前標示為 `MIT`。
若在組織內部情境使用，仍請遵守你所在單位的資料處理與資安規範。
