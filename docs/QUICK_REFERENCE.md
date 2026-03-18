# 快速參考指南 — 生成腳本、除錯、AI 協作

## 📌 核心流程（3 步）

### Chrome 標準流程
```powershell
.\install.ps1              # 檢查工具包
.\launch-chrome.ps1        # 啟動 Chrome Debug 模式
.\collect.ps1              # 蒐集（選擇互動模式 [1]）
```

### Edge 使用者流程
```powershell
.\install.ps1              # 檢查工具包
.\launch-edge.ps1          # 啟動 Edge Debug 模式
.\collect.ps1 --browser edge  # 蒐集（加上 --browser edge）
```

---

## 🚀 要請 AI 幫忙時的步驟

### 第一步：準備附件

**生成新腳本時準備**：
```
aria-snapshots\
screenshots\
recordings\
metadata.json
```

**除錯既有腳本時再加上**：
```
目前的腳本檔
logs\相關日誌
```

### 第二步：打開 Prompt 樣板

**為了 100% 確保 AI 理解你的需求，用樣板而非自由描述。**

#### 🎯 生成腳本 — 最簡單的起點

上傳附件，然後貼上：

```text
我現在要請你根據我上傳的同一次任務附件，產生「可直接執行的腳本及使用說明」。

操作環境：
- Windows 11 + PowerShell 7.x
- 目標瀏覽器：【這裡一定要改】Chrome / Edge / 不確定
- 我已上傳的附件：`aria-snapshots\`、`screenshots\`、`recordings\`、`metadata.json`

我要完成的工作：
【這裡一定要改】例如：登入後開啟「案件查詢」，輸入案件編號，按「查詢」，再打開第一筆案件明細

成功時我應該能觀察到的結果：
【這裡一定要改】例如：
- 查詢結果表格至少出現 1 筆資料
- 第一筆資料可以被點開
- URL 包含 `/case/detail`

其他我已知的事實：
【這裡一定要改】只寫你 100% 確定的事；例如：附件中有登入後首頁、案件查詢頁、查詢結果頁。是否需要二次驗證不確定。

請先讀附件，並只根據附件與我明確提供的資訊判斷。
如果附件或我的描述沒有證據，請不要自行假設我已經執行 `.\launch-chrome.ps1` 或 `.\launch-edge.ps1`、已使用哪一種 `.\collect.ps1` 指令、已登入網站，或已停在某個頁面；請直接列出缺少的資訊。

請輸出：
1. 你從哪些附件證據理解出流程（請列出檔名、畫面文字、ARIA 線索或錄製步驟）
2. 一份可直接執行的 Playwright TypeScript 腳本
3. 在 Windows 11 + PowerShell 7.x 上的使用說明
4. 執行成功後要怎麼檢查
5. 如果資料還不夠，還缺哪些附件或哪個步驟

請不要把回答改成 npm、npx、Node.js 或 Playwright 安裝教學。
```

#### 🐛 除錯既有腳本 — 當你的腳本失敗了

上傳附件+失敗的腳本，然後貼上：

```text
我現在要請你根據我上傳的附件，直接修正這份腳本，並提供「可直接執行的腳本及使用說明」。

操作環境：
- Windows 11 + PowerShell 7.x
- 目標瀏覽器：【這裡一定要改】Chrome / Edge / 不確定
- 我已上傳的附件：目前腳本、`aria-snapshots\`、`screenshots\`、`recordings\`、`metadata.json`、`logs\`

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
【這裡一定要改】例如：畫面停在查詢頁，log 出現 `Timeout 30000ms exceeded while waiting for getByRole('button', { name: '查詢' })`

其他我已知的事實：
【這裡一定要改】只寫你 100% 確定的事；例如：附件裡有查詢頁、結果頁、錯誤日誌；是否是權限問題不確定。

請先讀附件，並只根據附件與我明確提供的資訊判斷。
如果附件或我的描述沒有證據，請不要自行假設我已經執行 `.\launch-chrome.ps1` 或 `.\launch-edge.ps1`、已使用哪一種 `.\collect.ps1` 指令、已登入網站，或瀏覽器視窗一路保持開啟；請直接列出缺少的資訊。

請輸出：
1. 最可能的 1 到 3 個原因（每個都附上你引用的附件證據）
2. 可直接替換的修正版 Playwright TypeScript 腳本
3. 在 Windows 11 + PowerShell 7.x 上的使用說明
4. 修正後應檢查的成功訊號
5. 若還要補蒐集，請列出最少需要補哪幾個附件

請不要把回答改成 npm、npx、Node.js 或 Playwright 安裝教學。
```

### 第三步：最常犯的 5 個錯誤 ⚠️

❌ **錯誤 1**：改動了 Prompt 裡的固定句子
```
修改前：「請先讀附件，並只根據附件與我明確提供的資訊判斷。」
修改後：「根據附件和你的知識判斷。」
→ AI 現在可能會自由發揮，猜測你已登入、已停在某個頁面
```
✅ **對策**：只改標有 `【這裡一定要改】` 和 `【這裡可補充】` 的地方

❌ **錯誤 2**：混合不同日期、不同網站的素材
```
上傳的附件：
- 上周一的 chrome-login 材料
- 昨天的 edge-form 材料
→ AI 無法判斷流程前後順序
```
✅ **對策**：只給「同一次任務」的完整材料

❌ **錯誤 3**：上傳 `.env` 或密碼
```
不該上傳：
- .env
- 密碼、token
- 帳號密碼檔
```
✅ **對策**：確保只有素材檔（aria-snapshots、screenshots、recordings）和日誌

❌ **錯誤 4**：成功標準太模糊
```
不好：「能用」、「可以查詢」、「成功」
好：「查詢結果表格至少出現 1 筆資料」、「URL 包含 /case/detail」、「頁面出現案件編號欄位」
```
✅ **對策**：寫成「看得到的結果」，而非「動作」

❌ **錯誤 5**：替 AI 自己補腦
```
不好：
- 「我已經登入了」（但沒有登入頁的截圖證據）
- 「就按那個按鈕」（但沒指明是哪個按鈕）
- 「應該能成功」（含主觀假設）

好：
- 「附件裡有登入後首頁的截圖」
- 「ARIA 快照中有 getByRole('button', { name: '查詢' })」
- 「附件裡有 recordings/case-query-flow.ts 顯示人工操作可以成功查到資料」
```
✅ **對策**：只寫 100% 確定的事，其他寫「不確定」

---

## 📂 蒐集完成後的輸出結構

```
materials\
└─ YYYYMMDDhhmmss_任務名稱\           # 時間戳+任務名
   ├─ aria-snapshots\
   │  ├─ 01-login-page.html
   │  ├─ 02-dashboard.html
   │  └─ ...
   ├─ screenshots\
   │  ├─ 01-login-page.png
   │  ├─ 02-dashboard.png
   │  └─ ...
   ├─ recordings\
   │  ├─ login-flow.ts
   │  └─ ...
   ├─ metadata.json                # 結構化紀錄
   └─ summary-report.md            # 摘要報告
```

### 每個檔案的用途

| 檔案 | 用途 | 給 AI 時要上傳 |
|------|------|---------|
| `aria-snapshots/*.html` | 頁面語意結構（ARIA）— AI 分析的核心 | ✅ 必上傳 |
| `screenshots/*.png` | 頁面視覺參考 | ✅ 必上傳 |
| `recordings/*.ts` | 操作流程記錄（已自動清理密碼） | ✅ 必上傳 |
| `metadata.json` | 任務統計、時間戳、錯誤紀錄 | ✅ 必上傳 |
| `summary-report.md` | 任務摘要（給人看） | ⚠️ 可選 |

---

## 🔐 安全清單

### ✅ 上傳前檢查

- [ ] 確認 aria-snapshots、screenshots、recordings 目錄都有
- [ ] 確認沒有上傳 `.env` 檔案
- [ ] 確認沒有上傳密碼、token、帳號
- [ ] 錄製檔中密碼已被替換成 `process.env.RECORDING_PASSWORD`（不是實際密碼）
- [ ] 截圖中沒有敏感資訊或個資
- [ ] 只上傳「同一次任務」的材料（不混合不同日期/網站）

### ✅ 離線包完整性檢查

執行 `install.ps1` 時檢查是否看到：
```
✓ runtime\node\ 
✓ node_modules\
✓ .playwright-browsers\
✓ install.ps1
✓ launch-chrome.ps1 (或 launch-edge.ps1)
✓ collect.ps1
```

---

## 💡 常見 Q&A

### Q1: 第一次蒐集要選什麼模式？
**A**：選 `1` 互動模式。這是最容易成功的。

### Q2: 互動模式時，先做「頁面蒐集」還是先做「流程錄製」？
**A**：**先做頁面蒐集**（選 1）。確保每個頁面的 ARIA 快照都在已登入狀態下蒐集。然後再切到「流程錄製」（選 2）。

### Q3: 用 Edge 要改什麼？
**A**：改 3 個地方：
```powershell
.\launch-edge.ps1          # 用這個啟動（不是 launch-chrome.ps1）
.\collect.ps1 --browser edge  # 加上 --browser edge
# 第 3 個：如果用設定檔，改 "browser": "edge"
```

### Q4: 蒐集失敗，怎麼辦？
**A**：檢查 3 個地方（按順序）：
1. 瀏覽器有沒有保持開著？
2. 你在瀏覽器裡登入了嗎？
3. 要抓的頁面有沒有打開？
4. 都確認了還失敗？→ 把 `logs\` 最新的 `.log` 文件交給技術人員

### Q5: install.ps1 失敗代表什麼？
**A**：**離線包不完整**。快速解決：
1. 到 `logs\` 找最新的 `.log`
2. 把 log 檔交給準備者
3. 請對方重新確認或重做完整包

### Q6: 我想修改 Prompt，改哪裡？
**A**：只改有標籤的 3 個地方：
```
【這裡一定要改】  → 根據你的實際情況改
【這裡可補充】    → 知道就補，不知道可留預設或寫「不確定」
其他句子           → 先不要改（這些是提醒 AI 的）
```

### Q7: 如何確保 AI 不會自己猜？
**A**：Prompt 裡已經有這句話：
> 「請不要自行假設我已經執行 `.\launch-chrome.ps1` 或 `.\launch-edge.ps1`、已使用哪一種 `.\collect.ps1` 指令、已登入網站，或已停在某個頁面；請直接列出缺少的資訊。」

因此：
- 如果附件裡有登入狀態的證據（截圖 + ARIA），就說「有」
- 如果沒有證據，就寫「不確定」而不是猜測

### Q8: 錄製檔裡的密碼會不會被上傳？
**A**：不會。系統已自動清理：
```typescript
// ✅ 錄製檔中的實際做法
.fill(selector, process.env.RECORDING_PASSWORD)  // 佔位符，不是實密碼
```
所以你可以安心上傳錄製檔給 AI。

### Q9: 我有多個頁面要蒐集，怎麼組織？
**A**：一次 `collect.ps1` 執行時：
- 互動模式可蒐集最多 100 頁
- 所有頁面輸出都進入同一個 `materials\YYYYMMDDhhmmss_任務名\`
- 然後一起上傳給 AI

### Q10: 離線包要多大？
**A**：
- 基礎包：~800MB（runtime + node_modules + Playwright）
- 每個任務的蒐集成果：通常 10-100MB（取決於頁面數和截圖質量）
- 離線包應該在可攜帶 USB 裡（建議 2GB 以上的 USB 機）

---

## 🔗 檔案位置速查

| 用途 | 檔案路徑 |
|------|---------|
| 互動模式蒐集 | `.\collect.ps1` → 選 `1` |
| 快速擷取當前頁 | `.\collect.ps1 --snapshot` |
| 自動蒐集 | `.\collect.ps1 --auto` |
| 設定檔 | `collect-materials-config.json` |
| 蒐集成果 | `materials\YYYYMMDDhhmmss_*\` |
| 日誌 | `logs\collect-materials-*.log` |
| 生成腳本樣板 | 見本文 §3.1 |
| 除錯樣板 | 見本文 §3.2 |

---

## 📊 工作流程示意

```
內網（蒐集階段）
├─ 啟動 Chrome/Edge Debug 模式 (launch-*.ps1)
├─ 登入內部網站 & 打開目標頁面
├─ 執行 collect.ps1 → 互動模式 [1]
│  ├─ 階段 1：逐頁蒐集 ARIA 快照 & 截圖
│  └─ 階段 2：錄製操作流程 (Codegen)
├─ 得到 materials\YYYYMMDDhhmmss_*\ 
│  ├─ aria-snapshots\
│  ├─ screenshots\
│  ├─ recordings\
│  └─ metadata.json
│
└─ 複製到 USB / 雲端同步

外部環境（AI 協作階段）
├─ 打開 AI 工具（ChatGPT / Claude / Gemini 等）
├─ 上傳附件（aria-snapshots、screenshots、recordings、metadata.json）
├─ 貼上 Prompt 樣板 + 修改 3 個地方
├─ 得到 AI 生成的 Playwright TypeScript 腳本
│
└─ 複製回 USB

內網（驗證執行階段）
├─ 把 AI 生成的腳本放入 scripts/ 或 tests/
├─ 執行腳本進行驗證
├─ 若有問題，收集 logs 再交給 AI 除錯
└─ 確認成功後，可納入自動化流程
```

---

## 📞 沒有此文檔無法解決的問題

如果遇到以下情況，把資訊交給技術支持：

1. **離線包不完整**
   - 現象：`install.ps1` 失敗
   - 提交：`logs\setup-*.log`
   - 誰處理：準備工具包的人

2. **瀏覽器無法連接**
   - 現象：`collect.ps1` 啟動了但抓不到頁面
   - 提交：`logs\collect-materials-*.log`
   - 誰處理：有 Node.js/Playwright 經驗的人

3. **CDP 端口佔用**
   - 現象：`launch-chrome.ps1` 說 9222 已被佔用
   - 提交：系統 Task Manager（檢查是否有多個 Chrome 視窗）
   - 誰處理：IT 人員

4. **Windows 上 spawn 失敗**
   - 現象：Codegen 錄製無法啟動
   - 提交：`logs\collect-materials-*.log` 及 Node.js 版本
   - 誰處理：開發人員（可能需要升級 Node.js）

---

**最後提醒**：
> 這個工具的目的是「蒐集高品質素材供 AI 分析」，不是「直接生成完美腳本」。
> 所以最重要的是：
> 1. ✅ 確保 ARIA 快照清晰完整（AI 看不懂就無法生成）
> 2. ✅ 確保錄製流程完整（Codegen 看得到真實操作步驟）
> 3. ✅ 確保 Prompt 清楚精準（不讓 AI 猜測）
> 然後 AI 才能生成好的腳本。

