# 內部網路網頁素材蒐集工具使用指南（Edge 版）

> 這份文件是給 **固定使用 Microsoft Edge 的內網單位**。
> 目標只有一件事：**讓你用最短路徑完成 Edge 蒐集流程**。
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
- `install.ps1`
- `launch-edge.ps1`
- `collect.ps1`

一般使用者只要照 `install.ps1 -> launch-edge.ps1 -> collect.ps1 --browser edge` 這條路走就好，不需要先研究 npm / npx / Node.js。

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

先記住 3 個原則：

1. **優先上傳附件，不要把長內容整段貼進對話框**
2. **成功標準要寫成「看得到的結果」**，例如：網址變成哪一頁、畫面出現哪句話、表格出現哪個欄位、下載了哪個檔案
3. **不知道的事就寫「不確定」**，不要把 AI 不知道的事先當成已知事實

### 先準備哪些附件？

如果你要請 AI **生成腳本**，建議附上同一次任務的：

- `aria-snapshots\`
- `screenshots\`
- `recordings\`
- `metadata.json`

如果你要請 AI **除錯**，再加上：

- 目前失敗的腳本檔
- `logs\` 裡相關日誌

### Edge 版生成腳本範本

先上傳附件，再貼上下面這段：

```text
我現在要請你根據我上傳的同一次任務附件，產生「可直接執行的腳本及使用說明」。

操作環境：
- Windows 11 + PowerShell 7.x
- 目標瀏覽器：Microsoft Edge
- 我已上傳的附件：`aria-snapshots\`、`screenshots\`、`recordings\`、`metadata.json`（以及其他我附上的檔案）

我要完成的工作：
【請填】

成功時我應該能觀察到的結果：
【請填可觀察結果，例如：畫面出現「查詢完成」、URL 變成某頁、表格出現某欄、下載 `report.xlsx`】

其他我已知的事實：
【請填你確定知道的事實；不知道就寫「不確定」】

請先讀附件，並只根據附件與我明確提供的資訊判斷。
如果附件或我的描述沒有證據，請不要自行假設我已經執行 `.\launch-edge.ps1`、已使用 `.\collect.ps1 --browser edge`、已登入網站，或已停在某個頁面；請直接列出缺少的資訊。

請輸出：
1. 你從哪些附件證據理解出流程（請列出檔名、畫面文字、ARIA 線索或錄製步驟）
2. 一份可直接執行的 Playwright TypeScript 腳本
3. 在 Windows 11 + PowerShell 7.x 上的使用說明
4. 執行成功後要怎麼檢查
5. 如果資料還不夠，還缺哪些附件或哪個步驟

請不要把回答改成 npm、npx、Node.js 或 Playwright 安裝教學。
```

### Edge 版除錯範本

先上傳附件，再貼上下面這段：

```text
我現在要請你根據我上傳的附件，直接修正這份腳本，並提供「可直接執行的腳本及使用說明」。

操作環境：
- Windows 11 + PowerShell 7.x
- 目標瀏覽器：Microsoft Edge
- 我已上傳的附件：目前腳本、`aria-snapshots\`、`screenshots\`、`recordings\`、`metadata.json`、`logs\`（以及其他我附上的檔案）

我要完成的工作：
【請填】

失敗發生在：
【請填】

預期看到的可觀察結果：
【請填】

實際看到的現象 / 錯誤訊息：
【請填】

其他我已知的事實：
【請填你確定知道的事實；不知道就寫「不確定」】

請先讀附件，並只根據附件與我明確提供的資訊判斷。
如果附件或我的描述沒有證據，請不要自行假設我已經執行 `.\launch-edge.ps1`、已使用 `.\collect.ps1 --browser edge`、已登入網站，或 Edge 視窗一路保持開啟；請直接列出缺少的資訊。

請輸出：
1. 最可能的 1 到 3 個原因（每個都附上你引用的附件證據）
2. 可直接替換的修正版 Playwright TypeScript 腳本
3. 在 Windows 11 + PowerShell 7.x 上的使用說明
4. 修正後應檢查的成功訊號
5. 若還要補蒐集，請列出最少需要補哪幾個附件

請不要把回答改成 npm、npx、Node.js 或 Playwright 安裝教學。
```

### 安全提醒

- 不要上傳密碼、token、`.env` 檔案
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

**固定使用 Microsoft Edge 時，就照 `install.ps1 -> launch-edge.ps1 -> collect.ps1 --browser edge` 這條路走；Edge 本體是目標電腦已安裝好的前置條件，不會打包在離線包裡，但離線包裡的 `.playwright-browsers\` 一樣不能少。如果 `install.ps1` 失敗，先把 `logs\` 最新 `.log` 交給準備者，不要先跳去研究 npm、npx、Node.js 或 Playwright 安裝。**
