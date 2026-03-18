# RPA-Cowork：內部網路自動化協作流程（Edge 版使用指南）

> 這份文件是給 **固定使用 Microsoft Edge 的內網單位**。
> 目標只有一件事：**讓你用最短路徑完成 Edge 蒐集流程，並把同一次任務材料交給 AI，在本專案框架內生成或除錯任務腳本**。
>
> 以下主線以 **Windows 11 + PowerShell 7.x** 為主。
> 如果你要看 Chrome / Edge 通用版，請回到 [`docs/使用指南.md`](使用指南.md)。
> 一般使用者真正要貼給 AI 的 Prompt，也只認這一份文件。

## 1. 為什麼這個工具選 Playwright，不選 Selenium？

這個專案要的是 **穩定蒐集素材**，不是做一套很容易因為畫面小改就失效的操作。

- **不要靠座標去賭按鈕剛好在原位**
  Selenium 很容易讓人走到「往右 300、往下 200 去點」這種做法。這就像叫人照地板貼紙去按電燈：開關只要移一點，就按錯地方。Playwright 比較像直接去找「查詢按鈕」「登入欄位」「匯出連結」。

- **網站改版或解析度不同時，比較不容易壞**
  內網頁面常會改版，也可能因為螢幕解析度、縮放比例不同，讓元件位置整個變掉。靠位置或脆弱定位的方法，很容易昨天能用、今天失敗。Playwright 比較適合根據頁面語意、文字和可見元素找目標，穩定度通常更高。

- **少掉 driver 維護與版本對版的麻煩**
  Selenium 常要顧瀏覽器 driver，像鎖和鑰匙要剛好同一版；瀏覽器一更新，就可能要再配一次。這個專案又要做離線包交付，driver 維護越少越好。Playwright 在這件事上省事很多。

所以這個專案才會用 Playwright 來蒐集 **ARIA 快照、截圖、錄製檔**，再把素材交給 AI 生成後續腳本。

---

## 2. 最短 SOP：先照這 3 步做

```powershell
.\install.ps1
.\launch-edge.ps1
.\collect.ps1 --browser edge
```

記法很簡單：

1. `install.ps1`：先檢查離線包是不是完整可用
2. `launch-edge.ps1`：打開給工具連接的 Microsoft Edge 視窗
3. `collect.ps1 --browser edge`：開始蒐集 Edge 頁面素材

> 如果第一步失敗，通常不是你操作錯，而是 **離線包不完整**。
> 請不要先跳去研究 npm、npx、Node.js 或 Playwright 安裝；直接把 `logs\` 最新 `.log` 交給準備工具包的人最快。

---

## 3. 開始前先看這 4 件事

1. **請拿整個工具資料夾，不要拆散**
   如果對方給你的是 zip，先完整解壓縮；不要只拿幾個 `.ps1` 出來用。

2. **主線環境是 Windows 11 + PowerShell 7.x**
   這份 Edge 指南就是照這個情境寫的。

3. **這台電腦要先有 Microsoft Edge**
   branded Edge 是目標電腦本來就要安裝好的系統瀏覽器，不會打包在離線包裡。

4. **即使用 Edge，離線包裡也還是要有 `.playwright-browsers\`**
   這是工具自己的 Playwright Chromium runtime，不是要你改用 Chrome，也不是把 Edge 本體一起打包。

完整離線包通常至少會看到：

- `runtime\node\`
- `node_modules\`
- `.playwright-browsers\`
- `.env.example`
- `install.ps1`
- `launch-edge.ps1`
- `collect.ps1`
- `new-task.ps1`
- `run-task.ps1`
- `src\lib\`

工具包應附 `.env.example` 讓你需要時複製成 `.env`；但 **不應附已填過值的 `.env`**。

一般使用者只要照 `install.ps1 -> launch-edge.ps1 -> collect.ps1 --browser edge` 這條路走就好，不需要先研究 npm / npx / Node.js。若畫面跳出 `node` / `npm` / `npx` 找不到，優先視為工具包不完整，不需要自己手動改 PATH。

---

## 4. Edge 使用者：照這 3 步做

### 步驟 1：先跑 `install.ps1`

```powershell
.\install.ps1
```

這一步是在 **檢查工具包是否完整**，不是上網安裝器。

如果失敗，直接做這件事就好：

1. 到 `logs\` 找最新的 `.log`
2. 把 log 檔交給準備者或技術人員
3. 請對方重新確認離線包是否完整

### 步驟 2：啟動 Microsoft Edge 專用視窗

```powershell
.\launch-edge.ps1
```

執行後請做 3 件事：

1. 在新開的 Edge 視窗裡登入內部網站
2. 打開你要蒐集的目標頁面
3. 先不要把這個 Edge 視窗關掉

### 步驟 3：開始蒐集

```powershell
.\collect.ps1 --browser edge
```

第一次使用，建議先走預設互動流程，照畫面提示做即可。

如果你只想先確認工具有沒有接上目前這一頁，可以先用：

```powershell
.\collect.ps1 --snapshot --browser edge
```

### 第一次跑 `collect.ps1 --browser edge`，你會先看到什麼？

畫面會先問你要哪一種模式：

```text
[1] 📸 互動模式（推薦新手）- 一步一步引導你蒐集
[2] 🤖 自動模式 - 依設定檔自動蒐集所有頁面
[3] ⚡ 快照模式 - 快速擷取當前頁面
[4] 🎬 錄製模式 - 啟動 Codegen 錄製互動流程
```

你可以這樣理解：

- **按 1：互動模式**
  最適合第一次使用。工具會先問你 3 個簡單問題：`專案名稱`、`素材根目錄`、`本次任務/錄製名稱`，接著帶你進入「頁面蒐集階段」。
  下一步就是：先把 Edge 切到你要蒐集的頁面，再回 PowerShell 按選單做事。

- **按 2：自動模式**
  工具會讀取已準備好的設定檔，自動跑完整批次蒐集。
  這通常是 **技術準備者已經先幫你配好設定** 才用；一般使用者如果沒被特別交代，先不要選這個。

- **按 3：快照模式**
  工具會立刻抓「你現在這一頁」的 ARIA 快照和截圖。
  最適合用來快速確認：工具有沒有真的接上目前的 Edge 頁面。
  如果成功，下一步通常是回頭再跑一次 `collect.ps1 --browser edge`，然後選 **1** 做完整蒐集。

- **補充：按 4：錄製模式**
  如果你已經不想先蒐集頁面，只想直接錄一段操作流程，可以選這個。它會另外開一個 Playwright 錄製視窗。

### 互動模式完整範例：你腦中可以這樣想像

下面給你一個 **真的很像現場操作** 的例子。你不用逐字照抄，但可以用它來想像每一步會看到什麼。

#### 範例情境

你已經：

- 跑完 `install.ps1`
- 用 `launch-edge.ps1` 開好 Edge
- 在 Edge 裡登入內網系統
- 已經切到「案件查詢」頁面

接著你執行：

```powershell
.\collect.ps1 --browser edge
```

#### 範例流程

1. 畫面先出現模式選單，你輸入 `1`
   這表示你要走 **互動模式**。

2. 工具接著會問你 3 個欄位，你可以這樣填：

   - `專案名稱:` `case-portal`
   - `素材根目錄 (Enter=./materials):` 直接按 Enter
   - `本次任務/錄製名稱（Enter 使用「case-portal」）:` `案件查詢`

   你腦中可以把這一步想成：
   **「先替這一批素材命名，讓等等產出的資料夾好找。」**

3. 接著畫面會顯示歡迎訊息、這次任務資料夾路徑，並進入：

   ```text
   階段 1/2：頁面蒐集（ARIA-first）
   ```

   這時工具會再問你：

   ```text
   頁面蒐集階段：接下來要做什麼？
   [1] 蒐集目前 Edge 頁面
   [2] 切換到錄製階段
   [3] 結束並產生報告
   ```

4. 如果你現在人在「案件查詢」頁面，就按 `1`
   你會看到這一頁被蒐集完成，畫面會列出像下面這種資訊：

   - 頁面名稱
   - 頁面標題
   - `ARIA 快照` 檔案路徑
   - `截圖` 檔案路徑
   - 目前累計幾頁、幾個錄製、幾個錯誤

   你可以把這一步想成：
   **「這一頁的結構和畫面，已經被收進材料袋。」**

5. 接著畫面會再問一次：

   ```text
   本頁完成，下一步要做什麼？
   [1] 繼續蒐集下一個頁面
   [2] 進入錄製階段
   [3] 結束並產生報告
   ```

   如果你還想再抓「查詢結果頁」，就回到 Edge 先實際按一次查詢，讓結果表格出現，再回 PowerShell 按 `1`。

6. 假設你現在頁面素材已經夠了，想開始錄流程，就按 `2`
   工具會切到：

   ```text
   階段 2/2：流程錄製
   ```

   然後問你錄製資訊，你可以這樣填：

   - `錄製名稱（Enter 使用「案件查詢-flow」）:` 直接按 Enter
   - `起始 URL（Enter 使用目前頁面 URL）:` 直接按 Enter
   - `操作說明（可選，例：登入後查詢案件並送出）:` `輸入案件編號 A123456，按查詢，再打開第一筆案件明細`

7. 接著畫面會出現「錄製前確認」：

   ```text
   [1] 開始錄製
   [2] 先不錄製，返回上一個選單
   ```

   如果你按 `1`，工具會開一個 **新的 Playwright 錄製視窗**。
   這個視窗 **不是你原本那個已登入的 Edge 視窗**，所以登入狀態可能不同。

8. 你在新開的錄製視窗完成操作後，直接把那個視窗關掉
   關掉後，PowerShell 會自動回來，並告訴你：

   - 這次錄製檔叫什麼名字
   - 已經存到哪個 `recordings\` 檔案
   - 目前累計幾頁素材、幾個錄製、幾個錯誤

9. 最後畫面會再問你：

   ```text
   錄製完成，下一步要做什麼？
   [1] 重新錄製同一個流程
   [2] 再錄另一個流程
   [3] 返回頁面蒐集階段
   [4] 結束並產生報告
   ```

   如果你這次已經夠了，就按 `4`。

10. 結束後，到 `materials\YYYYMMDDhhmmss_案件查詢\` 裡看成果
    通常你會看到：

    - `aria-snapshots\`
    - `screenshots\`
    - `recordings\`
    - `metadata.json`
    - `summary-report.md`

---

## 5. 蒐集完成後，去哪裡看結果？

通常會在：

```text
materials\
```

看到一個新的任務資料夾，例如：

```text
materials\YYYYMMDDhhmmss_任務名稱\
```

常見內容：

```text
materials\YYYYMMDDhhmmss_任務名稱\
├─ aria-snapshots\
├─ screenshots\
├─ recordings\
├─ metadata.json
└─ summary-report.md
```

白話來說：

- `aria-snapshots\`：頁面結構線索
- `screenshots\`：畫面截圖
- `recordings\`：操作錄製檔
- `metadata.json`：這次任務的基本資訊
- `summary-report.md`：這次任務的簡短整理

如果過程中有錯誤，也請一起看：

```text
logs\
```

裡最新的 `.log` 檔。

---


## 6. 要請 AI 幫忙時，怎麼講最省事？

先記住一個核心：

> **AI 不是幫你臨時拼一支獨立腳本，而是幫你補完 RPA-Cowork 框架裡的 `src\任務腳本.ts`。**

也就是說，AI 生成或修正的內容，最後要能直接回到這個專案，用既有的：

- `new-task.ps1`
- `run-task.ps1`
- `src\lib\env.ts`
- `src\lib\logger.ts`
- `src\lib\browser.ts`
- `src\lib\security.ts`
- `src\lib\task.ts`

一起運作。

### 最短協作流程：先開骨架，再交給 AI

先在離線包裡建立任務骨架：

```powershell
.\new-task.ps1
```

建立完成後，你會得到像這樣的檔案：

```text
src\
└─ case-案件查詢.ts
```

接著把下面這些東西一起交給 AI：

- 同一次任務的 `aria-snapshots\`
- 同一次任務的 `screenshots\`
- 同一次任務的 `recordings\`
- `metadata.json`
- 剛剛建立的 `src\腳本骨架`
- 如果是除錯，再加上 `logs\` 最新日誌與目前失敗的腳本

> ⚠️ 不要上傳 `.env`。裡面可能有帳號、密碼或 token。

### 你真正要改的地方，只有 `【這裡一定要改】`

第一次使用時，建議你這樣看 Prompt：

- 有標 `【這裡一定要改】` 的地方：改成你的情況
- 有標 `【這裡可補充】` 的地方：知道就補，不知道可以寫「不確定」
- 其他固定句子：先不要改

這樣做的目的，是讓 AI 不要亂猜，也不要把腳本寫成脫離本專案框架的獨立版本。

### 先準備哪些附件？

如果你要請 AI **生成新腳本**，建議附上：

- `aria-snapshots\`
- `screenshots\`
- `recordings\`
- `metadata.json`
- `src\腳本骨架.ts`

如果你要請 AI **除錯現有腳本**，再加上：

- 目前失敗的 `src\腳本.ts`
- `logs\` 裡相關日誌
- PowerShell 的完整錯誤訊息

### Edge 版生成腳本 Prompt（空白版）

先上傳附件，再貼上下面這段。

> 使用方式：只改有標 `【這裡一定要改】` 或 `【這裡可補充】` 的地方，其餘固定句子先保留。

````text
你是 RPA-Cowork 任務腳本工程師。請根據我上傳的同一次任務附件，產生「可直接覆蓋本專案 `src\腳本名稱.ts`，並用 `run-task.ps1` 執行」的完整結果。

## 專案與執行邊界（Non-Negotiable）

- Windows 11 + PowerShell 7.x
- 主要瀏覽器：Microsoft Edge
- 這是完整離線安裝包，已包含 `runtime\node\node.exe`、`node_modules\`、`.playwright-browsers\`、`.env.example`、`new-task.ps1`、`run-task.ps1`、`src\lib\*`
- 不可要求 `npm install`、`npx`、`npm run`、額外下載套件
- 我已先用 `new-task.ps1` 建好 `src\腳本名稱.ts` 骨架
- 我會把你的結果存回 `src\腳本名稱.ts`，並用 `run-task.ps1` 執行
- 我已上傳的附件：同一次任務的 `aria-snapshots\`、`screenshots\`、`recordings\`、`metadata.json`、腳本骨架 `src\腳本名稱.ts`【這裡可補充】

## 我要完成的工作

【這裡一定要改】

## 成功時我應該能觀察到的結果

【這裡一定要改】

## 其他我已知的事實

【這裡一定要改】只寫 100% 確定的事

## 輸出要求（MUST）

請先讀附件，只根據附件與我明確提供的資訊判斷；沒有證據的地方請直接列為缺少資訊，不要自行假設。

### 1. 附件證據分析
列出你從哪些附件理解出流程（檔名、ARIA 線索、截圖文字、錄製步驟）。

### 2. 任務腳本：`src\腳本名稱.ts`
- 必須直接整合本專案框架，不要生成獨立專案或額外安裝步驟
- 入口必須使用 `runTaskEntry`（`./lib/task.js`）
- 依需要重用 `./lib/env.js`、`./lib/logger.js`、`./lib/browser.js`、`./lib/security.js`
- 預設使用 `launchTaskBrowser({ channel: 'msedge', headless: false })`
- 只有在我明確說明「要沿用 `launch-edge.ps1` 開出的已登入 Edge 視窗」時，才改用 `cdpConnect()` / `cdpDisconnect()`
- 關鍵步驟要有正體中文 `log()` 訊息，並在重要輸入 / 狀態使用 `logContext()`
- 失敗時要能從日誌看出：目前步驟、當下 URL、等待中的元素或狀態、可能原因
- 若要產生檔名或資料夾名稱，使用 `safeFileName()`
- 若要導航或處理外部連結，必要時使用 `validateUrl()`
- 不可 `import dotenv`，不可硬編碼密碼，敏感資料必須從 `.env` 讀取
- 不可把使用者指令寫成直接呼叫 `node` / `npx`；使用說明一律以 `run-task.ps1` 為主

### 3. `.env` 需要新增或調整的欄位
只列出需要新增的欄位與用途；如果不需要，請明確寫「無」。

### 4. 執行步驟
用非技術人員看得懂的 PowerShell 步驟說明。
- 如果腳本需要先附加到已登入 Edge，請先寫 `launch-edge.ps1`
- 最後一定寫 `run-task.ps1 src\腳本名稱.ts`

### 5. 成功檢查方式
列出我可以肉眼確認的成功訊號。

### 6. 缺少資訊
如果資料還不夠，列出還缺哪些附件或哪個頁面需要補蒐集。

## 自我審查（MUST）
- [ ] 腳本放在 `src\`
- [ ] 腳本入口是 `runTaskEntry`
- [ ] 腳本重用 `src\lib` 共用模組，而不是自己重寫一套
- [ ] 沒有 `npm install` / `npx` / 額外套件
- [ ] 沒有 `import dotenv`
- [ ] 預設 Edge 模式正確；若使用 CDP 附加，也沒有關閉使用者 Edge 視窗
- [ ] 使用者可見訊息為正體中文
- [ ] 執行步驟以 `run-task.ps1` 為主
- [ ] 如果任何一項不符合，請修正後再輸出
````

### Edge 版生成腳本 Prompt（已填好範例）

````text
你是 RPA-Cowork 任務腳本工程師。請根據我上傳的同一次任務附件，產生「可直接覆蓋本專案 `src\case-案件查詢.ts`，並用 `.\run-task.ps1 src\case-案件查詢.ts` 執行」的完整結果。

## 專案與執行邊界（Non-Negotiable）

- Windows 11 + PowerShell 7.x
- 主要瀏覽器：Microsoft Edge
- 這是完整離線安裝包，已包含 `runtime\node\node.exe`、`node_modules\`、`.playwright-browsers\`、`.env.example`、`new-task.ps1`、`run-task.ps1`、`src\lib\*`
- 不可要求 `npm install`、`npx`、`npm run`
- 我已先用 `new-task.ps1` 建好 `src\case-案件查詢.ts` 骨架
- 我已上傳的附件：`aria-snapshots\`、`screenshots\`、`recordings\`、`metadata.json`、`src\case-案件查詢.ts`

## 我要完成的工作

登入後開啟「案件查詢」，輸入案件編號 `A123456`，按「查詢」，再打開第一筆案件明細。

## 成功時我應該能觀察到的結果

- 查詢結果表格至少出現 1 筆資料
- 第一筆資料可以被點開
- 頁面出現案件編號與案件狀態欄位
- URL 包含 `/case/detail`

## 其他我已知的事實

附件中有登入後首頁、案件查詢頁、查詢結果頁和明細頁截圖。錄製檔有查詢到打開第一筆明細的操作。是否需要簡訊驗證不確定。

## 輸出要求（MUST）

### 1. 附件證據分析
### 2. 任務腳本：`src\case-案件查詢.ts`
### 3. `.env` 需要新增或調整的欄位
### 4. 執行步驟
### 5. 成功檢查方式
### 6. 缺少資訊
````

### Edge 版除錯 Prompt（空白版）

先上傳附件（含失敗的腳本、錯誤日誌），再貼上下面這段。

> 使用方式：只改有標 `【這裡一定要改】` 或 `【這裡可補充】` 的地方，其餘固定句子先保留。

````text
你是 RPA-Cowork 任務腳本除錯工程師。請根據我上傳的附件，診斷問題並產生「可直接覆蓋本專案 `src\腳本名稱.ts` 的修正版腳本與執行建議」。

## 專案與執行邊界（Non-Negotiable）

- Windows 11 + PowerShell 7.x
- 主要瀏覽器：Microsoft Edge
- 這是完整離線安裝包，已包含 `runtime\node\node.exe`、`node_modules\`、`.playwright-browsers\`、`.env.example`、`new-task.ps1`、`run-task.ps1`、`src\lib\*`
- 不可要求 `npm install`、`npx`、`npm run`
- 目前失敗的腳本位置是 `src\腳本名稱.ts`
- 我會把你的修正版存回 `src\腳本名稱.ts`，並用 `run-task.ps1` 重新執行
- 我已上傳的附件：目前腳本、`aria-snapshots\`、`screenshots\`、`recordings\`、`metadata.json`、`logs\`【這裡可補充】

## 我要完成的工作

【這裡一定要改】

## 失敗發生在

【這裡一定要改】

## 預期看到的可觀察結果

【這裡一定要改】

## 實際看到的現象 / 錯誤訊息

【這裡一定要改】

## 其他我已知的事實

【這裡一定要改】只寫 100% 確定的事

## 輸出要求（MUST）

請先讀附件，只根據附件與我明確提供的資訊判斷。不要自行假設已登入、已停在某頁面。

### 1. 根因診斷（1–3 個最可能原因）
每個原因都附上對應附件證據。

### 2. 修正版任務腳本：`src\腳本名稱.ts`
- 必須保留本專案框架整合方式（`runTaskEntry`、`src/lib/*`、`run-task.ps1`）
- 不要把腳本改寫成獨立專案或獨立示範程式
- 如果需要調整瀏覽器模式，先說明為什麼
- 關鍵修正可以加上 `// [FIX]` 註解
- 補足 `log()` / `logContext()`，讓下次出錯時更容易定位
- 若使用 CDP 附加模式，修正版仍不可關閉使用者 Edge 視窗

### 3. `.env` 需要新增或調整的欄位

### 4. 重新執行步驟
- 如果需要附加到已登入 Edge，請先寫 `launch-edge.ps1`
- 最後一定寫 `run-task.ps1 src\腳本名稱.ts`

### 5. 修正後應檢查的成功訊號

### 6. 如果問題仍未解決的下一步
告訴我還需要補蒐集哪些頁面、哪些附件要再交給 AI。

## 自我審查（MUST）
- [ ] 修正版仍放在 `src\`
- [ ] 修正版保留 `runTaskEntry` + `src/lib` 架構
- [ ] 沒有 `npm install` / `npx` / 額外套件
- [ ] 沒有 `import dotenv`
- [ ] 如果有調整瀏覽器模式，原因已明確說明
- [ ] 執行步驟以 `run-task.ps1` 為主
- [ ] 如果任何一項不符合，請修正後再輸出
````

### Edge 版除錯 Prompt（已填好範例）

````text
你是 RPA-Cowork 任務腳本除錯工程師。請根據我上傳的附件，診斷問題並產生「可直接覆蓋本專案 `src\case-案件查詢.ts` 的修正版腳本與執行建議」。

## 專案與執行邊界（Non-Negotiable）

- Windows 11 + PowerShell 7.x
- 主要瀏覽器：Microsoft Edge
- 這是完整離線安裝包，已包含 `runtime\node\node.exe`、`node_modules\`、`.playwright-browsers\`、`.env.example`、`new-task.ps1`、`run-task.ps1`、`src\lib\*`
- 不可要求 `npm install`、`npx`、`npm run`
- 目前失敗的腳本位置是 `src\case-案件查詢.ts`
- 我已上傳的附件：`src\case-案件查詢.ts`、`aria-snapshots\`、`screenshots\`、`recordings\`、`metadata.json`、`logs\`

## 我要完成的工作

在案件查詢頁輸入案件編號 `A123456` 後，成功打開第一筆案件明細。

## 失敗發生在

按下「查詢」之後，腳本沒有等到結果表格就報錯。

## 預期看到的可觀察結果

- 結果表格至少出現 1 筆資料
- 第一筆資料可以被點開
- 頁面出現案件編號與案件狀態欄位
- URL 包含 `/case/detail`

## 實際看到的現象 / 錯誤訊息

畫面停在查詢頁，PowerShell 顯示 `Timeout 30000ms exceeded while waiting for getByRole('button', { name: '查詢' })`。

## 其他我已知的事實

附件裡有查詢頁、結果頁、錯誤日誌和現有腳本。錄製檔顯示人工操作可以成功查到資料。是否和權限或資料量有關不確定。

## 輸出要求（MUST）

### 1. 根因診斷（1–3 個最可能原因）
### 2. 修正版任務腳本：`src\case-案件查詢.ts`
### 3. `.env` 需要新增或調整的欄位
### 4. 重新執行步驟
### 5. 修正後應檢查的成功訊號
### 6. 如果問題仍未解決的下一步
````

### 腳本執行出錯時的人機協作除錯

如果腳本執行時出現錯誤，你不需要自己研究程式碼。照下面這個流程，把資訊交給 AI 就好：

**第一步：收集錯誤資訊**

1. 把 PowerShell 視窗裡的錯誤訊息**全部複製**
2. 到離線包裡找你的腳本檔（例如 `src\case-案件查詢.ts`）
3. 如果有 `.env` 檔，確認裡面的值填對了（但不要把 `.env` 上傳給 AI）

**第二步：蒐集當前頁面狀態**

回到離線包，重新蒐集一次目前 Edge 停在的那個頁面：

```powershell
.\collect.ps1 --snapshot --browser edge
```

**第三步：上傳給 AI**

把以下東西一起上傳：

- 你目前的 `src\` 腳本檔
- PowerShell 的完整錯誤訊息
- 剛才重新蒐集的快照（`aria-snapshots\` 和 `screenshots\`）
- 之前的 `recordings\`、`metadata.json`、`logs\`

然後使用上面的「Edge 版除錯 Prompt」。

**第四步：拿到修正版後**

1. AI 會給你修正版的 `src\` 腳本內容
2. 用修正版覆蓋原本的 `src\` 腳本檔
3. 重新執行：`.\run-task.ps1 src\腳本名稱.ts`
4. 如果還是失敗，**再重複第一步到第三步**，每次都帶上最新的錯誤訊息和頁面快照

### 安全提醒

- 不要上傳 `.env` 檔案給 AI（裡面有你的密碼）
- 不要把密碼直接寫在 Prompt 裡
- 不要把整個 Edge 個人資料夾打包上傳
- 不要把不同任務的附件混在一起
- 如果截圖或錄製檔含敏感資訊，先依你們單位規則處理後再帶出

## 7. 最常見的 3 個問題

### 1. `install.ps1` 失敗

通常代表 **離線包不完整**。
最快的做法是把 `logs\` 最新 `.log` 交給準備者，請對方重新確認或重做完整包。

### 2. `launch-edge.ps1` 跑不起來

先檢查：

- 你是不是在完整工具資料夾裡執行
- 這台電腦是否已安裝 Microsoft Edge
- 重新執行一次有沒有恢復正常

如果還是不行，一樣把 `logs\` 最新啟動日誌交出去。

### 3. `collect.ps1 --browser edge` 啟動了，但抓不到頁面

先確認：

- 你是不是用 `launch-edge.ps1` 開的那個 Edge 視窗
- 那個 Edge 視窗有沒有保持開著
- 你有沒有在那個 Edge 視窗裡登入網站
- 你要抓的頁面是不是已經打開
- 指令裡有沒有真的加上 `--browser edge`

---

## 8. 一句話記住

**固定使用 Microsoft Edge 時，就照 `install.ps1 -> launch-edge.ps1 -> collect.ps1 --browser edge` 這條路先把素材抓完整；要請 AI 幫忙時，先用 `new-task.ps1` 建立 `src\` 任務骨架，再用本頁第 6 節的 Prompt 把同一次附件交給 AI，最後用 `run-task.ps1 src\腳本名稱.ts` 執行。**
