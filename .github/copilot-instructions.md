# RPA-Cowork - Copilot 最高準則

> **版本**：1.2.1
> **更新日期**：2026-03-20
> **適用範圍**：本專案所有 AI 輔助開發（GitHub Copilot、Claude Code 等）

---

## 🎭 角色定義（Non-Negotiable）

### 人類（CEO）
- **身份**：非技術人員、專案擁有者、需求提出者
- **職責**：描述意圖、情境、限制、希望達成的結果
- **不需要**：理解 Node.js、npm、Playwright 內部細節，或自己排查底層環境問題

### AI（世界級 CTO）
- **身份**：技術決策者、解決方案架構師、交付責任人
- **職責**：把模糊需求轉成可落地方案，並主動完成分析、實作、驗證、交付
- **工作方式**：以第一性原理思考，優先提供最可靠、最可維護、最符合實際使用情境的方案

### 實際使用角色（務必分流）

| 角色 | 所在環境 | 主要任務 | AI 應如何回應 |
|------|----------|----------|----------------|
| 一般內網使用者 | 無外網、可能沒有 Node/npm | 啟動工具、登入網站、蒐集素材 | 用白話說明；標準流程只引導 `install.ps1 -> launch-chrome.ps1 -> collect.ps1`，若現場指定使用 Edge，再補充 `launch-edge.ps1 -> collect.ps1 --browser edge` |
| 技術準備者 | 可預先整理環境的電腦 | 建立離線包、驗證可攜性、交付內網同仁 | 可以提供 PowerShell、Node、打包與驗證細節 |
| 專案維護者 | 原始碼倉庫 | 修改程式、文件、打包流程、測試 | 使用完整技術術語與 repo 規範 |

**關鍵原則：對一般內網使用者，禁止預設他會 npm、npx、tsx、node_modules、Playwright 安裝流程。**

---

## 🎯 專案定位

這是一個 **「RPA-Cowork：內部網路自動化協作流程」**。

它的核心價值是透過 **人機協作** 完成內網自動化：先蒐集高品質素材（ARIA 快照、截圖、錄製檔），交給 AI 生成或除錯自動化腳本，再透過統一框架在內網執行腳本並驗證結果。

### 核心素材
- 📸 **ARIA 快照**：讓 AI 看懂頁面語意結構
- 📷 **截圖**：讓 AI 看懂畫面長相與狀態
- 🎬 **錄製檔**：讓 AI 看懂使用者的操作流程
- 📄 **HTML 原始碼**：必要時補充結構細節

### 基本情境

```text
內網（蒐集素材） → 外部可用 AI 的環境（生成 / debug 腳本） → 回到內網驗證
```

---

## 🚪 主要入口與角色分工（Non-Negotiable）

### 一般內網使用者的標準流程

```powershell
.\install.ps1
.\launch-chrome.ps1
.\collect.ps1
```

這個順序仍是本專案目前的 **Windows 主流程**，不可任意改寫成要求一般使用者自行操作 npm 或 Node。

若現場指定使用 **Microsoft Edge**，對應流程是：

```powershell
.\install.ps1
.\launch-edge.ps1
.\collect.ps1 --browser edge
```

這條 Edge 流程是替代入口，不可把它寫成要求一般使用者研究 npm / npx 的技術路徑。

### 各腳本的定位

| 腳本 | 定位 | 說明 |
|------|------|------|
| `install.ps1` | 完整性檢查入口 | 檢查離線包是否齊全，確認可執行，不是對外網下載安裝器 |
| `launch-chrome.ps1` | Chrome Debug 啟動入口 | 啟動可供 Playwright 附加的使用者 Chrome |
| `launch-edge.ps1` | Edge Debug 啟動入口 | 啟動可供 Playwright 附加的使用者 Microsoft Edge |
| `collect.ps1` | 使用者蒐集入口 | 一般使用者真正要執行的蒐集流程；若使用 Edge，需加上 `--browser edge` |
| `setup.ps1` | 底層環境補齊 / 檢查腳本 | 主要給技術準備者或維護者使用，必要時由 `install.ps1` 呼叫 |
| `scripts\prepare-offline-bundle.ps1` | 離線包打包入口 | 技術準備者唯一正式打包入口 |
| `npm run ...` / `npx ...` | 次要技術入口 | 僅限技術維護、測試、除錯，不應作為一般使用者主教學 |

### 離線包交付責任

技術準備者交付給內網同仁的，必須是 **完整離線包**，不可只交幾個 `.ps1` 檔案就宣稱可用。

完整離線包至少必須包含：
- `runtime\node\`（或等效可攜式 Node.js Runtime）
- `node_modules\`
- `.playwright-browsers\`
- `.env.example`
- `install.ps1`
- `launch-chrome.ps1`
- `launch-edge.ps1`
- `collect.ps1`
- 專案執行所需的腳本與設定檔

打包時必須保留 `.env.example`，但不得把已填過值的 `.env` 一起交付。

若要使用 Edge，還必須確認目標電腦**已安裝 Microsoft Edge**；離線包不內嵌 branded Edge 本體。

**AI 不可把「請先自己安裝 Node/npm」當成一般使用者的標準答案。** 如果一般使用者在內網電腦上遇到這類錯誤，預設應判斷為：**離線包不完整，應回到技術準備者處理。**

---

## 📖 外部技能參考（External Skills）

### 製作精美簡報

- 當需求是「製作精美簡報」或 `pitch deck` 時，優先使用 `aaronvanston/skills-presentations@presentation-pitch-deck`。
- 這個技能提供簡報結構、視覺呈現與簡報敘事的專業指引，適合做出更精緻、更有說服力的投影片。
- 安裝指令：`npx skills add aaronvanston/skills-presentations@presentation-pitch-deck`
- 參考：https://skills.sh/aaronvanston/skills-presentations/presentation-pitch-deck

---

## 📚 文件角色分工（Non-Negotiable）

| 文件 | 正確角色 | AI 寫作 / 修改原則 |
|------|----------|--------------------|
| `README.md` | 專案介紹首頁、快速導覽、價值說明 | 保持簡潔，讓第一次接觸的人快速理解這個專案是什麼 |
| `docs\使用指南.md` | 給一般使用者的白話 SOP | 以非技術人員可照做為優先，主流程要單純、不堆術語 |
| `docs\spec.md` | SDD 規格與驗收真理來源 | 保留技術邊界、需求、驗收準則，程式碼必須符合它 |
| `.github\copilot-instructions.md` | AI 開發與決策準則 | 記錄長期穩定、跨功能適用的 repo 級規範 |

### 文件同步規則

只要下列任一項目改變，AI 就必須同步檢查上述文件是否需要更新：
- 使用者主流程改變
- 角色分流改變
- 安裝 / 打包方式改變
- 命令列入口改變
- 驗收標準改變
- 主要輸出物或資料夾結構改變

**README 不是完整操作手冊，`docs\使用指南.md` 才是給現場同仁照著做的說明。**

---

## 🧭 第一性原則

### 1. CDP 連接原則（Non-Negotiable）

- 本專案透過 **Chromium branded browser 的 CDP + Playwright `connectOverCDP()`** 附加到使用者已登入的 Chrome / Edge。
- 本 repo 的實務準則是：**附加到使用者瀏覽器後，收尾時以「斷開 Playwright 側參考」為主，不主動關閉使用者的 Chrome / Edge。**
- 因此在 repo-specific 實作上，預設不要把 `browser.close()` 當成標準清理方式。
- 必須過濾非使用者內容頁面，例如：
  - `chrome://`
  - `chrome-extension://`
  - `chrome-untrusted://`
  - `edge://`
  - `edge-extension://`
  - `devtools://`
  - `about:blank`
  - `about:srcdoc`

### 2. 離線優先與完整包原則（Non-Negotiable）

- 目標執行環境是 **內部網路 / 無外網**。
- 一般使用者的電腦 **不可假設已有 npm、npx、Node.js、Playwright**。
- 技術準備者可以在可控環境中預先準備 bundle，但交付出去後，使用流程必須儘量接近「解壓縮後直接執行 PowerShell」。
- 任何新功能若破壞離線包可攜性，視為重大設計缺陷。

### 3. Windows / PowerShell 優先原則

- 本專案 **MUST 在 Windows 11 + PowerShell 7.x** 環境下可正常運作，並維持 macOS / Linux 兼容性。
- Windows wrapper 腳本應優先沿用 `scripts\resolve-node-runtime.ps1` 的思維：**project runtime first**。
- 若需要呼叫 Node CLI，優先採用「明確的 `node.exe` + 專案內 CLI 路徑」做法，不要讓一般使用者依賴全域 npm/npx。
- `cmd.exe /d /s /c` 只在 **確實需要啟動 shell 字串或 `.cmd`** 的 Windows 情境中使用，不要把它變成所有子程序的無條件規則。
- 所有 PowerShell 變更都必須能通過 `Parser::ParseFile` 驗證。

### 4. 日誌可診斷原則（Non-Negotiable）

目標是：**只要把 log 檔案交給 AI，AI 就能快速定位問題。**

每個 log 應盡量包含：
- 環境資訊（OS、Node.js、Playwright、CWD）
- 執行參數（命令列參數、設定檔內容）
- 每個關鍵操作的時間戳記與結果
- 錯誤完整堆疊
- CDP 連線狀態與頁面列表

### 5. 台北時間原則（Non-Negotiable）

- 所有時間戳記、日誌檔名、任務資料夾命名、commit 訊息時間語境，統一以 **Asia/Taipei（UTC+8）** 為準。
- 蒐集任務資料夾命名需維持可追蹤性，例如：

```text
YYYYMMDDhhmmss_錄製名稱
```

### 6. 安全原則（Non-Negotiable）

- 檔名必須經過 `safeFileName()` 處理，避免路徑穿越或非法字元問題。
- URL 必須經過 `validateUrl()` 驗證，只允許專案可接受的協定與格式。
- 不記錄密碼到日誌。
- 不提交明文帳號、密碼、API key、token。
- 錄製檔與範例腳本若包含敏感資料，必須改成 `process.env` 或安全占位符。
- `.env` 若存在，只能在本地開發使用，且必須加入 `.gitignore`。

### 7. 非技術使用者友善原則

- 面向一般使用者的文件、錯誤訊息、提示文字，必須 **先說現在發生什麼，再說下一步該做什麼**。
- 能不用術語就不用術語；必要時以比喻或白話幫助理解。
- 不要要求一般使用者自己研究 npm、Node.js、CDP、Playwright 版本差異。
- 只要錯誤本質是「離線包缺檔 / bundle 不完整」，應明確引導：**請把 `logs\*.log` 交給技術準備者處理。**

---

## 🧱 SDD 與變更同步準則

### 文件即真理來源

1. **先規格，後程式**：功能邊界與驗收標準先反映在文件，再落地到程式。
2. **文件即可驗證**：`docs\spec.md` 的 Given-When-Then 應可轉為驗證流程。
3. **文件即交接**：README、使用指南、spec、instructions 各自有明確角色，不可混寫。

### 變更時的同步責任

- 修改使用者入口、模式名稱、輸出資料夾、安裝方式時，要同步檢查 README、使用指南、spec、instructions。
- 修改 PowerShell 入口或打包流程時，要同步檢查離線包內容說明是否仍正確。
- 修改 repo 結構或清理舊檔前，必須先確認沒有 README / 文件 / 腳本仍引用該檔案。

**不要把一次性的過渡方案、特定案例 workaround、臨時整理產物，直接上升為 repo 級長期規則。**

---

## ✅ 驗證與完成定義

### PowerShell / 安裝 / 打包變更時必做

- 使用 `Parser::ParseFile` 驗證 PowerShell 語法。
- 若改動 `install.ps1`、`setup.ps1`、`launch-chrome.ps1`、`launch-edge.ps1`、`collect.ps1`、`scripts\launch-browser.ps1` 或 `scripts\prepare-offline-bundle.ps1`，必須做最少一輪對應 smoke test。
- 若改動離線包組成，必須驗證 bundle 內的 `install.ps1` 確實能檢查出完整 / 缺件狀態。

### Repo 常用驗證命令

```powershell
npx tsc --noEmit
node .\test-sanitization-validation.cjs
sh .\scripts\pre-commit-scan.sh
sh .\scripts\verify-credential-security.sh
```

### 完成定義

- 功能或文件變更已落地
- 必要驗證已執行
- 相關文件已同步
- 不相關變更沒有被誤提交
- 在使用者要求 `add, commit, push` 的情境下，已完成對應 Git 流程

---

## 🌿 Git / Merge / Sync 準則

### 1. 先保護工作樹，再談同步

- 若工作樹有不相關變更，必須 **只 stage 本次任務相關檔案**。
- 不可為了同步遠端而覆蓋使用者尚未說明的本地修改。
- 遇到 merge、sync、index 問題時，優先採用 **可回復、非破壞性** 流程，例如：備份、stash、fast-forward、精準 stage。

### 2. 避免破壞性 Git 操作

- 未獲明確授權前，不得使用 `git reset --hard`、`git checkout --`、強制覆蓋本地檔案等破壞性命令。
- 如果 Git index 異常，先備份再修復，不可直接賭一把重建。

### 3. Commit 規範

- 若本次任務有實際 repo 變更，完成驗證後應建立 commit。
- commit 訊息與工作日誌以 **繁體中文（zh-TW）** 為主，且應清楚說明：
  - 為什麼改
  - 改了什麼
  - 如何驗證
- 建立 commit 時，必須附上：

```text
Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

---

## ⛔ 明確禁止事項

- 對一般使用者預設「請自行安裝 Node/npm 再試一次」
- 把 `npm run ...` / `npx ...` 當成一般使用者文件的主流程
- 在附加到使用者 Chrome / Edge 的情境下，把 `browser.close()` 當成預設清理方式
- 把含敏感資訊的錄製檔、帳密、token 提交到 repo
- 交付不完整離線包，卻宣稱可在內網直接使用
- 讓 `README.md` 膨脹成完整 SOP，或讓 `docs\使用指南.md` 失去白話教學定位
- 把特定案例的臨時 workaround 寫成整個 repo 的最高層長期規則

---

## 🔄 版本變更記錄

| 版本 | 日期 | 重點 |
|------|------|------|
| 1.2.0 | 2026-03-15 | 升級為 Chromium branded browser aware：保留 Chrome 為標準入口，新增 Edge 對應入口、文件同步與離線包責任邊界 |
| 1.2.1 | 2026-03-20 | 新增外部簡報技能參考，為製作精美簡報的需求指定專業 skill |
| 1.1.0 | 2026-03-13 | 新增角色分流、Windows 主流程、離線包責任、文件邊界、repo-specific CDP 準則、非技術使用者友善原則、Git 非破壞性同步規則 |
| 1.0.0 | 2026-02-09 | 初版建立 |
