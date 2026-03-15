# Edge 支援可行性研究報告

## 結論摘要

結論先講清楚：**本專案技術上可行支援 Microsoft Edge，自動化邏輯可以大致比照既有 Chrome 模式，但不是只把字樣從 Chrome 改成 Edge 就完成。**

真正可行的做法是：

1. **沿用現有 Chromium + CDP 架構**，在 attach 已開啟的 Edge Debug Session 時，仍使用 `playwright.chromium.connectOverCDP(...)`。
2. **把專案從 Chrome-only 調整成 Chrome / Edge aware**，同步修改啟動腳本、頁面過濾、codegen 參數、文件與離線包說明。
3. **保留現有離線包模型**（`runtime/node`、`node_modules`、`.playwright-browsers`），但要把 branded Edge 視為**系統前置條件**或由 IT 另外部署的瀏覽器，而不是 `.playwright-browsers` 內的可攜元件。
4. **接受「Edge 會更新」是正常情境**，並以 Stable / Extended Stable + smoke test 的方式管理變動，而不是追求把 branded Edge 鎖進專案資料夾。

一句話總結：

> **Edge 支援的核心技術沒有障礙，真正要處理的是專案目前整體流程、命名、文件與離線部署假設都圍繞 Chrome。**

---

## 為什麼技術上可行

### 1. Edge 與 Chrome 同屬 Chromium 系列，CDP 路徑成立

本專案主流程目前在 `collect-materials.ts:890-962` 透過：

```ts
this.browser = await chromium.connectOverCDP(endpoint);
```

連到 `http://localhost:${cdpPort}` 的 Debug 端點。

這條路徑之所以可延伸到 Edge，不是因為 Playwright 有另一個 `edge.connectOverCDP()` API，而是因為：

- Microsoft Learn 的 Edge DevTools Protocol 文件指出，**Microsoft Edge DevTools Protocol 與 Chrome DevTools Protocol 相容**。
- 同一份文件也明確示範可用：

```powershell
msedge.exe --remote-debugging-port=9222 --user-data-dir=<some directory>
```

開出可供 CDP 附加的 Edge。

因此，若目標是「連到已經登入的 Edge」，**既有 `playwright.chromium.connectOverCDP(...)` 模式本身可以沿用**。

### 2. Playwright 已正式支援 Edge channel

已驗證資訊包括：

- `node_modules/playwright/types/test.d.ts:6772-6788` 列出 Edge 支援 channel：
  - `msedge`
  - `msedge-beta`
  - `msedge-dev`
  - `msedge-canary`
- `node node_modules/playwright/cli.js codegen --help` 顯示 `playwright codegen` 支援 `--channel <channel>`。
- Microsoft Learn 的 Playwright for Microsoft Edge 文件示範 library 用法為：

```ts
await playwright.chromium.launch({ channel: 'msedge' });
```

這代表 Edge 在 Playwright 的模型裡是 **Chromium 的 branded channel**，不是另一條完全不同的技術路線。

### 3. 現有蒐集能力本身與瀏覽器品牌無強耦合

本專案真正有價值的能力是：

- ARIA 快照
- 截圖
- HTML 蒐集
- 互動錄製
- iframe 遞迴
- 結構化日誌與 metadata

這些能力大多建立在 Playwright 對頁面與 DOM 的操作上，**不是建立在 Chrome 專屬 API 上**。  
因此，只要 Edge session 能被正確 attach，這些蒐集邏輯理論上都可重用。

補充一個正向訊號：`src/materialsCollector.ts:28-36` 的 `INTERNAL_URL_PREFIXES` 已經把 `edge://` 列入內部頁面前綴，代表 repo 內已有部分程式碼開始朝瀏覽器中立方向演進。

---

## Edge 版本更新是否有影響

### 先講結論

**有影響，但通常是「需要管理的變動」，不是「Edge 一更新就不能用」。**

對本專案來說，真正要觀察的不是單純版本號，而是下列事情在更新後是否仍然成立：

1. Edge 仍能以 `--remote-debugging-port` 正常啟動
2. `http://localhost:<port>/json/version` 與 `/json/list` 仍可讀取
3. `playwright.chromium.connectOverCDP(...)` 仍能成功附加
4. 基本蒐集流程（列頁、快照、截圖、錄製）仍能完成 smoke test

也就是說，**Edge 會更新不是阻斷條件；沒有 remote debugging endpoint、企業政策變更，或更新後 smoke test 失敗，才是實際風險點。**

### 為什麼它不像 WebDriver 那樣需要嚴格綁版

這裡要特別分清楚兩件事：

- **WebDriver for Microsoft Edge** 要求 driver 與瀏覽器前三段版本號一致
- **Playwright + Edge** 並不是走這種嚴格 driver 綁版模型

Playwright 官方文件對 branded Chrome / Edge 的說法是：

- 支援 Stable / Beta 等 channel
- 建議定期更新 Playwright
- `connectOverCDP` 可附加到既有 Chromium-based browser

因此，本專案若走 Edge 支援，**不需要比照 WebDriver 走嚴格三段號綁版**；但也不表示版本差距可以無限放大。比較準確的說法是：

> **Playwright 與 Edge 不需嚴格綁版，但 Playwright 不宜長期落後於系統 Edge 的 major version。**

### 哪些更新通常屬於可接受的正常變動

以下情況通常可視為「正常更新」，不需要因為版本變動就直接否定 Edge 支援：

- 同一 channel 內的安全修補或 patch update
- Stable 正常更新後，CDP attach 與基本 smoke test 仍通過
- 受管企業環境採用 Extended Stable，且更新後仍能完成基本蒐集流程

如果更新後仍能做到：

- 啟動 remote debugging
- 回應 CDP endpoint
- 正常列出 context / page
- 成功做一次基本快照或錄製

就可視為**可接受的正常變動**。

### 哪些情況需要重新驗證或預警

以下情況建議明確列為重新驗證條件：

- Edge **major version** 變更
- 從 Stable 切到 Beta / Dev / Canary，或反向切換
- IT 新增企業政策、必裝 extension、代理、DLP 或其他安控設定
- `connectOverCDP` 開始逾時、拿不到 context/page、或成功率明顯下降
- `codegen --channel msedge` 錄製結果變得不穩定
- Playwright 長時間未更新，而系統 Edge 已跨越多次 major update

換句話說，**真正要重驗的不是「每次小更新」，而是「大更新、策略變更、或實際行為退化」。**

### 推薦的版本 / channel 策略

若之後本專案要正式支持 Edge，建議採以下策略：

#### 1. 一般內網使用者：預設以 Stable 為主

理由很簡單：

- Microsoft 官方把 Stable 定位為最適合大多數使用者的正式 channel
- 文件、排錯與交付成本最低
- 最符合本專案目前的 SOP 與支援模式

#### 2. 受管企業環境：可考慮 Extended Stable

如果組織本來就有 IT 管理 Edge 更新節奏，**Extended Stable 是很值得考慮的選項**，因為：

- 它仍有安全更新
- 但 major feature 變動頻率較低
- 比較不容易出現「文件剛驗完、瀏覽器下一週又有明顯變動」的情況

這對本專案這種依賴 CDP attach、又希望現場同仁 SOP 穩定的工具特別有幫助。

#### 3. 技術準備者：可用 Beta 提前驗證，但不建議當正式標準

Beta 可以拿來做「下一輪 Edge 更新前」的預警驗證，但不建議當成一般內網使用者的正式環境。

#### 4. Dev / Canary：不建議列為正式支援

就算 Playwright 有 `msedge-dev` / `msedge-canary` channel 名稱，它們的更新速度與變動頻率仍太高，不適合作為穩定 SOP。

### 對本專案最務實的管理建議

若使用者已確認內網電腦本來就有安裝 Edge，那麼比較實際、也比較穩的策略是：

1. **把 Edge 視為環境既有瀏覽器，不追求把它打包進專案資料夾**
2. **把 Edge major update 視為重新驗證事件**
3. **把 Playwright 定期更新視為維護責任**
4. **每次 major update 或政策變更後，至少跑一次 Edge smoke test**

這比起嘗試把 branded Edge 固定在某個 bundle 版本，更符合企業實務，也更符合本專案的離線包設計方向。

---

## 專案現況與差距

### A. 核心 attach 流程可沿用，但訊息與指引全部寫死 Chrome

`collect-materials.ts:890-962` 目前：

- 連線日誌寫成「正在連接到 Chrome CDP」
- 成功訊息寫成「已成功連接到 Chrome」
- 錯誤訊息與手動啟動指引全部只提供 Chrome 路徑與 `launch-chrome.ps1`

**判斷：**

- attach API 本身可沿用。
- 需要調整的是「瀏覽器識別、提示文案、手動啟動指引」。

**建議：**

- 保留 `playwright.chromium.connectOverCDP(endpoint)`。
- 將日誌與錯誤訊息改成依設定輸出 `Chrome` 或 `Edge`，或統一寫成「Chromium-based browser」。

### B. 頁面過濾規則仍是 Chrome-only

`collect-materials.ts:1029-1038` 目前排除：

- `chrome://`
- `chrome-extension://`
- `chrome-untrusted://`
- `devtools://`
- `about:blank`

**差距：**

若 attach 的是 Edge，目前尚未明確排除 `edge://`，也沒有處理 Edge 擴充或其他 Edge 內部頁面命名空間。

**建議：**

- 至少補上 `edge://`
- 若未來實測發現會出現 Edge 擴充或其他內部頁面，也應一併加入過濾規則

### C. Codegen 可支援 Edge，但目前專案沒把 channel 接進去

`collect-materials.ts:1621-1632` 目前直接呼叫：

```ts
playwright codegen --target javascript --output <file> <url>
```

未帶 `--channel`。

但已驗證：

- `playwright codegen` 支援 `--channel`
- Edge 可使用 `msedge`

**判斷：**

這不是技術不可行，而是目前尚未把已存在能力接進專案。

**建議：**

- 若使用 Edge 模式，codegen 改為帶 `--channel msedge`
- 但要清楚註明：**這只會讓錄製視窗用 Edge 開啟，不代表 codegen 會共用 attach 中的已登入 session**

這一點也與 `docs/spec.md:103-129` 的既有設計決策一致：目前 codegen 是獨立瀏覽器實例，不共享 CDP attach 的 session。

### D. 啟動腳本與入口全是 Chrome-only

目前已驗證的 Chrome-only 入口包括：

- `launch-chrome.ps1`
- `scripts/launch-chrome.sh`
- `scripts/run-launch-chrome.mjs`
- `package.json` 的 `start:chrome`

例如：

- `launch-chrome.ps1:83-109` 只搜尋 `chrome.exe`
- `scripts/launch-chrome.sh:58-74` 只搜尋 Chrome / Chromium
- `scripts/run-launch-chrome.mjs:18-33` 只會轉發到 Chrome 腳本

**差距：**

使用者流程、錯誤提示與啟動器完全預設 Chrome，Edge 沒有入口。

**建議路線：**

可二選一：

1. **新增 Edge 專屬腳本**
   - `launch-edge.ps1`
   - `scripts/launch-edge.sh`
   - `scripts/run-launch-edge.mjs`

2. **把既有啟動器抽象成通用版**
   - 例如支援 `--browser chrome|msedge`

若以「降低一般使用者理解成本」為優先，第一階段可先採 **新增 Edge 專屬腳本**，之後再視情況收斂成通用啟動器。

### E. 文件與規格仍以 Chrome 為中心

目前主文件都把 Chrome 寫成唯一流程：

- `README.md:29-69,155-171`
- `docs/spec.md:81-95`
- `docs/使用指南.md:20-29,38-50,75-78`

例如：

- README 的主流程是 `install.ps1 -> launch-chrome.ps1 -> collect.ps1`
- spec 的 FR-001/FR-002 直接寫 Chrome CDP 與 Chrome 內部頁面過濾
- 使用指南把一般使用者步驟寫成打開 Chrome 專用視窗

**差距：**

就算程式先支援 Edge，若文件不改，使用者仍會被誤導。

### F. 離線包目前把 Playwright Chromium 視為必要元件，這個假設不能直接套用到 branded Edge

`setup.ps1:347-387` 與 `scripts/prepare-offline-bundle.ps1:398-429` 都把 `.playwright-browsers` 內的 Chromium 視為 bundle 必備內容。

這和 Edge 支援之間的關鍵差別在於：

- `PLAYWRIGHT_BROWSERS_PATH=/tmp/pw-browsers node node_modules/playwright/cli.js install --dry-run chromium msedge`
  的實測結果顯示：
  - Chromium 會安裝到 `PLAYWRIGHT_BROWSERS_PATH`
  - `Msedge` 的 install location 是 `<system>`
- Playwright 官方 browsers 文件也指出：
  - `npx playwright install msedge` 會安裝到作業系統預設全域位置
  - 且可能覆蓋現有瀏覽器安裝

**判斷：**

Edge 可以支援，但 **branded Edge 不是 `.playwright-browsers` 這類專案內可攜元件**。

---

## 離線包策略建議

### 先用白話講清楚：為什麼不是主推「離線版 Edge」

如果內網電腦本來就有安裝 Edge，這其實是**好消息**，因為代表目標環境已經具備可用的系統瀏覽器。  
但這件事**不代表**我們應該把 branded Edge 再打包進專案離線包主流程。

原因不是「Edge 不好」或「Edge 不能自動化」，而是本專案主推的離線包，核心價值是：

- 可以整包複製
- 可以整包驗證
- 可以清楚知道哪些東西由專案負責

像 `runtime/node`、`node_modules`、`.playwright-browsers` 這些內容，都屬於**專案自己能帶著走、也能自己驗證的元件**。  
但 branded Edge 不一樣，它是安裝在系統層級、會跟著企業政策與系統更新一起管理的瀏覽器。

所以更準確的說法不是：

> 「我們不推 Edge。」

而是：

> **「我們可以支援 Edge，但不把 branded Edge 當成專案離線包裡的可攜 binary。」**

既然你已經確認內網電腦有安裝 Edge，這反而更支持一個簡單、穩定的策略：

- **專案離線包**負責專案自己的東西
- **系統 Edge**負責當現場既有瀏覽器

這樣交付方式更清楚，也比較不會讓現場同仁誤以為「工具包會接手管理整台電腦上的 Edge」。

### 建議結論

**可以維持「離線包」這個交付模式，但 Edge 應採「bundle + 系統前置瀏覽器」雙層模型。**

也就是說：

### 專案內離線包仍保留

- `runtime/node/`
- `node_modules/`
- `.playwright-browsers/`（Playwright Chromium）
- 使用者入口腳本
- 文件、設定檔、日誌機制

### Edge 改列為系統前置條件

若要在內網使用 Edge：

- 由 IT 先在目標機安裝 Microsoft Edge
- 或將 Edge for Business 的離線安裝包作為**附帶部署資產**另外交付

如果目標內網電腦本來就已經有 Edge，則最務實的做法通常不是「再塞一份離線版 Edge 進 bundle」，而是：

- 確認現場 Edge 的 channel 與更新政策
- 驗證它能正常開啟 remote debugging
- 把 Edge 當成現場既有環境條件來使用

這樣才符合現實：

1. Edge 是系統層級的 branded browser
2. 不受 `.playwright-browsers` 目錄管理
3. `playwright install msedge` 不適合作為本專案主要的可攜離線包策略

### 為什麼不建議把 `playwright install msedge` 當主要方案

原因已足夠明確：

- 安裝位置是 `<system>`
- 不是專案資料夾內可攜內容
- 可能覆蓋既有瀏覽器
- 與本專案目前「整包帶入內網」的操作心智不同

換句話說，**若硬把 `install msedge` 當成 bundle 主流程，會讓 Edge 支援在交付模型上變得不穩定且難以控管。**

再講白話一點：

- 本專案離線包想解決的是「把專案自己的執行元件完整帶進內網」
- 不是「由專案去接手安裝、覆蓋、管理系統瀏覽器」

一旦把 branded Edge 強行納入主流程，就會立刻多出一些本來不屬於 bundle 的責任：

- 安裝到哪裡
- 是否會影響原本 Edge
- 需不需要管理員權限
- 誰負責後續更新
- 出問題時算專案問題還是 IT 環境問題

這就是為什麼即使現場有 Edge、而且 Edge 技術上可支援，我仍不把「離線版 Edge」當成主推方案。

### 建議的內網落地方式

#### 方案 1：IT 預先部署 Edge（推薦）

使用 Microsoft Edge for Business 的正式安裝來源，在內網目標機先部署 Stable channel 的 Edge。

優點：

- 版本與部署責任清楚
- 比較符合企業維運習慣
- 不會讓專案 bundle 負責覆蓋系統瀏覽器

#### 方案 2：將 Edge for Business 離線安裝包與 bundle 一起交付

若組織流程允許，也可把 Edge 的官方離線安裝包與本工具 bundle 一起交付，但要清楚標示：

- 這是**系統安裝前置步驟**
- 不是 `.playwright-browsers` 的一部分
- 可能需要系統管理權限

---

## 風險與限制

### 1. Enterprise Browser Policies 可能阻擋自動化

Playwright 官方文件已提醒：

> Certain Enterprise Browser Policies may impact Playwright's ability to launch and control Google Chrome and Microsoft Edge.

這表示：

- 某些企業政策可能讓 Edge 啟動、附加、錄製或控制失敗
- 問題不一定是本專案程式錯誤，也可能是企業環境限制

**建議：**

- 在文件與故障排除中明寫這件事
- 啟動失敗時提供「可能受企業政策限制」的提示

### 2. IE mode 是明確限制

Microsoft 文件指出，當 Edge 以 `--remote-debugging-port` 啟動時，該 session 不適合 IE mode。

這對內網站點很重要：

- 若網站依賴 IE mode 或 ActiveX 類相容模式
- Edge 雖然能啟動，但不代表本專案的 CDP attach 流程就等價可用

**結論：**

若內網系統高度依賴 IE mode，這應視為 **架構性限制**，不是一般 bug。

### 3. Codegen 改成 Edge，不代表共享登入狀態

即使後續在錄製模式加入 `--channel msedge`：

- 它只表示錄製視窗改用 Edge
- 不代表共用當前 attach 的 Edge session
- 也不代表共用登入 cookie

這點要在研究與使用文件中寫清楚，避免錯誤期待。

### 4. 命名與流程若只改一半，會造成使用者混亂

如果只改程式碼，不改：

- `launch-chrome.ps1`
- `start:chrome`
- README / spec / 使用指南中的 Chrome-only 說明

就會出現：

1. 程式已支援 Edge，但使用者不知道如何啟動
2. 使用者在用 Edge，錯誤訊息卻一直叫他開 Chrome
3. 排錯時難以判斷目前是在 Chrome 還是 Edge 模式

---

## 建議實作路線

### 第一階段：打通最小可行 Edge 主流程

目標是先讓「啟動 Edge Debug -> attach -> 列頁 -> 蒐集 -> codegen」成立。

**建議項目：**

1. 在 `collect-materials.ts` 與設定檔引入瀏覽器模式概念
   - 例如 `chrome` / `msedge`
2. 保留 `playwright.chromium.connectOverCDP(endpoint)`
3. 補上 Edge 內部頁面過濾
4. 在 Edge 模式讓 codegen 帶 `--channel msedge`
5. 提供 Edge 啟動入口
6. 新增 `package.json` 的 Edge 入口（例如 `start:edge`）

**完成標準：**

- 可成功附加到 Edge Debug Session
- 不會把 Edge 內部頁面誤判為使用者頁面
- 錄製可用 Edge 開啟
- 錯誤提示不再是誤導性的 Chrome-only 訊息

### 第二階段：調整文件與離線包說明

**建議項目：**

1. 更新 `README.md`
2. 更新 `docs/spec.md`
3. 更新 `docs/使用指南.md`
4. 更新 `setup.ps1` 與 `scripts/prepare-offline-bundle.ps1` 的說明文字
5. 明確區分：
   - bundle 內元件
   - 系統前置瀏覽器

**完成標準：**

- 團隊能清楚說明 Chrome / Edge 兩種模式差異
- 使用者不會誤以為 `.playwright-browsers` 內會附帶 branded Edge
- 離線交付責任分界清楚

### 第三階段：企業環境穩定化

**建議項目：**

1. 把 Enterprise Policy 風險寫進文件與故障排除
2. 把 IE mode 限制明確列為不保證支援的條件
3. 建立 channel 支援政策
   - 第一版正式支援：`msedge`
   - 其他 channel 先列為保留能力
4. 補齊 Edge 相關驗證案例

---

## 驗證建議

### 1. 基本 attach 驗證

**目標：** 確認 Edge Debug Session 可被現有架構附加。

**做法：**

1. 以系統已安裝的 Edge 啟動：

```powershell
msedge.exe --remote-debugging-port=9222 --user-data-dir=<dir>
```

2. 讓專案以 Edge 模式連到 `http://localhost:9222`
3. 確認底層仍由 `playwright.chromium.connectOverCDP(...)` 連線

**預期：**

- 連線成功
- 能列出可操作的使用者頁面
- 日誌不再只顯示 Chrome

### 2. 頁面過濾驗證

**目標：** 確認 Edge 內部頁面不會混入素材頁面。

**做法：**

- 同時開一個業務頁面與一個 `edge://settings`
- 執行頁面列舉與頁面選擇流程

**預期：**

- `edge://` 被排除
- 真正業務頁面仍可被選中

### 3. Codegen channel 驗證

**目標：** 確認 Edge 模式會帶入 `--channel msedge`。

**做法：**

- 啟動錄製流程
- 檢查目前已存在的 command log（`collect-materials.ts:1631`）

**預期：**

- Edge 模式下能看到 `codegen --channel msedge`
- Chrome 模式不會誤帶 Edge channel

### 4. 離線包驗證

建議至少測兩組：

#### 案例 A：有系統 Edge、無外網

- 目標機已預裝 Edge Stable
- 將完整 bundle 帶入內網執行

**預期：**

- 不需再下載 branded Edge
- Edge 模式可正常運作

#### 案例 B：無系統 Edge、無外網

- 只帶 bundle，未預裝 Edge

**預期：**

- 啟動或安裝檢查應明確失敗
- 錯誤訊息要清楚告知需先安裝 Edge
- 不應誤導使用者去 `.playwright-browsers` 找 Edge

#### 案例 C：系統 Edge 剛完成 major update

- 目標機已安裝 Edge
- Edge 剛升級到新的 major version
- bundle 內容不變

**預期：**

- 若 remote debugging 與基本 smoke test 仍通過，視為可接受更新
- 若 `connectOverCDP` 或錄製流程異常，則應啟動重新驗證與排錯

#### 案例 D：受管企業環境啟用 Extended Stable

- 由 IT 控制 Edge 更新節奏
- 使用 Stable application 的 Extended Stable 方案

**預期：**

- major feature 變動頻率降低
- 文件與現場 SOP 較穩定
- 仍需在每次 major update 後做 smoke test

### 5. 企業政策與 IE mode 驗證

**目標：** 提前暴露真實企業限制。

**做法：**

- 在受企業政策管理的電腦上測 Edge 模式
- 若站點依賴 IE mode，將其列為獨立案例驗證

**預期：**

- 若被 policy 阻擋，專案能給出清楚訊息
- 若依賴 IE mode，文件能明確標示為限制

---

## 最終建議

若目標是「以最小風險為本專案增加 Edge 支援」，建議採用以下決策：

1. **核心 attach 架構不改**
   - 既有 Edge session 仍用 `playwright.chromium.connectOverCDP(...)`
2. **第一版只正式支援 `msedge`**
   - 先不要承諾 beta / dev / canary
3. **離線包保留現有 Playwright Chromium**
   - 但把 branded Edge 明確改列為系統前置條件或外掛部署資產
4. **同步修改程式、啟動器、文件與交付說明**
   - 不可只改單點
5. **把企業政策與 IE mode 當成正式限制寫進文件**

最後一句話可以作為專案決策摘要：

> **Edge 支援不是做不到，而是要把現有 Chrome-only 專案升級成 Chromium branded browser aware 的工具；只要用對 attach 路徑、補齊啟動與文件、重新定義離線包邊界，就可以穩定落地。**
