# 內部網路網頁素材蒐集工具使用指南（Edge 版）

> 這份文件是給 **固定使用 Microsoft Edge 的內網單位**。
> 目標只有一件事：**讓你用最短路徑完成 Edge 蒐集流程，並把素材交給 AI 生成腳本或除錯腳本**。
>
> 以下主線以 **Windows 11 + PowerShell 7.x** 為主。
> 如果你要看 Chrome / Edge 通用版，請回到 [`docs/使用指南.md`](使用指南.md)。

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

如果你完全沒有提示工程訓練，也沒關係。先記住下面 4 個原則就好：

1. **先講清楚你要的交付物**
   你要的是：
   - 一份 **可直接執行的新腳本**，還是
   - 一份 **可直接替換的修正版腳本**

2. **只給同一次任務的附件**
   不要把不同日期、不同網站、不同頁面的材料混在一起，不然 AI 很容易誤判流程。

3. **成功標準一定要寫成看得到的結果**
   例如：畫面出現哪句話、網址變成哪一頁、表格出現哪個欄位、下載了哪個檔案。

4. **不知道就寫「不確定」**
   不要替 AI 先補腦，也不要要求 AI 猜測你是不是已經執行哪個命令、是否已登入、是否停在哪個頁面。

### 你真正要改的地方，只有 `【這裡一定要改】`

第一次使用時，建議你這樣看 Prompt：

- 有標 `【這裡一定要改】` 的地方：請改成你的情況
- 有標 `【這裡可補充】` 的地方：知道就補，不知道可以留預設或寫「不確定」
- 其他沒有標註的句子：**先不要改**

這樣最安全，因為那些固定句子的目的，是在提醒 AI：

- 只根據附件與明確事實判斷
- 不要自己猜
- 輸出必須是腳本 + 使用說明 + 成功檢查方式

### 先看一眼：什麼叫「太空泛」？什麼叫「夠精準」？

**太空泛的寫法：**

```text
幫我寫自動化。
```

問題是：AI 不知道你要哪個網站、哪個頁面、想做到哪一步，也不知道成功長什麼樣子。

**比較精準的寫法：**

```text
請根據我上傳的同一次任務附件，產生可直接執行的 Playwright TypeScript 腳本及使用說明。目標是在 Microsoft Edge 已登入狀態下，從案件查詢頁輸入案件編號並打開第一筆明細。成功時，畫面要出現查詢結果表格，且 URL 進入案件明細頁。
```

這樣 AI 就比較知道：

- 你要的是 **新腳本**
- 目標瀏覽器是 **Microsoft Edge**
- 目標流程是 **案件查詢 → 開啟明細**
- 成功標準是 **看得到的結果**

### 先準備哪些附件？

如果你要請 AI **生成腳本**，建議附上同一次任務的：

- `aria-snapshots\`
- `screenshots\`
- `recordings\`
- `metadata.json`

如果你要請 AI **除錯**，再加上：

- 目前失敗的腳本檔
- `logs\` 裡相關日誌

### Edge 版生成腳本 Prompt（空白版）

先上傳附件，再貼上下面這段。

> 使用方式：只改有標 `【這裡一定要改】` 或 `【這裡可補充】` 的地方，其餘句子先保留。

````text
你是一位 Playwright 自動化腳本工程師。請根據我上傳的同一次任務附件，產生「可直接在離線安裝包中執行的腳本及相關檔案」。

## 執行環境（Non-Negotiable）

- Windows 11 + PowerShell 7.x
- 目標瀏覽器：Microsoft Edge
- 離線安裝包已包含：Node.js runtime（`runtime\node\node.exe`）、`node_modules\`（含 playwright、tsx、typescript）、`.playwright-browsers\`
- **無網路、無 npm install、無 npx**
- 腳本執行指令：`.\runtime\node\node.exe .\node_modules\.bin\tsx 腳本名稱.ts`
- 瀏覽器已由使用者透過 `launch-edge.ps1` 開啟，CDP 預設端口 `9222`
- 我已上傳的附件：`aria-snapshots\`、`screenshots\`、`recordings\`、`metadata.json`【這裡可補充：如果你另外有上傳其他檔案，就補在這行後面】

## 我要完成的工作

【這裡一定要改】例如：登入後開啟「案件查詢」，輸入案件編號，按「查詢」，再打開第一筆案件明細

## 成功時我應該能觀察到的結果

【這裡一定要改】例如：
- 查詢結果表格至少出現 1 筆資料
- 第一筆資料可以被點開
- URL 包含 `/case/detail`

## 其他我已知的事實

【這裡一定要改】只寫你 100% 確定的事；例如：附件中有登入後首頁、案件查詢頁、查詢結果頁。是否需要二次驗證不確定。

## 輸出要求（MUST）

請先讀附件，只根據附件與我明確提供的資訊判斷。如果附件或我的描述沒有證據，請不要自行假設已登入、已停在某頁面；直接列出缺少的資訊。

### 1. 附件證據分析
列出你從哪些附件理解出流程（檔名、畫面文字、ARIA 線索或錄製步驟）。

### 2. 主腳本：`腳本名稱.ts`
- 使用 `import { chromium } from 'playwright'` 和 `chromium.connectOverCDP('http://localhost:9222')` 附加到使用者已開啟的 Edge
- 內建 `.env` 解析（用 `fs.readFileSync` + 逐行解析），**不可 import dotenv 或任何離線包未預裝的套件**
- 過濾 `chrome://`、`edge://`、`about:blank` 等非使用者頁面
- 每個關鍵步驟加上 `console.log` 顯示進度（中文），例如：`✅ 已找到查詢按鈕`、`⏳ 正在等待結果表格...`
- 操作失敗時輸出清楚的中文錯誤訊息，並附上當時的頁面 URL 和可能原因
- 結束時只 disconnect，不要關閉使用者的 Edge 視窗
- 使用 `Asia/Taipei` 時區處理所有時間

### 3. 環境設定檔：`.env`
```
# 請在等號後面填入你的實際值（不需要加引號）
RECORDING_PASSWORD=你的密碼
# 如果有其他需要的變數也列在這裡
```

### 4. 使用說明：`使用說明.txt`
精簡扼要、非技術人員友善，只包含：
- 第一段：這個腳本做什麼（一句話）
- 第二段：`.env` 怎麼填（列出每個欄位要填什麼）
- 第三段：執行指令（逐步 PowerShell 指令，可以直接複製貼上）
- 第四段：怎麼判斷成功了
- 不要解釋 Node.js、npm、Playwright 是什麼

### 5. 缺少資訊
如果資料不夠，列出還缺哪些附件或步驟。

## 自我審查（MUST）

輸出前請逐項檢查：
- [ ] 腳本沒有 `import dotenv` 或 `require('dotenv')`，.env 解析是內建的
- [ ] 腳本沒有 `npm install`、`npx`、`npm run` 等指令
- [ ] 腳本用 `connectOverCDP` 而非 `launch` 來連線瀏覽器
- [ ] 腳本結束時不會關閉使用者的 Edge 視窗
- [ ] `.env` 範例沒有寫入真實密碼
- [ ] `使用說明.txt` 沒有提到 npm、npx、Node.js 安裝教學
- [ ] 執行指令用的是 `.\runtime\node\node.exe .\node_modules\.bin\tsx`
- [ ] 所有使用者可見的訊息都是中文

如果任何一項不符合，請修正後再輸出。
````

### Edge 版生成腳本 Prompt（已填好範例）

如果你看空白版還是沒感覺，下面這份就是 **真的填完會長什麼樣子**：

````text
你是一位 Playwright 自動化腳本工程師。請根據我上傳的同一次任務附件，產生「可直接在離線安裝包中執行的腳本及相關檔案」。

## 執行環境（Non-Negotiable）

- Windows 11 + PowerShell 7.x
- 目標瀏覽器：Microsoft Edge
- 離線安裝包已包含：Node.js runtime（`runtime\node\node.exe`）、`node_modules\`（含 playwright、tsx、typescript）、`.playwright-browsers\`
- **無網路、無 npm install、無 npx**
- 腳本執行指令：`.\runtime\node\node.exe .\node_modules\.bin\tsx 案件查詢.ts`
- 瀏覽器已由使用者透過 `launch-edge.ps1` 開啟，CDP 預設端口 `9222`
- 我已上傳的附件：`aria-snapshots\`、`screenshots\`、`recordings\`、`metadata.json`、`logs\`

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

請先讀附件，只根據附件與我明確提供的資訊判斷。如果附件或我的描述沒有證據，請不要自行假設已登入、已停在某頁面；直接列出缺少的資訊。

### 1. 附件證據分析
列出你從哪些附件理解出流程（檔名、畫面文字、ARIA 線索或錄製步驟）。

### 2. 主腳本：`案件查詢.ts`
- 使用 `import { chromium } from 'playwright'` 和 `chromium.connectOverCDP('http://localhost:9222')` 附加到使用者已開啟的 Edge
- 內建 `.env` 解析（用 `fs.readFileSync` + 逐行解析），**不可 import dotenv 或任何離線包未預裝的套件**
- 過濾 `chrome://`、`edge://`、`about:blank` 等非使用者頁面
- 每個關鍵步驟加上 `console.log` 顯示進度（中文），例如：`✅ 已找到查詢按鈕`、`⏳ 正在等待結果表格...`
- 操作失敗時輸出清楚的中文錯誤訊息，並附上當時的頁面 URL 和可能原因
- 結束時只 disconnect，不要關閉使用者的 Edge 視窗
- 使用 `Asia/Taipei` 時區處理所有時間

### 3. 環境設定檔：`.env`
```
# 請在等號後面填入你的實際值（不需要加引號）
RECORDING_PASSWORD=你的密碼
```

### 4. 使用說明：`使用說明.txt`
精簡扼要、非技術人員友善，只包含：
- 第一段：這個腳本做什麼（一句話）
- 第二段：`.env` 怎麼填（列出每個欄位要填什麼）
- 第三段：執行指令（逐步 PowerShell 指令，可以直接複製貼上）
- 第四段：怎麼判斷成功了
- 不要解釋 Node.js、npm、Playwright 是什麼

### 5. 缺少資訊
如果資料不夠，列出還缺哪些附件或步驟。

## 自我審查（MUST）

輸出前請逐項檢查：
- [ ] 腳本沒有 `import dotenv` 或 `require('dotenv')`，.env 解析是內建的
- [ ] 腳本沒有 `npm install`、`npx`、`npm run` 等指令
- [ ] 腳本用 `connectOverCDP` 而非 `launch` 來連線瀏覽器
- [ ] 腳本結束時不會關閉使用者的 Edge 視窗
- [ ] `.env` 範例沒有寫入真實密碼
- [ ] `使用說明.txt` 沒有提到 npm、npx、Node.js 安裝教學
- [ ] 執行指令用的是 `.\runtime\node\node.exe .\node_modules\.bin\tsx`
- [ ] 所有使用者可見的訊息都是中文

如果任何一項不符合，請修正後再輸出。
````

### Edge 版除錯 Prompt（空白版）

先上傳附件（含失敗的腳本、錯誤日誌），再貼上下面這段。

> 使用方式：只改有標 `【這裡一定要改】` 或 `【這裡可補充】` 的地方，其餘句子先保留。

````text
你是一位 Playwright 自動化腳本除錯工程師。請根據我上傳的附件，診斷問題並產生「可直接在離線安裝包中替換執行的修正版腳本」。

## 執行環境（Non-Negotiable）

- Windows 11 + PowerShell 7.x
- 目標瀏覽器：Microsoft Edge
- 離線安裝包已包含：Node.js runtime（`runtime\node\node.exe`）、`node_modules\`（含 playwright、tsx、typescript）、`.playwright-browsers\`
- **無網路、無 npm install、無 npx**
- 腳本執行指令：`.\runtime\node\node.exe .\node_modules\.bin\tsx 腳本名稱.ts`
- 瀏覽器已由使用者透過 `launch-edge.ps1` 開啟，CDP 預設端口 `9222`
- 我已上傳的附件：目前腳本、`aria-snapshots\`、`screenshots\`、`recordings\`、`metadata.json`、`logs\`【這裡可補充】

## 我要完成的工作

【這裡一定要改】例如：在案件查詢頁輸入案件編號後，成功打開第一筆案件明細

## 失敗發生在

【這裡一定要改】例如：按下「查詢」之後，腳本等不到結果表格

## 預期看到的可觀察結果

【這裡一定要改】例如：
- 結果表格出現至少 1 筆資料
- 第一筆資料可以被點開
- URL 包含 `/case/detail`

## 實際看到的現象 / 錯誤訊息

【這裡一定要改】例如：畫面停在查詢頁，PowerShell 顯示 `Timeout 30000ms exceeded while waiting for getByRole('button', { name: '查詢' })`

## 其他我已知的事實

【這裡一定要改】只寫你 100% 確定的事

## 輸出要求（MUST）

請先讀附件，只根據附件與我明確提供的資訊判斷。不要自行假設已登入、已停在某頁面。

### 1. 原因診斷（1–3 個最可能原因）
每個原因都附上你引用的附件證據（檔名、錯誤訊息、ARIA 快照內容）。

### 2. 修正版腳本：`腳本名稱.ts`
- 同樣的離線包約束（connectOverCDP、內建 .env 解析、不用 dotenv）
- 針對診斷出的問題加入修正（例如：加長等待時間、改用更穩定的選擇器、加入重試機制）
- 在修正的地方加上 `// [FIX] 修正說明` 註解
- 每個關鍵步驟加上 `console.log` 進度提示（中文）
- 結束時只 disconnect，不關閉使用者的 Edge 視窗

### 3. 更新的 `.env`（如果需要新增變數）

### 4. 更新的 `使用說明.txt`（如果執行方式有變）

### 5. 修正後應檢查的成功訊號

### 6. 如果問題仍未解決的下一步
告訴使用者：
- 要補蒐集哪些素材（回到離線包執行 `collect.ps1 --browser edge` 重新蒐集哪些頁面）
- 要把哪些檔案再次上傳給 AI

## 自我審查（MUST）

輸出前請逐項檢查：
- [ ] 修正版腳本沒有 `import dotenv`，.env 解析是內建的
- [ ] 修正版腳本沒有 `npm install`、`npx` 等指令
- [ ] 修正版腳本用 `connectOverCDP` 連線
- [ ] 修正版腳本結束時不會關閉使用者的 Edge 視窗
- [ ] 所有 `[FIX]` 註解都清楚說明修正了什麼
- [ ] 執行指令用的是 `.\runtime\node\node.exe .\node_modules\.bin\tsx`

如果任何一項不符合，請修正後再輸出。
````

### Edge 版除錯 Prompt（已填好範例）

````text
你是一位 Playwright 自動化腳本除錯工程師。請根據我上傳的附件，診斷問題並產生「可直接在離線安裝包中替換執行的修正版腳本」。

## 執行環境（Non-Negotiable）

- Windows 11 + PowerShell 7.x
- 目標瀏覽器：Microsoft Edge
- 離線安裝包已包含：Node.js runtime（`runtime\node\node.exe`）、`node_modules\`（含 playwright、tsx、typescript）、`.playwright-browsers\`
- **無網路、無 npm install、無 npx**
- 腳本執行指令：`.\runtime\node\node.exe .\node_modules\.bin\tsx 案件查詢.ts`
- 瀏覽器已由使用者透過 `launch-edge.ps1` 開啟，CDP 預設端口 `9222`
- 我已上傳的附件：目前腳本 `案件查詢.ts`、`aria-snapshots\`、`screenshots\`、`recordings\`、`metadata.json`、`logs\`

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

請先讀附件，只根據附件與我明確提供的資訊判斷。不要自行假設已登入、已停在某頁面。

### 1. 原因診斷（1–3 個最可能原因）
每個原因都附上你引用的附件證據（檔名、錯誤訊息、ARIA 快照內容）。

### 2. 修正版腳本：`案件查詢.ts`
- 同樣的離線包約束（connectOverCDP、內建 .env 解析、不用 dotenv）
- 針對診斷出的問題加入修正（例如：加長等待時間、改用更穩定的選擇器、加入重試機制）
- 在修正的地方加上 `// [FIX] 修正說明` 註解
- 每個關鍵步驟加上 `console.log` 進度提示（中文）
- 結束時只 disconnect，不關閉使用者的 Edge 視窗

### 3. 更新的 `.env`（如果需要新增變數）

### 4. 更新的 `使用說明.txt`（如果執行方式有變）

### 5. 修正後應檢查的成功訊號

### 6. 如果問題仍未解決的下一步
告訴使用者：
- 要補蒐集哪些素材（回到離線包執行 `collect.ps1 --browser edge` 重新蒐集哪些頁面）
- 要把哪些檔案再次上傳給 AI

## 自我審查（MUST）

輸出前請逐項檢查：
- [ ] 修正版腳本沒有 `import dotenv`，.env 解析是內建的
- [ ] 修正版腳本沒有 `npm install`、`npx` 等指令
- [ ] 修正版腳本用 `connectOverCDP` 連線
- [ ] 修正版腳本結束時不會關閉使用者的 Edge 視窗
- [ ] 所有 `[FIX]` 註解都清楚說明修正了什麼
- [ ] 執行指令用的是 `.\runtime\node\node.exe .\node_modules\.bin\tsx`

如果任何一項不符合，請修正後再輸出。
````

### 腳本執行出錯時的人機協作除錯

如果腳本執行時出現錯誤，你不需要自己研究程式碼。照下面這個流程，把資訊交給 AI 就好：

**第一步：收集錯誤資訊**

1. 把 PowerShell 視窗裡的錯誤訊息**全部複製**（從 `.\runtime\node\node.exe ...` 開始到最後一行）
2. 到離線包裡找你的腳本檔（例如 `案件查詢.ts`）
3. 如果有 `.env` 檔，確認裡面的值填對了（但不要把 `.env` 上傳給 AI）

**第二步：蒐集當前頁面狀態**

回到離線包，重新蒐集一次目前 Edge 停在的那個頁面：

```powershell
.\collect.ps1 --snapshot --browser edge
```

**第三步：上傳給 AI**

把以下東西一起上傳：
- 你目前的腳本檔（`.ts`）
- PowerShell 的完整錯誤訊息（可以貼文字，或截圖）
- 剛才重新蒐集的快照（`aria-snapshots\` 和 `screenshots\`）
- 之前的 `recordings\` 和 `metadata.json`

然後使用上面的「Edge 版除錯 Prompt」。

**第四步：拿到修正版後**

1. AI 會給你修正版的 `.ts` 腳本
2. 用修正版替換原本的腳本檔
3. 重新執行：`.\runtime\node\node.exe .\node_modules\.bin\tsx 腳本名稱.ts`
4. 如果還是失敗，**再重複第一步到第三步**，每次都帶上最新的錯誤訊息和頁面快照

> 💡 **小技巧**：每次除錯時，告訴 AI「這是第幾次嘗試」，並附上前幾次的錯誤訊息，AI 會更容易找到根因。

### 安全提醒

- 不要上傳 `.env` 檔案給 AI（裡面有你的密碼）
- 不要把密碼直接寫在 Prompt 裡
- 不要把整個 Edge 個人資料夾打包上傳
- 不要把不同任務的附件混在一起
- 如果截圖或錄製檔含敏感資訊，先依你們單位規則處理後再帶出

---

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

**固定使用 Microsoft Edge 時，就照 `install.ps1 -> launch-edge.ps1 -> collect.ps1 --browser edge` 這條路走；第一次跑 `collect.ps1 --browser edge` 時，優先選 `1` 互動模式最容易成功。要請 AI 幫忙時，只改 Prompt 裡標成 `【這裡一定要改】` 的地方，其他固定句子先保留，這樣最不容易讓 AI 猜錯。**
