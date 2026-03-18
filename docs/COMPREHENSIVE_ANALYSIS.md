# 全面分析：內部網路網頁素材離線蒐集工具

本文檔提供所有關鍵文件的完整內容分析，特別是與「生成腳本」、「提示工程」、「除錯」、「自動化」和「AI協作」相關的章節。

---

## 一、docs/使用指南.md 結構與內容

### 檔案概況
- **總行數**：621 行
- **主要版本**：針對 Windows 11 + PowerShell 7.x，主要支援 Chrome（也支援 Edge）
- **目標受眾**：一般內網使用者，需要「最短路徑」操作

### 完整章節清單（含行號）

#### 第 1 章（L1-24）：工具選擇理由 — 為何選 Playwright 不選 Selenium
- **關鍵點**：
  - 不靠座標猜位置（脆弱性）
  - 改版或解析度變化時更穩定
  - 少掉 driver 版本配對痛苦
  - 適合蒐集 **ARIA 快照、截圖、錄製檔**

#### 第 2 章（L26-64）：最短 SOP
- **標準 Chrome 流程**（L30-36）：
  ```powershell
  .\install.ps1
  .\launch-chrome.ps1
  .\collect.ps1
  ```
- **Edge 替代流程**（L38-44）：
  ```powershell
  .\install.ps1
  .\launch-edge.ps1
  .\collect.ps1 --browser edge
  ```
- **重要提醒**（L52-53）：如果 install.ps1 失敗，通常是離線包不完整，直接把 `logs\` 最新 `.log` 交給準備者

#### 第 3 章（L67-91）：開始前先看這 4 件事
1. 請拿整個工具資料夾，不要拆散
2. 主線環境是 Windows 11 + PowerShell 7.x
3. 一般使用者不用先研究 npm/npx/Node.js
4. **即使用 Edge，離線包裡也還是要有 `.playwright-browsers\`** ⚠️
   - 這是工具的 Playwright Chromium runtime，不是 branded Edge
   - 真正的 Edge 是系統前置條件

完整離線包檢查清單（L82-90）：
```
- runtime\node\
- node_modules\
- .playwright-browsers\
- install.ps1
- launch-chrome.ps1
- launch-edge.ps1
- collect.ps1
```

#### 第 4 章（L94-303）：我是內網使用者的 3 步操作
- **步驟 1：install.ps1**（L96-100+）
  - 檢查工具包完整性，不是上網安裝
- **步驟 2：啟動瀏覽器**（L標記位置）
  - Chrome 流程 vs Edge 流程
- **步驟 3：蒐集**（L標記位置）
  - 互動模式完整範例（Edge 當例子）

#### 第 5 章（L305-346）：蒐集完成後，去哪裡看結果？

**輸出目錄結構**（L306-329）：
```
materials\
└─ YYYYMMDDhhmmss_任務名稱\
   ├─ aria-snapshots\           # 頁面結構線索（AI 分析的核心）
   ├─ screenshots\              # 畫面截圖
   ├─ recordings\               # 操作錄製檔
   ├─ metadata.json             # 任務基本資訊
   └─ summary-report.md         # 簡短整理
```

### 第 6 章（L349-587）：要請 AI 幫忙時，怎麼講最省事？ 🚀【重點】

#### 核心 4 原則（L351-365）：
1. **先講清楚交付物**
   - 你要新腳本？還是修正版本？
2. **只給同一次任務的附件**
   - 不要混不同日期、網站、頁面的材料
3. **成功標準要寫成看得到的結果**
   - 不要模糊的描述
4. **不知道就寫「不確定」**
   - 不要替 AI 先補腦

#### 關鍵提醒：只改 `【這裡一定要改】` 的地方（L367-380）

**什麼叫「太空泛」？**（L381-403）
```
❌ 太空泛：「幫我寫自動化。」
✅ 精準：「請根據我上傳的同一次任務附件，產生可直接執行的 
  Playwright TypeScript 腳本及使用說明。目標是在 Microsoft Edge 
  已登入狀態下，從案件查詢頁輸入案件編號並打開第一筆明細。成功時，
  畫面要出現查詢結果表格，且 URL 進入案件明細頁。」
```

#### 先準備哪些附件？（L404-416）

**生成腳本時附上**：
- `aria-snapshots\`
- `screenshots\`
- `recordings\`
- `metadata.json`

**除錯時再加上**：
- 目前失敗的腳本檔
- `logs\` 裡相關日誌

#### 生成腳本範本 — 空白版（L418-455）

```text
我現在要請你根據我上傳的同一次任務附件，產生「可直接執行的腳本及使用說明」。

操作環境：
- Windows 11 + PowerShell 7.x
- 目標瀏覽器：【這裡一定要改】Google Chrome / Microsoft Edge / 不確定
- 我已上傳的附件：`aria-snapshots\`、`screenshots\`、`recordings\`、`metadata.json`
  【這裡可補充：如果你另外有上傳其他檔案，就補在這行後面】

我要完成的工作：
【這裡一定要改】例如：登入後開啟「案件查詢」，輸入案件編號，按「查詢」，
再打開第一筆案件明細

成功時我應該能觀察到的結果：
【這裡一定要改】例如：
- 查詢結果表格至少出現 1 筆資料
- 第一筆資料可以被點開
- URL 包含 `/case/detail`

其他我已知的事實：
【這裡一定要改】只寫你 100% 確定的事；例如：附件中有登入後首頁、
案件查詢頁、查詢結果頁。是否需要二次驗證不確定。

請先讀附件，並只根據附件與我明確提供的資訊判斷。
如果附件或我的描述沒有證據，請不要自行假設我已經執行 
`.\launch-chrome.ps1` 或 `.\launch-edge.ps1`、已使用哪一種 `.\collect.ps1` 指令、
已登入網站，或已停在某個頁面；請直接列出缺少的資訊。

請輸出：
1. 你從哪些附件證據理解出流程（請列出檔名、畫面文字、ARIA 線索或錄製步驟）
2. 一份可直接執行的 Playwright TypeScript 腳本
3. 在 Windows 11 + PowerShell 7.x 上的使用說明
4. 執行成功後要怎麼檢查
5. 如果資料還不夠，還缺哪些附件或哪個步驟

請不要把回答改成 npm、npx、Node.js 或 Playwright 安裝教學。
```

#### 生成腳本範本 — 已填好範例（L457-492）

**Microsoft Edge 版本**（L461-492）：
```text
我現在要請你根據我上傳的同一次任務附件，產生「可直接執行的腳本及使用說明」。

操作環境：
- Windows 11 + PowerShell 7.x
- 目標瀏覽器：Microsoft Edge
- 我已上傳的附件：`aria-snapshots\`、`screenshots\`、`recordings\`、`metadata.json`、`logs\`

我要完成的工作：
登入後開啟「案件查詢」，輸入案件編號 `A123456`，按「查詢」，再打開第一筆案件明細。

成功時我應該能觀察到的結果：
- 查詢結果表格至少出現 1 筆資料
- 第一筆資料可以被點開
- 頁面出現案件編號與案件狀態欄位
- URL 包含 `/case/detail`

其他我已知的事實：
附件中有登入後首頁、案件查詢頁、查詢結果頁和明細頁截圖。
錄製檔有查詢到打開第一筆明細的操作。是否需要簡訊驗證不確定。

[按空白版保留相同的要求段落...]
```

#### 除錯範本 — 空白版（L494-537）

```text
我現在要請你根據我上傳的附件，直接修正這份腳本，並提供「可直接執行的腳本及使用說明」。

操作環境：
- Windows 11 + PowerShell 7.x
- 目標瀏覽器：【這裡一定要改】Google Chrome / Microsoft Edge / 不確定
- 我已上傳的附件：目前腳本、`aria-snapshots\`、`screenshots\`、`recordings\`、
  `metadata.json`、`logs\`
  【這裡可補充：如果你另外有上傳其他檔案，就補在這行後面】

我要完成的工作：
【這裡一定要改】例如：在案件查詢頁輸入案件編號後，成功打開第一筆案件明細

失敗發生在：
【這裡一定要改】例如：按下「查詢」之後，腳本等不到結果表格

預期看到的可觀察結果：
【這裡一定要改】例如：
- 結果表格出現至少 1 筆資料
- 第一筆資料可以被點開
- URL 包含 `/case/detail`

實際看到的現象 / 錯誤訊息：
【這裡一定要改】例如：畫面停在查詢頁，log 出現 
`Timeout 30000ms exceeded while waiting for getByRole('button', { name: '查詢' })`

其他我已知的事實：
【這裡一定要改】只寫你 100% 確定的事；例如：附件裡有查詢頁、結果頁、錯誤日誌；
是否是權限問題不確定。

請先讀附件，並只根據附件與我明確提供的資訊判斷。
如果附件或我的描述沒有證據，請不要自行假設我已經執行 `.\launch-chrome.ps1` 或 
`.\launch-edge.ps1`、已使用哪一種 `.\collect.ps1` 指令、已登入網站，或瀏覽器視窗
一路保持開啟；請直接列出缺少的資訊。

請輸出：
1. 最可能的 1 到 3 個原因（每個都附上你引用的附件證據）
2. 可直接替換的修正版 Playwright TypeScript 腳本
3. 在 Windows 11 + PowerShell 7.x 上的使用說明
4. 修正後應檢查的成功訊號
5. 若還要補蒐集，請列出最少需要補哪幾個附件

請不要把回答改成 npm、npx、Node.js 或 Playwright 安裝教學。
```

#### 除錯範本 — 已填好範例（L539-580）

```text
我現在要請你根據我上傳的附件，直接修正這份腳本，並提供「可直接執行的腳本及使用說明」。

操作環境：
- Windows 11 + PowerShell 7.x
- 目標瀏覽器：Microsoft Edge
- 我已上傳的附件：目前腳本、`aria-snapshots\`、`screenshots\`、`recordings\`、
  `metadata.json`、`logs\`

我要完成的工作：
在案件查詢頁輸入案件編號 `A123456` 後，成功打開第一筆案件明細。

失敗發生在：
按下「查詢」之後，腳本沒有等到結果表格就報錯。

預期看到的可觀察結果：
- 結果表格至少出現 1 筆資料
- 第一筆資料可以被點開
- 頁面出現案件編號與案件狀態欄位
- URL 包含 `/case/detail`

實際看到的現象 / 錯誤訊息：
畫面停在查詢頁，`logs\collector.log` 中出現 
`Timeout 30000ms exceeded while waiting for getByRole('button', { name: '查詢' })`。

其他我已知的事實：
附件裡有查詢頁、結果頁、錯誤日誌和現有腳本。錄製檔顯示人工操作可以成功查到資料。
是否和權限或資料量有關不確定。

[按空白版保留相同的要求段落...]
```

#### 安全提醒（L582-586）
- ❌ 不要上傳密碼、token、`.env` 檔案
- ❌ 不要把不同任務的附件混在一起
- ⚠️ 如果截圖或錄製檔含敏感資訊，先依單位規則處理後再帶出

#### 第 7 章（L590-616）：最常見的 3 個問題

1. **`install.ps1` 失敗**（L592-595）
   - 代表離線包不完整
   - 快速解決：把 `logs\` 最新 `.log` 交給準備者

2. **`launch-chrome.ps1` / `launch-edge.ps1` 跑不起來**（L597-605）
   - 檢查：是否在完整工具資料夾裡
   - 檢查：Chrome/Edge 是否已安裝
   - 檢查：一樣把 log 交出

3. **`collect.ps1` 啟動了，但抓不到頁面**（L607-615）
   - 確認用對應的 `launch-*.ps1` 開的瀏覽器
   - 那個瀏覽器視窗有沒有保持開著
   - 有沒有在那個視窗裡登入網站
   - 要抓的頁面是不是已經打開
   - **若用 Edge，指令裡有沒有加上 `--browser edge`**

#### 第 8 章（L619-621）：一句話記住

```
一般使用者只要記住 `install.ps1 -> launch-chrome.ps1 -> collect.ps1`；
如果現場指定用 Edge，就改成 `install.ps1 -> launch-edge.ps1 -> collect.ps1 --browser edge`。
第一次跑 `collect.ps1` 時，優先選 `1` 互動模式最容易成功。
要請 AI 幫忙時，只改 Prompt 裡標成 `【這裡一定要改】` 的地方，
其他固定句子先保留，這樣最不容易讓 AI 猜錯。
```

---

## 二、docs/使用指南-Edge.md 結構與內容

### 檔案概況
- **總行數**：581 行
- **主要版本**：針對 **固定使用 Microsoft Edge** 的內網單位
- **與 Chrome 版的差異**：簡化了流程，只針對 Edge

### 完整章節清單（含行號）

#### 第 1 章（L1-23）：為什麼選 Playwright
- 內容與 Chrome 版幾乎相同，強調 Edge 的適用性

#### 第 2 章（L26-42）：最短 SOP — 3 步做法（L26-39）

```powershell
.\install.ps1
.\launch-edge.ps1
.\collect.ps1 --browser edge
```

#### 第 3 章（L45-68）：開始前先看這 4 件事
1. 請拿整個工具資料夾，不要拆散
2. 主線環境是 Windows 11 + PowerShell 7.x
3. **這台電腦要先有 Microsoft Edge** ⚠️
4. **即使用 Edge，離線包裡也還是要有 `.playwright-browsers\`**

完整離線包檢查清單（L59-66）：
```
- runtime\node\
- node_modules\
- .playwright-browsers\
- install.ps1
- launch-edge.ps1
- collect.ps1
```

#### 第 4 章（L72-264）：Edge 使用者的 3 步做法

- **步驟 1：install.ps1**（L74-86）
  - 檢查工具包完整性
  - 失敗時的 3 步驟（到 logs 找、交給準備者、重新確認包）
- **步驟 2：啟動 Edge 專用視窗**（L88-98）
  - 做 3 件事：登入、打開頁面、保持開著
- **步驟 3：開始蒐集**（L100+）
  - `.\collect.ps1 --browser edge` 指令

#### 第 5 章（L267-306）：蒐集完成後看結果
- 與 Chrome 版幾乎相同的輸出結構

#### 第 6 章（L310-546）：要請 AI 幫忙時 🚀【Edge 版重點】

**核心 4 原則** — 與 Chrome 版相同（L312-326）

**只改 `【這裡一定要改】` 的地方** — 與 Chrome 版相同（L328-340）

**Edge 版生成腳本範本 — 空白版**（L379-416）

```text
我現在要請你根據我上傳的同一次任務附件，產生「可直接執行的腳本及使用說明」。

操作環境：
- Windows 11 + PowerShell 7.x
- 目標瀏覽器：Microsoft Edge
- 我已上傳的附件：`aria-snapshots\`、`screenshots\`、`recordings\`、`metadata.json`
  【這裡可補充：如果你另外有上傳其他檔案，就補在這行後面】

我要完成的工作：
【這裡一定要改】例如：登入後開啟「案件查詢」，輸入案件編號，按「查詢」，
再打開第一筆案件明細

成功時我應該能觀察到的結果：
【這裡一定要改】例如：
- 查詢結果表格至少出現 1 筆資料
- 第一筆資料可以被點開
- URL 包含 `/case/detail`

其他我已知的事實：
【這裡一定要改】只寫你 100% 確定的事；例如：附件中有登入後首頁、案件查詢頁、
查詢結果頁。是否需要二次驗證不確定。

請先讀附件，並只根據附件與我明確提供的資訊判斷。
如果附件或我的描述沒有證據，請不要自行假設我已經執行 `.\launch-edge.ps1`、
已使用 `.\collect.ps1 --browser edge`、已登入網站，或已停在某個頁面；
請直接列出缺少的資訊。

請輸出：
1. 你從哪些附件證據理解出流程（請列出檔名、畫面文字、ARIA 線索或錄製步驟）
2. 一份可直接執行的 Playwright TypeScript 腳本
3. 在 Windows 11 + PowerShell 7.x 上的使用說明
4. 執行成功後要怎麼檢查
5. 如果資料還不夠，還缺哪些附件或哪個步驟

請不要把回答改成 npm、npx、Node.js 或 Playwright 安裝教學。
```

**Edge 版生成腳本範本 — 已填好範例**（L418-452）

```text
我現在要請你根據我上傳的同一次任務附件，產生「可直接執行的腳本及使用說明」。

操作環境：
- Windows 11 + PowerShell 7.x
- 目標瀏覽器：Microsoft Edge
- 我已上傳的附件：`aria-snapshots\`、`screenshots\`、`recordings\`、`metadata.json`、`logs\`

我要完成的工作：
登入後開啟「案件查詢」，輸入案件編號 `A123456`，按「查詢」，再打開第一筆案件明細。

成功時我應該能觀察到的結果：
- 查詢結果表格至少出現 1 筆資料
- 第一筆資料可以被點開
- 頁面出現案件編號與案件狀態欄位
- URL 包含 `/case/detail`

其他我已知的事實：
附件中有登入後首頁、案件查詢頁、查詢結果頁和明細頁截圖。
錄製檔有查詢到打開第一筆明細的操作。是否需要簡訊驗證不確定。

請先讀附件，並只根據附件與我明確提供的資訊判斷。
如果附件或我的描述沒有證據，請不要自行假設我已經執行 `.\launch-edge.ps1`、
已使用 `.\collect.ps1 --browser edge`、已登入網站，或已停在某個頁面；
請直接列出缺少的資訊。

[輸出要求同空白版...]
```

**Edge 版除錯範本 — 空白版**（L455-498）

```text
我現在要請你根據我上傳的附件，直接修正這份腳本，並提供「可直接執行的腳本及使用說明」。

操作環境：
- Windows 11 + PowerShell 7.x
- 目標瀏覽器：Microsoft Edge
- 我已上傳的附件：目前腳本、`aria-snapshots\`、`screenshots\`、`recordings\`、
  `metadata.json`、`logs\`【這裡可補充：如果你另外有上傳其他檔案，
  就補在這行後面】

我要完成的工作：
【這裡一定要改】例如：在案件查詢頁輸入案件編號後，成功打開第一筆案件明細

失敗發生在：
【這裡一定要改】例如：按下「查詢」之後，腳本等不到結果表格

預期看到的可觀察結果：
【這裡一定要改】例如：
- 結果表格出現至少 1 筆資料
- 第一筆資料可以被點開
- URL 包含 `/case/detail`

實際看到的現象 / 錯誤訊息：
【這裡一定要改】例如：畫面停在查詢頁，log 出現 
`Timeout 30000ms exceeded while waiting for getByRole('button', { name: '查詢' })`

其他我已知的事實：
【這裡一定要改】只寫你 100% 確定的事；例如：附件裡有查詢頁、結果頁、錯誤日誌；
是否是權限問題不確定。

請先讀附件，並只根據附件與我明確提供的資訊判斷。
如果附件或我的描述沒有證據，請不要自行假設我已經執行 `.\launch-edge.ps1`、
已使用 `.\collect.ps1 --browser edge`、已登入網站，或 Edge 視窗一路保持開啟；
請直接列出缺少的資訊。

請輸出：
1. 最可能的 1 到 3 個原因（每個都附上你引用的附件證據）
2. 可直接替換的修正版 Playwright TypeScript 腳本
3. 在 Windows 11 + PowerShell 7.x 上的使用說明
4. 修正後應檢查的成功訊號
5. 若還要補蒐集，請列出最少需要補哪幾個附件

請不要把回答改成 npm、npx、Node.js 或 Playwright 安裝教學。
```

**Edge 版除錯範本 — 已填好範例**（L500-539）

```text
我現在要請你根據我上傳的附件，直接修正這份腳本，並提供「可直接執行的腳本及使用說明」。

操作環境：
- Windows 11 + PowerShell 7.x
- 目標瀏覽器：Microsoft Edge
- 我已上傳的附件：目前腳本、`aria-snapshots\`、`screenshots\`、`recordings\`、
  `metadata.json`、`logs\`

我要完成的工作：
在案件查詢頁輸入案件編號 `A123456` 後，成功打開第一筆案件明細。

失敗發生在：
按下「查詢」之後，腳本沒有等到結果表格就報錯。

預期看到的可觀察結果：
- 結果表格至少出現 1 筆資料
- 第一筆資料可以被點開
- 頁面出現案件編號與案件狀態欄位
- URL 包含 `/case/detail`

實際看到的現象 / 錯誤訊息：
畫面停在查詢頁，`logs\collector.log` 中出現 
`Timeout 30000ms exceeded while waiting for getByRole('button', { name: '查詢' })`。

其他我已知的事實：
附件裡有查詢頁、結果頁、錯誤日誌和現有腳本。錄製檔顯示人工操作可以成功查到資料。
是否和權限或資料量有關不確定。

[輸出要求同空白版...]
```

#### 安全提醒（L541-546）
- ❌ 不要上傳密碼、token、`.env` 檔案
- ⚠️ **不要把整個 Edge 個人資料夾打包上傳** ← Edge 特有提醒
- ❌ 不要把不同任務的附件混在一起
- 如果截圖或錄製檔含敏感資訊，先依單位規則處理

#### 第 7 章（L550-576）：最常見的 3 個問題

1. **`install.ps1` 失敗**（L552-555）— 同 Chrome 版
2. **`launch-edge.ps1` 跑不起來**（L557-565）
   - 檢查：完整工具資料夾
   - 檢查：Microsoft Edge 已安裝
   - 檢查：重新執行一次有沒有恢復正常
3. **`collect.ps1 --browser edge` 啟動了，但抓不到頁面**（L567-575）
   - 確認用 `launch-edge.ps1` 開的 Edge 視窗
   - Edge 視窗保持開著
   - 在 Edge 裡登入網站
   - 要抓的頁面已經打開
   - **指令裡真的加上 `--browser edge`**

#### 第 8 章（L579-581）：一句話記住

```
固定使用 Microsoft Edge 時，就照 `install.ps1 -> launch-edge.ps1 -> collect.ps1 --browser edge` 
這條路走；第一次跑 `collect.ps1 --browser edge` 時，優先選 `1` 互動模式最容易成功。
要請 AI 幫忙時，只改 Prompt 裡標成 `【這裡一定要改】` 的地方，其他固定句子先保留，
這樣最不容易讓 AI 猜錯。
```

---

## 三、docs/spec.md 關鍵章節（技術規格）

### 檔案概況
- **總行數**：685 行
- **版本**：v1.5.0（2026-03-15 最後更新）
- **定位**：給維護者、開發者或需要追蹤功能邊界的人

### 核心內容提取

#### 1.1 專案用白話說（L32-48）

```
在內網：
1. 讓任何人（不需程式設計經驗）透過簡單指令把網頁「骨架資料」蒐集下來

帶出到外網：
2. 把蒐集到的骨架資料交給 AI，請 AI 生成自動化腳本

帶回內網：
3. 把 AI 寫好的腳本帶回內網執行，自動完成重複性工作
```

#### 1.2 核心功能（L50-57）

| 功能 | 說明 | 技術 |
|------|------|------|
| 📸 **ARIA 快照蒐集** | 擷取頁面語意結構（AI 分析的核心素材） | Playwright ARIA API |
| 📷 **截圖蒐集** | 擷取頁面視覺截圖 | Playwright Screenshot |
| 🎬 **Codegen 錄製** | 錄製使用者互動流程 | Playwright Codegen |
| 📄 **HTML 原始碼** | 擷取頁面 HTML（可選） | Playwright Content API |

#### 1.3 技術棧（L59-66）

| 層級 | 技術 | 理由 |
|------|------|------|
| 瀏覽器連接 | **Chromium CDP（Debug Protocol）** | 連接到使用者已登入的 Chrome / Edge |
| 自動化引擎 | **Playwright ^1.52.0** | 企業級成熟度、跨平台 |
| 執行環境 | **Node.js v20+ + tsx** | TypeScript 直接執行 |
| 腳本語言 | **TypeScript ^5.7.3** | 型別安全、AI 友善 |

#### 1.4 前置條件（L68-74）

- **OS / Shell**：Windows 11 + PowerShell 7.x
- **Node.js**：v20+（技術人員準備離線包時；一般使用者不要求）
- **瀏覽器**：Chrome 預設；若指定 Edge 模式，內網電腦需已安裝 Microsoft Edge
- **CDP_PORT**：預設 9222
- **Browser 選擇**：CLI `--browser chrome|edge`；設定檔 `"browser": "chrome" | "edge"`

#### 2.1 核心功能需求（L80-89）

**FR-001 到 FR-046 完整列表**（L81-89 摘要）

- **FR-001**：MUST 透過 Playwright `chromium.connectOverCDP()` 連接到使用者已開啟的 Chromium branded browser Debug 模式（Chrome / Edge）
- **FR-002**：MUST 過濾瀏覽器內部頁面（`chrome://`、`edge://`、`devtools://`、`about:blank` 等）
- **FR-003 到 FR-006**：ARIA 快照、截圖、Codegen、HTML 原始碼功能
- **FR-007**：MUST NEVER 呼叫 `browser.close()`——只將 `this.browser = null`
- **FR-046**：支援 `--browser chrome|edge` 與設定檔 `browser` 欄位

#### 2.2 CDP 連線原則（Non-Negotiable）（L91-103）

**三大原則**：

1. **NEVER 強制關閉使用者瀏覽器**
   - 使用 connectOverCDP 時，斷開連接只做 `this.browser = null`
   - 避免中斷使用者工作

2. **過濾瀏覽器內部頁面**
   - `chrome://`、`edge://`、擴充套件頁面、`devtools://`、`about:blank`、`about:srcdoc`
   - 不是使用者頁面

3. **CDP 預存頁面處理**
   - 當 `page.url() === ""` 時，使用 `CDPSession.send('Runtime.evaluate')` 取得真實 URL
   - 自動開新分頁導航

#### 2.3 ARIA-first 工作流（重要設計決策）（L105-131）

**為什麼禁用錄製後自動補抓 URL（T-03 disabled）**（L107-115）

原本設計：錄製完成 → 自動解析 URL → 逐一導航擷取 ARIA

**已停用原因**：

1. **Session 依賴問題**：錄製檔中的 URL 需要登入。自動導航無法保證已登入狀態 → 擷取到登入頁或錯誤頁
2. **Codegen 使用獨立瀏覽器**：Playwright Codegen 啟動自己的瀏覽器視窗；即使主流程附加的是使用者的 Chrome/Edge，Codegen 視窗仍是獨立實例，session/cookie 不共享
3. **不可靠的結果**：即使能導航，擷取到的 ARIA 快照可能不代表使用者實際看到的頁面狀態

**推薦的 ARIA-first 工作流程**（L117-131）

```
❌ 舊流程（已停用）：錄製 → 自動解析 URL → 自動擷取快照

✅ 新流程（ARIA-first）：先互動式擷取 ARIA 快照 → 再錄製 Codegen
```

**步驟**：
1. 使用互動模式（`.\collect.ps1`）逐頁擷取 ARIA 快照與截圖；該次任務輸出統一寫入 `materials\<YYYYMMDDhhmmss_錄製名稱>\`
2. 在頁面蒐集階段的選單中，選擇「切換到錄製階段」
3. 在錄製階段選單中，選擇開始新的錄製
4. 在錄製視窗中操作完整流程，關閉視窗結束錄製
5. 錄製檔自動經過 `sanitizeRecording()` 清理敏感資訊，並儲存於同一任務子資料夾的 `recordings\`

**好處**：先擷取 ARIA 能確保每個頁面的快照都是在已登入、正確狀態下擷取的。

#### 2.4 錄製檔 Sanitize 原則（Non-Negotiable）（L133-153）

**核心規則**：所有敏感資料 **MUST NOT** 以明碼出現在版本庫（repo）或任何產出檔案中

**Sanitize 機制**（L137-141）：

- **FR-032**：錄製結束後系統自動執行 `sanitizeRecording()`，掃描 `.fill()` 呼叫中的密碼欄位
- **FR-033**：`sanitizeRecording()` MUST 在錄製檔開頭加入清理標記 `// ⚠️ 此錄製檔已經過敏感資訊清理`
- **FR-034**：密碼欄位的明文值 MUST 替換為 `process.env.RECORDING_PASSWORD` 佔位符（placeholder），而**不是**將環境變數的實際值寫入檔案

**⚠️ 修正方向說明**（L143-153）

早期實作中 `sanitizeRecording()` 存在漏洞：它會讀取 `process.env.RECORDING_PASSWORD` 的**實際值**並寫入錄製檔，等同於把明碼寫入版本庫。

**正確做法**是將敏感值替換為**字串形式的佔位符**（如字面上的 `process.env.RECORDING_PASSWORD`），讓錄製檔在執行時才動態讀取環境變數。

```typescript
// ❌ 錯誤做法（把實際密碼寫入檔案）：
.fill(selector, '')  // 實際值被展開

// ✅ 正確做法（寫入佔位符字串）：
.fill(selector, process.env.RECORDING_PASSWORD)        // 字面量佔位符
```

#### 2.5 .env 使用指引（L155-190）

**檔案規範**（L157-164）：

| 項目 | 說明 |
|------|------|
| 檔名 | `.env`（位於專案根目錄） |
| 載入機制 | `loadDotEnv()` 函式在程式啟動時讀取，僅在 `process.env` 中不存在該 key 時才設定（不覆蓋已存在的環境變數） |
| 版本控制 | `.env` 已在 `.gitignore` 中，**MUST NOT** 被提交到 Git |
| 範例檔 | 建議提供 `.env.example` |

**.env.example 範例**（L166-179）：

```dotenv
# 內部網路網頁素材蒐集工具 — 環境變數範例
# 複製此檔案為 .env 並填入實際值
# ⚠️ .env 檔案不可提交到 Git（已在 .gitignore 中排除）

# 錄製檔中密碼欄位的替換值（sanitizeRecording 使用）
RECORDING_PASSWORD=

# 自動化腳本憑證（若需要）
NCERT_USERNAME=
NCERT_PASSWORD=
```

**loadDotEnv() 行為**（L182-190）：

```
程式啟動 → loadDotEnv()
  ├── 找到 .env → 逐行解析 KEY=VALUE
  │   └── 若 process.env[KEY] 不存在 → 設定之
  │   └── 若 process.env[KEY] 已存在 → 跳過（不覆蓋）
  └── 找不到 .env → 靜默跳過（不報錯）
```

#### 2.6 操作模式（L192-197）

- **FR-008**：互動模式（一步一步引導蒐集），每次執行 `.\collect.ps1` 時以新的任務子資料夾承載本次蒐集成果
- **FR-009**：自動模式（依設定檔批次蒐集）
- **FR-010**：快照模式（快速擷取當前頁面）
- **FR-011**：錄製模式（直接啟動 Codegen），錄製輸出寫入本次 `.\collect.ps1` 的任務子資料夾

#### 2.7 優雅關閉（Graceful Shutdown）（L199-205）

- **FR-024**：系統 MUST 攔截 SIGINT（Ctrl+C）和 SIGTERM 信號
- **FR-025**：收到中斷信號時，系統 MUST 透過 `requestShutdown()` 設定 `isShuttingDown = true`
- **FR-026**：系統 MUST 保證 `finally` 區塊執行，確保 `saveMetadata()` 與 `disconnect()` 在中斷時仍能完成

#### 2.8 輸出格式（L206-211）

- **FR-012**：保留 `materials/` 作為輸出根目錄，每次執行 `.\collect.ps1` 時建立 `materials\<YYYYMMDDhhmmss_錄製名稱>\` 任務子資料夾
- **FR-013**：在該任務子資料夾根目錄輸出 `metadata.json` 與 `summary-report.md`
- **FR-014**：ARIA 快照 MUST 包含頁面 URL、標題、擷取時間、專案名稱等 header 資訊
- **FR-044**：`aria-snapshots\`、`screenshots\`、`recordings\` 等既有輸出目錄 MUST 位於對應任務子資料夾下

#### 2.11 安全需求（L236-239）

- **FR-027**：原始碼與錄製檔中 MUST NOT 包含明文憑證，應使用環境變數或 .env 檔案
- **FR-028**：`.gitignore` MUST 包含 `.env`、`logs/`、`materials/`、`chrome-debug-profile/`、`edge-debug-profile/`

#### 3.1 時區標準（L245-256）

本專案統一使用 **Asia/Taipei (UTC+8)** 作為所有時間戳記的時區標準

| 用途 | 函式 / 規則 | 格式 | 範例 |
|------|-------------|------|------|
| 任務輸出子資料夾 | 以 Asia/Taipei 14 碼時間戳 + 錄製名稱組成 | `YYYYMMDDhhmmss_錄製名稱` | `20260310143000_登入流程` |
| 日誌行、metadata.json | `getTaipeiISO()` | `YYYY-MM-DDTHH:mm:ss+08:00` | `2026-02-10T14:30:00+08:00` |
| 檔名後綴（log、runId） | `getTaipeiTimestampForFile()` | `YYYYMMDD-HHmmss` | `20260210-143000` |
| 顯示用 | `getTaipeiTime()` | 台灣地區格式 | `2026/2/10 下午2:30:00` |

#### 3.4 metadata.json 規範（L279-282）

- **FR-029**：`metadata.json` MUST 包含以下欄位：
  - `projectName`
  - `description`
  - `browser`
  - `browserVersion`
  - `collectedAt`
  - `timezone`
  - `toolVersion`
  - `platform`
  - `nodeVersion`
  - `playwrightVersion`
  - `logFile`
  - `totalPages`
  - `collectedPages`
  - `recordings`
  - `errors`

- **FR-030**：`metadata.json` 的 `timezone` 欄位 MUST 為 `Asia/Taipei (UTC+8)`，所有時間戳記 MUST 使用 `getTaipeiISO()` 產生

#### 4.2 Pre-commit 掃描機制（L296-311）

- **FR-037**：`.githooks/pre-commit` MUST 在 git commit 時呼叫 `scripts/pre-commit-scan.ps1` 掃描 `materials\<任務子資料夾>\recordings\*.ts`
- **FR-038**：掃描以下模式，偵測到匹配時 MUST 以 exit code 1 阻止 commit：

| 掃描模式 | 說明 |
|---------|------|
| `.fill(selector, 'non-empty-password')` | 密碼欄位的明文值 |
| `password = 'xxx' / password: 'xxx'` | 密碼變數賦值 |
| `token = 'xxx' / token: 'xxx'` | Token 明文 |
| `secret = 'xxx' / secret: 'xxx'` | Secret 明文 |

#### User Story 1 - 互動式蒐集內部網站素材（L377-388）

作為一位需要將內部網站素材帶到外部環境讓 AI 分析的使用者，我希望工具能引導我一步一步蒐集每個頁面的 ARIA 快照和截圖

**驗收情境**（5 點）：
1. 使用者選擇的 Chrome 或 Edge 已以 Debug 模式啟動並登入內部網站，執行 `.\collect.ps1` 並選擇互動模式 → 系統連接、準備任務子資料夾、顯示兩階段說明
2. 系統已連接，使用者輸入頁面名稱和描述 → 系統自動擷取 ARIA 快照和截圖
3. 已蒐集一個頁面，使用者透過數字選單選擇下一步 → 系統能明確切換到「繼續蒐集 / 進入錄製 / 結束」
4. 使用者要從頁面蒐集切到流程錄製 → 系統不需要重新啟動、不需要依賴 Ctrl+C
5. 使用者選擇結束蒐集 → 系統在同一任務子資料夾根目錄儲存 metadata.json 和 summary-report.md、安全斷開連接

#### User Story 2 - 錄製互動流程（L389-402）

作為一位需要記錄登入操作或表單填寫流程的使用者，我希望工具能啟動 Playwright Codegen 錄製我的操作

**驗收情境**（6 點）：
1. 在互動模式中蒐集了頁面素材，使用者切換到錄製階段並選擇開始新的錄製 → 系統提示輸入錄製名稱和起始 URL
2. 使用者確認開始錄製 → 系統啟動 Codegen、開啟新的瀏覽器視窗
3. Codegen 正在錄製，使用者關閉錄製視窗 → 系統將錄製結果儲存到任務子資料夾的 `recordings\` 目錄
4. 錄製在 Windows 環境執行，啟動 Codegen → 使用 `cmd.exe /d /s /c` 包裝命令
5. 錄製檔已儲存，包含 `.fill()` 呼叫 → 系統自動執行 `sanitizeRecording()` 將明文密碼替換為佔位符
6. 錄製完成，使用者回到 CLI → 系統提供清楚的後續選單

#### User Story 3 - 快照模式快速擷取（L404-408）

**驗收情境**（2 點）：
1. 使用者選擇的 Chrome 或 Edge 已以 Debug 模式啟動並瀏覽目標頁面，執行快照模式 → 系統自動擷取當前頁面的 ARIA 快照和截圖
2. 頁面包含 iframe → 系統遞迴擷取所有 iframe 的 ARIA 快照（最深 3 層）

#### User Story 4 - 自動模式批次蒐集（L410-414）

#### User Story 5 - 瀏覽器 Debug 模式啟動（L416-421）

作為技術人員，我希望工具能正確啟動瀏覽器的 Debug 模式並偵測端口衝突

**驗收情境**（3 點）：
1. Google Chrome 或 Microsoft Edge 已安裝，執行對應的啟動腳本 → 啟動使用獨立 profile 的瀏覽器並開啟 CDP 端口 9222
2. 端口 9222 已被一般 Chrome / Edge 佔用 → 偵測到非 debug 瀏覽器並提示使用者處理
3. Debug Chrome / Edge 已在運行 → 偵測到已運行的 debug 瀏覽器並顯示下一步指引

#### 成功標準（L439-452）

| 編號 | 標準 |
|------|------|
| SC-001 | 使用者執行 `.\install.ps1` 即可完成環境安裝或檢查，無需手動輸入 npm |
| SC-002 | 使用者執行 `.\launch-chrome.ps1` / `.\launch-edge.ps1` 即可啟動對應 Debug 模式 |
| SC-003 | 互動模式下蒐集 ARIA 快照和截圖的成功率達 95% 以上 |
| SC-004 | Codegen 錄製在 Windows 11 + Node.js v20+ 環境下正常啟動 |
| SC-005 | 所有錯誤都記錄在 log 檔案和 metadata.json 中 |
| SC-006 | Chrome / Edge 內部頁面被正確過濾 |
| SC-007 | 使用者按 Ctrl+C 後，metadata.json 與 summary-report.md 仍能正確寫入 |
| SC-008 | `.gitignore` 包含 `.env` 與 `logs/`，敏感資料不被提交 |
| SC-009 | 錄製檔經過 sanitize 後不含明文密碼 |
| SC-010 | pre-commit hook 能阻止含敏感資訊的錄製檔被 commit |

---

## 四、README.md（快速導覽與專案介紹）

### 檔案概況
- **角色**：專案介紹與快速導覽（不是詳細操作手冊）
- **目標受眾**：第一次認識這個專案的人

### 關鍵內容

#### 專案解決的問題（L9-26）

很多內部網站只能在公司內網使用，但真正要整理自動化腳本、分析流程或請 AI 協助時，往往是在外部環境進行。

**落差**：
- 內網裡有真實頁面、登入狀態與操作流程
- 外部環境有 AI、分析工具與整理能力
- 但兩邊通常不能直接互通

**任務**：
1. 在內網蒐集頁面素材
2. 把素材帶到外部環境分析
3. 讓 AI 協助整理成自動化腳本
4. 再把腳本帶回內網驗證與執行

#### 專案運作方式（L28-56）

**兩個主要角色**：

1. **準備者（有網路的電腦）**
   ```powershell
   .\scripts\prepare-offline-bundle.ps1
   ```
   - 在可上網的 Windows 電腦上準備完整工具包
   - 包含 runtime、node_modules、Playwright Chromium runtime

2. **內網使用者（拿到完整工具包的人）**
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

#### 核心能力（L81-99）

1. **ARIA 快照蒐集**：把頁面的語意結構存下來
2. **截圖蒐集**：把頁面當下畫面保存成圖片
3. **Codegen 錄製**：錄下使用者實際的操作過程
4. **可選 HTML 原始碼輸出**：在需要時保留 HTML 原始碼
5. **敏感資訊保護**：錄製檔會經過清理流程
6. **摘要報告與問題紀錄**：每次任務都會留下 metadata.json、summary-report.md 與日誌

#### 快速開始（L101-143）

**我是準備者**：
```powershell
.\scripts\prepare-offline-bundle.ps1
```
打包完成後，把**整個產出的資料夾**交給內網使用者

**我是內網使用者**：
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

**`collect.ps1` 常見模式**（L129-142）：
```powershell
.\collect.ps1                              # 互動模式，適合大多數使用情境
.\collect.ps1 --snapshot                   # 快速擷取目前頁面
.\collect.ps1 --auto                       # 依設定檔自動執行蒐集
.\collect.ps1 --record 登入流程            # 直接進入錄製模式
.\collect.ps1 --config .\collect-materials-config.json  # 指定設定檔執行
```

#### 產出內容 / 結果結構（L146-168）

```text
materials\
└─ YYYYMMDDhhmmss_任務名稱\
   ├─ aria-snapshots\
   ├─ screenshots\
   ├─ recordings\
   ├─ metadata.json
   └─ summary-report.md
```

常見內容用途：
- `aria-snapshots\`：頁面語意結構快照
- `screenshots\`：畫面截圖
- `recordings\`：互動錄製檔
- `metadata.json`：本次任務的結構化紀錄
- `summary-report.md`：本次任務的摘要整理

#### 技術架構 / 技術棧摘要（L170-189）

核心做法：透過 **Chromium branded browser 的 CDP（Debug Protocol）** 連接到已登入的瀏覽器（Chrome / Edge），再由 Playwright 負責蒐集頁面素材

**主要技術**：
- **Chromium CDP（Debug Protocol）**：連接已登入的 Chrome / Edge 工作階段
- **Playwright ^1.52.0**：負責快照、截圖與錄製能力
- **TypeScript ^5.7.3**：主要程式語言
- **Node.js >=20.0.0**：執行環境要求
- **PowerShell 7.x**：Windows 主要操作入口

**架構重點**：
- 離線優先
- ARIA-first
- 任務資料夾隔離
- 不強制關閉使用者瀏覽器
- Edge 視為系統前置需求
- 內網情境導向

#### 安全與限制（L191-207）

**安全考量**：
- 不要把帳號、密碼、token、`.env` 等敏感資訊一起帶出內網
- 帶出截圖、HTML 或錄製檔前，仍應人工確認是否含有敏感畫面
- 若要交給 AI 或外部維護者，建議以**同一次任務資料夾**為單位整理
- 版本庫與錄製檔應避免保存明文敏感資訊

**已知限制**：
- 素材蒐集工具，不是最終腳本生成器
- 需要先啟動可連接的瀏覽器 Debug 視窗
- 主要目標環境是 Windows 11 + PowerShell 7.x
- 離線使用依賴事先準備好的完整工具包
- 若要使用 Edge，內網電腦必須已安裝 Microsoft Edge
- 遇到高度動態或特殊權限頁面時，仍可能需要人工補充說明與判讀

---

## 五、collect-materials.ts（主程式）

### 檔案概況
- **總行數**：2531 行
- **用途**：主要自動化入口點
- **語言**：TypeScript（ESM 模組）

### 關鍵部分提取

#### 檔案頭部註釋（L1-23）

```typescript
/**
 * 🏗️ 內部網路網頁素材離線蒐集工具 v1.0.0
 *
 * 完全離線運作，不需要任何網際網路連線。
 * 連接到已開啟 CDP Debug 模式的 Chromium branded browser（Chrome / Edge），自動蒐集：
 *   1. ARIA 快照（頁面語意結構 — AI 分析的核心素材）
 *   2. 截圖（視覺參考）
 *   3. Codegen 錄製（互動流程記錄）
 *   4. HTML 原始碼（可選）
 *   5. iframe 深層結構（自動遞迴）
 *
 * Windows 一般使用者：
 *   .\collect.ps1
 *   .\collect.ps1 --auto
 *   .\collect.ps1 --snapshot
 *   .\collect.ps1 --record <name>
 *   .\collect.ps1 --config <path>
 *
 * 技術人員也可維持：
 *   npm run collect -- --auto
 *
 * 目標環境：Windows 11 + PowerShell 7.x（也支援 macOS / Linux）
 */
```

#### 型別定義（L34-166）

**主要型別**：
- `BrowserBrand = 'chrome' | 'edge'`
- `BrowserDefinition`：瀏覽器定義（執行檔路徑、啟動腳本等）
- `CollectConfig`：蒐集設定
- `PageTarget`：頁面目標
- `PageAction`：頁面動作
- `InteractiveFlow`：互動流程
- `MaterialMetadata`：素材中繼資料
- `PageMetadata`：頁面中繼資料
- `RecordingMetadata`：錄製中繼資料
- `ErrorRecord`：錯誤記錄

#### 時間相關函式（L216-256）

```typescript
// 台北時間
function getTaipeiTime(): string
function getTaipeiDateParts(): { year, month, day, hours, minutes, seconds }
function getTaipeiISO(): string  // YYYY-MM-DDTHH:mm:ss+08:00
function getTaipeiTimestampForFile(): string  // YYYYMMDD-HHmmss
```

#### 主程式入口（L2348-2515）

**CLI 參數解析**：
```typescript
const args = process.argv.slice(2);
let configPath = DEFAULT_CONFIG_PATH;
let autoMode = false;
let snapshotMode = false;
let recordMode = false;
let recordName = '';
let browserArg: BrowserBrand | null = null;
let cdpPortArg: number | null = null;

// 解析 --auto, --snapshot, --record, --browser, --port, --config
```

**模式選擇**（L2389-2515）：

1. **設定檔模式** (`--config`)：從設定檔讀取 `pages` 列表，逐一蒐集
2. **快照模式** (`--snapshot`)：快速擷取當前頁面
3. **錄製模式** (`--record <name>`)：直接啟動 Codegen
4. **自動模式** (`--auto`)：依設定檔自動蒐集
5. **互動選單模式**（預設）：
   - 提供 4 個選擇：互動、自動、快照、錄製
   - 各模式會建立對應的 `CollectConfig`
   - 建立 `MaterialCollector` 實例並執行對應方法

#### 互動選單（L2403-2514）

```
請選擇蒐集模式：

[1] 📸 互動模式（推薦新手）- 一步一步引導你蒐集
[2] 🤖 自動模式 - 依設定檔自動蒐集所有頁面
[3] ⚡ 快照模式 - 快速擷取當前頁面
[4] 🎬 錄製模式 - 啟動 Codegen 錄製互動流程
```

#### 錯誤處理（L2517-2531）

```typescript
main().catch(error => {
  const detail = formatError(error);
  logError(`未預期的錯誤: ${detail.message}`, error);
  log('💡', '疑難排解：', 'WARN');
  log('💡', '  1. 確認瀏覽器已以 Debug 模式啟動...', 'WARN');
  log('💡', '  2. 確認 CDP 端口（預設 9222）沒有被佔用', 'WARN');
  log('💡', '  3. 確認專案已包含 node_modules 與 Playwright 瀏覽器', 'WARN');
  log('💡', '  4. Windows 一般使用者請回到專案根目錄執行 .\\collect.ps1', 'WARN');
  process.exit(1);
});
```

---

## 六、package.json（依賴與腳本）

```json
{
  "name": "web-material-collector",
  "version": "1.0.0",
  "description": "內部網路網頁素材離線蒐集工具 — 完全離線運作，不需要網際網路",
  "type": "module",
  "engines": {
    "node": ">=20.0.0"
  },
  "scripts": {
    "collect": "npx tsx collect-materials.ts",
    "collect:auto": "npx tsx collect-materials.ts --auto",
    "collect:snapshot": "npx tsx collect-materials.ts --snapshot",
    "collect:record": "npx tsx collect-materials.ts --record",
    "setup": "node scripts/run-setup.mjs",
    "setup:offline": "node scripts/run-setup.mjs --offline",
    "start:chrome": "node scripts/run-launch-browser.mjs --browser chrome",
    "start:browser": "node scripts/run-launch-browser.mjs",
    "start:edge": "node scripts/run-launch-browser.mjs --browser edge"
  },
  "keywords": ["automation", "playwright", "offline", "material-collector"],
  "license": "MIT",
  "dependencies": {
    "playwright": "^1.52.0"
  },
  "devDependencies": {
    "@types/node": "^20.17.10",
    "tsx": "^4.19.0",
    "typescript": "^5.7.3"
  }
}
```

#### npm 腳本說明

| 腳本 | 用途 | 對應 PowerShell |
|------|------|---------|
| `npm run collect` | 互動模式 | `.\collect.ps1` |
| `npm run collect:auto` | 自動模式 | `.\collect.ps1 --auto` |
| `npm run collect:snapshot` | 快照模式 | `.\collect.ps1 --snapshot` |
| `npm run collect:record` | 錄製模式 | `.\collect.ps1 --record` |
| `npm run setup` | 環境設定 | `.\setup.ps1` |
| `npm run setup:offline` | 離線環境設定 | `.\setup.ps1 --offline` |
| `npm run start:chrome` | 啟動 Chrome Debug | `.\launch-chrome.ps1` |
| `npm run start:edge` | 啟動 Edge Debug | `.\launch-edge.ps1` |

---

## 七、tsconfig.json（TypeScript 設定）

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "lib": ["ES2022", "DOM"],
    "moduleResolution": "node",
    "rootDir": ".",
    "outDir": "./dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "sourceMap": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "allowSyntheticDefaultImports": true
  },
  "include": ["*.ts", "src/**/*.ts"],
  "exclude": ["node_modules", "dist", "materials"]
}
```

#### 關鍵設定

- **target / module**：ES2022（支援 `import.meta.url` 等最新特性）
- **moduleResolution**：node（Node.js 模組解析）
- **strict**：true（嚴格型別檢查）
- **skipLibCheck**：true（跳過 .d.ts 檢查，加快編譯）
- **exclude**：排除 node_modules、dist、materials 資料夾

---

## 八、collect-materials-config.json（蒐集設定範例）

```json
{
  "projectName": "my-intranet-automation",
  "description": "內部網路網頁自動化素材蒐集設定（請修改為你的實際系統名稱和網址）",
  "browser": "chrome",
  "cdpPort": 9222,
  "outputDir": "./materials",
  "collectOptions": {
    "ariaSnapshot": true,
    "screenshot": true,
    "codegenRecording": true,
    "htmlSource": false,
    "iframeDepth": 3
  },
  "pages": [
    {
      "name": "01-login-page",
      "url": "http://your-internal-site/login",
      "description": "登入頁面（請修改為你的實際網址）",
      "waitFor": "networkidle",
      "actions": []
    },
    {
      "name": "02-dashboard",
      "url": "http://your-internal-site/dashboard",
      "description": "首頁儀表板（請修改為你的實際網址）",
      "waitFor": "networkidle",
      "actions": []
    },
    {
      "name": "03-form-page",
      "url": "http://your-internal-site/form",
      "description": "表單頁面（請修改為你的實際網址）",
      "waitFor": "networkidle",
      "actions": []
    }
  ],
  "interactiveFlows": [
    {
      "name": "login-flow",
      "description": "登入流程錄製",
      "startUrl": "http://your-internal-site/login",
      "instructions": "請在瀏覽器中操作登入流程，完成後按 Ctrl+C 結束錄製"
    }
  ]
}
```

#### 設定說明

- **projectName**：專案名稱
- **browser**：`"chrome"` 或 `"edge"`
- **cdpPort**：CDP Debug 端口（預設 9222）
- **outputDir**：輸出根目錄（預設 `./materials`）
- **collectOptions**：
  - `ariaSnapshot`：是否蒐集 ARIA 快照
  - `screenshot`：是否蒐集截圖
  - `codegenRecording`：是否啟用 Codegen 錄製
  - `htmlSource`：是否蒐集 HTML 原始碼
  - `iframeDepth`：iframe 遞迴深度（0-10，預設 3）
- **pages**：頁面列表（自動模式使用）
  - `name`：頁面標識
  - `url`：目標 URL
  - `description`：頁面描述
  - `waitFor`：等待條件（`load` / `domcontentloaded` / `networkidle` / `commit`）
  - `actions`：頁面操作（可選）
- **interactiveFlows**：互動流程列表（用於 Codegen 錄製）

---

## 九、核心設計原則與架構

### ARIA-First 工作流（關鍵）

```
❌ 舊流程（已停用）：
  錄製 → 自動解析 URL → 自動擷取快照
  
  問題：
  - Session 不共享（Codegen 使用獨立瀏覽器）
  - 無法保證已登入狀態
  - 可能擷取到錯誤頁面

✅ 新流程（推薦）：
  先互動式擷取 ARIA 快照 & 截圖 → 再錄製 Codegen
  
  優勢：
  - 確保每個頁面快照都在已登入、正確狀態下擷取
  - 先有清晰的 ARIA 結構 → AI 更容易理解
  - 再錄製操作流程 → 補足互動線索
```

### 離線套件組成

```
完整離線包結構：
├── runtime\node\               # 內建 Node.js runtime
├── node_modules\               # 依賴（Playwright 等）
├── .playwright-browsers\       # Playwright Chromium runtime
├── install.ps1                 # 一般使用者檢查器
├── launch-chrome.ps1           # Chrome Debug 啟動
├── launch-edge.ps1             # Edge Debug 啟動
├── collect.ps1                 # 蒐集主入口
├── collect-materials.ts        # 主程式
├── collect-materials-config.json  # 蒐集設定
├── package.json
├── tsconfig.json
├── README.md
├── docs\
│   ├── 使用指南.md
│   ├── 使用指南-Edge.md
│   └── spec.md
└── scripts\                    # PowerShell / Shell 輔助腳本
```

### Prompt 工程核心原則

1. **標記區別**：
   - `【這裡一定要改】`：必須根據實際情況修改
   - `【這裡可補充】`：知道就補，不知道可留預設或寫「不確定」
   - 其他固定句子：**先不要改**

2. **4 大核心要求**：
   - **只根據附件與明確事實判斷**（不要 AI 自己猜）
   - **不要假設已登入、已執行哪個命令、已停在哪頁**
   - **缺少資訊時直接列出缺少的內容**
   - **輸出必須是腳本 + 使用說明 + 成功檢查方式**

3. **附件清單**：
   - **生成新腳本時**：`aria-snapshots\`、`screenshots\`、`recordings\`、`metadata.json`
   - **除錯既有腳本時**：再加上失敗的腳本檔、`logs\` 相關日誌

### 敏感資訊保護機制

```typescript
// ❌ 錯誤做法：把實際密碼寫入錄製檔
.fill(selector, 'actualPassword123')

// ✅ 正確做法：寫入佔位符，執行時動態讀取
.fill(selector, process.env.RECORDING_PASSWORD)
```

- **.env 檔案**：已在 `.gitignore` 中，不會被 commit
- **Pre-commit Hook**：掃描錄製檔，檢查明文密碼 / token / secret
- **自動清理**：`sanitizeRecording()` 在錄製完成後自動執行

---

## 十、總結與最佳實踐

### 對一般內網使用者的建議

1. **第一次操作**：
   - 按 `install.ps1 -> launch-chrome.ps1 (或 launch-edge.ps1) -> collect.ps1` 的流程
   - 選擇 **互動模式 [1]**（最容易成功）
   - 優先蒐集 ARIA 快照 & 截圖，再進入錄製階段

2. **要請 AI 幫忙時**：
   - **一定要改** `【這裡一定要改】` 的 3 個地方：瀏覽器、工作內容、成功標準
   - **只給同一次任務的附件**（不要混雜）
   - **不知道就寫「不確定」**（不要替 AI 補腦）

3. **除錯時**：
   - 上傳目前失敗的腳本、`logs\` 裡最新的日誌、`aria-snapshots\`、`screenshots\`
   - 清楚說明「失敗發生在哪一步」、「預期看到的結果」、「實際看到的現象」
   - 只上傳本次任務的完整材料

### 對技術人員的建議

1. **準備離線包**：
   ```powershell
   .\scripts\prepare-offline-bundle.ps1
   ```
   - 檢查 `runtime\node\`、`node_modules\`、`.playwright-browsers\` 是否完整
   - 交給內網使用者時，一定要交整個資料夾

2. **啟用 Git Hooks**（保護敏感資訊）：
   ```powershell
   git config core.hooksPath .githooks
   ```

3. **密碼安全**：
   - 創建 `.env` 檔案（已在 `.gitignore` 中）
   - 定義 `RECORDING_PASSWORD`、`NCERT_USERNAME`、`NCERT_PASSWORD` 等
   - 錄製檔會自動替換為佔位符

4. **Edge 支援**：
   - CLI: `--browser edge`，設定檔: `"browser": "edge"`
   - 確保內網電腦已安裝 Microsoft Edge
   - 離線包仍要包含 `.playwright-browsers\`（Playwright Chromium runtime）

### 關鍵術語對照

| 術語 | 說明 |
|------|------|
| **CDP** | Chromium Debug Protocol，用於連接已開啟 Debug 模式的瀏覽器 |
| **ARIA 快照** | 頁面語意結構，AI 分析的核心素材 |
| **Codegen 錄製** | Playwright 提供的錄製工具，可記錄使用者操作轉成腳本 |
| **ARIA-first** | 先蒐集頁面快照，再錄製操作流程 |
| **任務子資料夾** | `materials\YYYYMMDDhhmmss_任務名稱\`，每次執行 `collect.ps1` 時建立 |
| **metadata.json** | 任務的結構化紀錄（頁面數、錯誤、時間戳等） |
| **summary-report.md** | 任務的摘要報告 |
| **Sanitize** | 清理敏感資訊（密碼、token 等） |

---

**文檔完成日期**：2025 年（本分析基於 v1.5.0 規格）
