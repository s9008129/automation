# 內部網路網頁素材蒐集工具使用指南（Edge 版）

> 這份手冊是給 **固定使用 Microsoft Edge 的內網單位**。
> 如果你只想先把事情做完，先看第 1 節就好。
>
> 以下說明以 **Windows 11 + PowerShell 7.x** 為主，盡量用白話方式寫。
> 這份文件只講 Edge 流程；如果你想看整體總覽，請回到 [`使用指南.md`](使用指南.md)。

## 1. 最短版本：先照這 3 步做

請照這個順序執行：

```powershell
.\install.ps1
.\launch-edge.ps1
.\collect.ps1 --browser edge
```

順序不要換，白話說就是：

1. `install.ps1`
   - 先檢查你拿到的離線工具包是不是完整可用
2. `launch-edge.ps1`
   - 打開專門給這個工具使用的 Microsoft Edge 視窗
3. `collect.ps1 --browser edge`
   - 開始蒐集頁面素材

> 如果第 1 步 `install.ps1` 失敗，通常不是你操作錯了，而是 **離線包不完整**。
> 請不要自己研究 npm、Node.js、Playwright 安裝或套件問題。
> 最快的做法是把 `logs\` 裡最新的 `.log` 檔交給幫你準備工具包的人處理。

---

## 2. 先確認：你拿到的是完整離線包

你手上應該拿到的是 **整個工具資料夾**，不是只有幾支 `.ps1` 檔案。

### 2.1 正確拿法

請這樣做：

- 拿到完整資料夾後，再開始操作
- 如果對方給你的是 zip，請先完整解壓縮
- 把整個資料夾放在你有權限操作的位置，例如桌面、文件夾或工作磁碟

請不要這樣做：

- 不解壓縮就直接從壓縮檔裡執行
- 只把 `install.ps1`、`launch-edge.ps1`、`collect.ps1` 抽出來單獨放
- 把整個資料夾拆散後再自己重組

### 2.2 完整離線包通常至少要有這些內容

- `runtime\node\`
- `node_modules\`
- `.playwright-browsers\`
- `install.ps1`
- `launch-edge.ps1`
- `collect.ps1`
- 其他專案執行需要的設定檔與腳本

### 2.3 很重要：為什麼用 Edge，離線包裡還是要有 `.playwright-browsers\`？

這個資料夾一樣要在離線包裡，**不能因為你們現場用 Edge 就拿掉**。

原因很簡單：

- `.playwright-browsers\` 是這個工具自己的 **Playwright Chromium runtime**
- 它屬於工具運作需要的離線元件
- 它不是要你改用 Chrome
- 它也不是把 Microsoft Edge 打包進去

真正的 **Microsoft Edge** 是這台電腦原本就要安裝好的系統瀏覽器，屬於現場電腦的前置條件，不是離線包內嵌的內容。

你可以把它理解成：

- `.playwright-browsers\`：工具自己的內建零件
- Microsoft Edge：這台電腦本來就要有的瀏覽器

兩者都需要，但角色不同。

### 2.4 如果這台電腦沒有 Microsoft Edge

那就不是一般使用者自己補裝 npm 或 Node 的問題，而是 **現場電腦前置條件不符合**。

請直接找你們單位的工具準備者或資訊單位協助確認，不要改走技術安裝路線。

---

## 3. Edge 版實際操作步驟

這一節就是給你照著做的。

### 3.1 第一步：先執行 `install.ps1`

在工具資料夾裡打開 PowerShell，執行：

```powershell
.\install.ps1
```

這一步的角色是：

- 檢查離線包是否完整
- 檢查這份工具包能不能直接使用

它 **不是**：

- 上網安裝器
- 幫你補抓套件的工具
- 要你自己解決技術相依性的入口

#### 如果這一步成功

代表這份工具包大致完整，可以進到下一步。

#### 如果這一步失敗

請直接這樣處理：

1. 到 `logs\` 找最新的 `.log` 檔
2. 把 log 檔連同錯誤畫面提供給準備者
3. 請對方重新確認離線包是否完整

對一般使用者來說，最重要的判斷方式就是：

> **`install.ps1` 失敗，通常表示你拿到的離線包不完整。**

這時候請不要自己研究：

- npm
- Node.js
- 套件安裝
- Playwright 版本
- `.playwright-browsers\` 要怎麼補

這些都不是現場使用者的主流程。

---

### 3.2 第二步：啟動 Microsoft Edge 專用視窗

檢查通過後，執行：

```powershell
.\launch-edge.ps1
```

這一步會打開一個 **專門給蒐集工具使用的 Edge 視窗**。

請把它理解成：

- 這是要讓工具連接的視窗
- 你接下來要在這個視窗裡登入內部網站
- 最好不要混用你平常隨手開的其他 Edge 視窗

#### 執行後請做這 3 件事

1. 在這個新開的 Edge 視窗裡登入內部網站
2. 打開你想蒐集的目標頁面
3. 先不要把這個 Edge 視窗關掉

---

### 3.3 第三步：開始蒐集

登入完成後，回到同一份工具資料夾，再執行：

```powershell
.\collect.ps1 --browser edge
```

這一步的重點只有一個：

> **既然前一步用的是 Edge，這一步就一定要加上 `--browser edge`。**

如果你是第一次用，建議先走預設互動流程，照畫面提示做就好。

### 3.4 如果你只想先快速確認工具能不能正常抓到頁面

可以先用：

```powershell
.\collect.ps1 --snapshot --browser edge
```

你可以把它想成：

**「先快速抓目前這一頁，確認工具有接上 Edge，也有正常工作。」**

---

## 4. 蒐集完成後，去哪裡看結果？

蒐集完成後，通常會在：

```text
materials\
```

下面看到一個新的任務資料夾，通常像這樣：

```text
materials\YYYYMMDDhhmmss_任務名稱\
```

常見內容包括：

```text
materials\YYYYMMDDhhmmss_任務名稱\
├─ aria-snapshots\
├─ screenshots\
├─ recordings\
├─ metadata.json
└─ summary-report.md
```

白話來說：

- `aria-snapshots\`：頁面結構紀錄
- `screenshots\`：畫面截圖
- `recordings\`：操作錄製檔
- `metadata.json`：這次任務的基本資訊
- `summary-report.md`：這次任務的簡短整理

如果執行過程中發生問題，也請一起看：

```text
logs\
```

裡最新的 `.log` 檔。

---

## 5. 最常見的 3 個問題

### 問題 1：`install.ps1` 失敗

這通常代表：

- 離線包不完整
- 少了必要資料夾
- 或你拿到的不是完整交付包

#### 你應該怎麼做？

- 不要自己研究 npm / Node.js
- 不要自己補裝套件
- 不要自己猜哪個資料夾少了什麼
- 請直接把 `logs\` 最新 `.log` 交給準備者

對一般使用者來說，最快的解法通常就是：

> **請準備者重新提供完整離線包。**

---

### 問題 2：`launch-edge.ps1` 跑不起來

你可以先檢查：

- 這台電腦有沒有安裝 Microsoft Edge
- 你是不是在完整工具資料夾裡執行
- 重新執行一次有沒有恢復正常

如果還是不行，請把 `logs\` 裡最新的啟動日誌交給準備者或技術人員。

---

### 問題 3：`collect.ps1 --browser edge` 啟動了，但抓不到頁面

你可以先確認：

- 前一步是不是確實用 `.\launch-edge.ps1` 開的 Edge
- 那個 Edge 視窗有沒有保持開著
- 你有沒有在那個 Edge 視窗裡登入網站
- 目標頁面是不是已經打開
- 指令裡有沒有真的加上 `--browser edge`
- 你是不是在同一份工具資料夾裡執行

如果以上都確認過了還是不行，也請把 `logs\` 裡最新的蒐集日誌提供給準備者。

---

## 6. 你暫時不用自己處理哪些東西？

如果你是一般內網使用者，先不用自己研究這些：

- npm
- npx
- Node.js 安裝
- Playwright 安裝
- `node_modules\`
- `.playwright-browsers\`
- `setup.ps1`
- 技術版本差異

你只要先記住自己的主流程：

```powershell
.\install.ps1
.\launch-edge.ps1
.\collect.ps1 --browser edge
```

就夠了。

---

## 7. 如果你要請 AI 幫你生成或除錯腳本

這一節適合這種情況：

> **你已經用 Microsoft Edge 蒐集過一次素材，現在要把同一次任務的資料交給 AI，請它幫你生成腳本或協助除錯。**

先記住一個重點就好：

**優先上傳附件，不要把很長的內容整段貼進對話框。**

### 7.1 先準備哪些附件

如果你要請 AI 幫你**生成腳本**，請先準備同一次任務的：

- `aria-snapshots\`
- `screenshots\`
- `recordings\`
- `metadata.json`

如果你要請 AI 幫你**除錯**，再加上：

- 目前失敗的腳本檔
- `logs\` 裡相關的日誌檔

你可以把它理解成：

- `aria-snapshots\`：讓 AI 先看懂頁面結構
- `screenshots\`：讓 AI 確認畫面長相和狀態
- `recordings\`：讓 AI 理解操作順序
- `metadata.json`：補足這次任務的背景、順序與基本資訊
- 腳本檔與 `logs\`：讓 AI 能比對「你原本怎麼寫」和「實際哪裡失敗」

#### 很重要

- **請盡量用附件上傳，不要把長內容整段貼進對話框。**
- **請明確要求 AI 先讀附件。**
- **如果資料不夠，AI 應該直接告訴你缺哪個檔案、哪個畫面或哪個步驟，不要自行猜測。**

---

### 7.2 Edge 版生成腳本範本

先把同一次任務的 **`aria-snapshots\`、`screenshots\`、`recordings\`、`metadata.json`** 用附件方式上傳，再貼上下面這段：

```text
請根據我剛剛上傳的同一次任務附件，幫我生成一份可直接使用的 Playwright TypeScript 腳本。我固定使用 Microsoft Edge，已先執行 `.\launch-edge.ps1`，蒐集素材時使用 `.\collect.ps1 --browser edge`，而且我已經在 Edge 視窗裡登入內網網站。我的目標是【請替換：你想自動完成的工作】；成功標準是【請替換：你怎樣算成功】。請優先閱讀我上傳的 `aria-snapshots`、`screenshots`、`recordings`、`metadata.json`，先用附件理解頁面結構、畫面狀態與操作順序；如果資訊不足，請直接告訴我還缺哪個附件、哪個畫面或哪個步驟，不要自行猜測。請輸出：1. 流程摘要，2. 完整 Playwright TypeScript 腳本，3. 參數或可調整項目，4. 容易失敗的步驟與較穩定的寫法。請直接讀附件，不要要求我把長內容整段貼進對話框，也不要把回答改成 npm、Node.js 或 Playwright 安裝教學。
```

---

### 7.3 Edge 除錯最佳實務

如果你要請 AI 幫你除錯，建議照這個順序整理：

1. **先確認是不是同一次任務的附件**
   - 不要把不同日期、不同頁面、不同操作流程的素材混在一起
2. **先講清楚失敗點**
   - 哪一步失敗
   - 你原本預期會看到什麼
   - 實際發生了什麼
3. **把 Edge 相關資訊一次說清楚**
   - 有沒有先執行 `.\launch-edge.ps1`
   - 重現或蒐集時有沒有使用 `.\collect.ps1 --browser edge`
   - 失敗前 Edge 視窗有沒有被關掉
4. **附件一次附齊**
   - 失敗腳本
   - 同一次任務的 `aria-snapshots\`、`screenshots\`、`recordings\`、`metadata.json`
   - `logs\` 裡相關日誌
5. **要求 AI 先讀附件再回答**
   - 如果缺資料，先說缺什麼
   - 不要讓 AI 自己猜

這樣 AI 比較容易直接找到真正的問題，不會一直來回補資料。

---

### 7.4 Edge 版除錯範本

先把 **目前腳本、同一次任務的 `aria-snapshots\`、`screenshots\`、`recordings\`、`metadata.json`、`logs\`** 用附件方式上傳，再貼上下面這段：

```text
請幫我找出這份 Playwright TypeScript 腳本在 Microsoft Edge 情境下失敗的原因，並直接提供可替換的修正版。我的目標是【請替換：原本想完成的工作】；失敗步驟是【請替換：大約卡在哪一步】；預期結果是【請替換：成功時應該發生什麼】；實際結果是【請替換：錯誤訊息、畫面現象或失敗狀況】。我有／沒有先執行 `.\launch-edge.ps1`；重現或蒐集時有／沒有使用 `.\collect.ps1 --browser edge`；失敗前 Edge 視窗有／沒有被關掉。請先優先閱讀我上傳的腳本、`aria-snapshots`、`screenshots`、`recordings`、`metadata.json`、`logs`，先比對附件後再判斷；如果資料不夠，請直接列出還缺哪個檔案、哪個畫面或哪個步驟，不要自行猜測。請輸出：1. 最可能的 1 到 3 個原因，2. 每個原因對應的建議修正方式，3. 完整修正版或清楚標示要替換的片段，4. 下次為了避免重犯要先檢查哪些點。請直接讀附件，不要要求我把長內容整段貼進對話框，也不要把回答變成 npm、Node.js 或 Playwright 安裝教學。
```

---

### 7.5 安全提醒

- **不要上傳密碼、token、`.env` 檔案。**
- **不要把整個 Edge 個人資料夾打包上傳。**
- **不要把不同任務的附件混在一起。**
- 如果截圖、錄影或腳本裡剛好有敏感資訊，先依你們單位規則遮掉或替換後再提供。
- 只提供這次任務真正需要的附件就好，不需要把無關資料一起丟給 AI。

---

## 8. 一句話記住

**你們單位如果固定使用 Microsoft Edge，就照著 `install.ps1 -> launch-edge.ps1 -> collect.ps1 --browser edge` 這條路走；如果 `install.ps1` 失敗，通常表示離線包不完整，請把 `logs\` 最新 `.log` 交給準備者處理，不要自己研究 npm、Node.js 或 Playwright 安裝。即使現場用的是 Edge，離線包裡的 `.playwright-browsers\` 仍然不能少，因為那是工具自己的 Playwright Chromium runtime，而不是要把 Microsoft Edge 打包進去。**
