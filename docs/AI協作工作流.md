# AI 協作工作流指南

> 本文件說明如何透過 AI 協作，將素材蒐集結果轉化為可執行的自動化腳本。

---

## 完整工作流概覽

```
① 啟動瀏覽器        ② 蒐集素材           ③ AI 協作           ④ 執行任務腳本
launch-edge.ps1  →  collect.ps1      →  Claude/GPT      →  run-task.ps1
                    ARIA 快照            分析素材              執行 .ts 腳本
                    截圖、錄製            生成腳本              回報結果
                    HTML 原始碼          分析錯誤              持續修正
```

---

## 第一步：蒐集素材

在內網電腦上執行素材蒐集：

```powershell
# 啟動可供工具連接的 Edge（一次即可，關閉後需重啟）
.\launch-edge.ps1

# 開始蒐集素材（操作你想要自動化的頁面）
.\collect.ps1 --browser edge
```

蒐集完成後，`materials\` 目錄下會產生如下結構：

```
materials\
└── 20260318111335_我的任務名稱\
    ├── aria-snapshots\      ← 最重要！AI 分析用的頁面語意結構
    │   ├── step-01-*.txt
    │   └── step-02-*.txt
    ├── screenshots\         ← 畫面截圖（視覺參考）
    │   ├── step-01-*.png
    │   └── step-02-*.png
    ├── recordings\          ← 錄製的操作腳本（含已知 bug，需 AI 修正）
    │   └── recorded-actions.ts
    ├── metadata.json        ← 環境資訊
    └── summary-report.md   ← 整體摘要
```

---

## 第二步：交給 AI 分析

### 應該提供給 AI 的素材

| 素材 | 重要性 | 說明 |
|------|--------|------|
| `aria-snapshots/*.txt` | ⭐⭐⭐ 最重要 | 頁面語意結構，AI 理解按鈕/欄位的核心 |
| `recordings/*.ts` | ⭐⭐⭐ 重要 | 錄製腳本（含 bug，需 AI 修正） |
| `screenshots/*.png` | ⭐⭐ 重要 | 視覺參考，幫助 AI 確認畫面狀態 |
| `summary-report.md` | ⭐⭐ 重要 | 操作流程摘要 |
| `metadata.json` | ⭐ 補充 | 環境資訊 |

### 給 AI 的提示詞範本

將以下內容連同素材一起提供給 AI：

```
我需要你幫我根據以下素材，生成一個 Playwright TypeScript 自動化腳本。

## 本專案的技術規範（請嚴格遵守）

1. 語言：TypeScript，ESM 模組（import/export，絕對不用 require）
2. 執行器：tsx（不需要 tsconfig，不需要 ts-node）
3. 腳本放置位置：src\ 目錄下
4. .env 讀取：使用 src/lib/env.ts 的 loadDotEnv()，不引入 dotenv 套件
5. 瀏覽器：channel: 'msedge'（使用系統安裝的 Edge）
6. headless: false（保留畫面）
7. 敏感資訊（密碼等）：從 .env 讀取，絕對不硬編碼
8. CAS SSO ticket：不可硬編碼，改用 page.waitForURL() 等待 redirect
9. 錯誤訊息：面向使用者的訊息使用正體中文
10. 分頁處理：有分頁的清單必須用 while 迴圈處理所有頁面

## 可用的共用 Helper（建議使用）

- src/lib/env.ts：loadDotEnv()、requireEnv()、getEnv()
- src/lib/logger.ts：createLogger()
- src/lib/error.ts：handleTaskError()、formatError()
- src/lib/browser.ts：launchEdge()、connectCDP()、getNestedIframe()
- src/lib/task-context.ts：createTaskContext()、ensureDir()

## 參考範本

請參考 src/templates/task-template.ts 的結構風格。

## 我要自動化的任務

[在此描述你想要自動化的操作流程]

## 素材附件

[附上 aria-snapshots/*.txt 和 recordings/*.ts 的內容]
```

---

## 第三步：存放並執行 AI 生成的腳本

1. 將 AI 生成的腳本存放到 `src\` 目錄，依命名規範：
   ```
   src\{系統代碼}-{任務名稱}.ts
   
   範例：
     src\qiz-批次簽核.ts
     src\eip-公文簽核.ts
   ```

2. 確認 `.env` 已設定所需的環境變數（參考 `.env.example`）

3. 執行腳本：
   ```powershell
   .\run-task.ps1 src\qiz-批次簽核.ts
   ```

---

## 第四步：遇到錯誤時，讓 AI 持續修正

若腳本執行失敗，終端機會顯示錯誤訊息與堆疊資訊：

```
❌ 【批次簽核】執行失敗：找不到元素：按鈕「確認簽核」

--- 錯誤堆疊（供 AI 分析用）---
Error: 找不到元素：按鈕「確認簽核」
    at ...
---

請將以上錯誤訊息提供給 AI 協助排查。
```

**將這段錯誤訊息提供給 AI**，AI 通常能根據錯誤訊息與 ARIA 快照找出問題並修正。

---

## 最佳實踐

### 蒐集高品質素材的技巧

1. **慢慢操作**：不要快速點擊，讓工具有時間擷取每個步驟的 ARIA 快照
2. **每個重要頁面都暫停**：讓工具記錄到頁面完整載入後的狀態
3. **包含錯誤情境**：若頁面有驗證錯誤提示，也蒐集這些狀態
4. **多頁清單要翻頁**：確保蒐集到分頁操作的完整流程

### 與 AI 協作的技巧

1. **提供完整上下文**：將 ARIA 快照、錄製腳本、截圖都一起提供
2. **說明業務邏輯**：除了畫面操作，也說明你希望腳本達成什麼業務目標
3. **逐步驗證**：先讓 AI 生成基本流程，驗證後再讓 AI 加入進階邏輯
4. **錯誤迭代**：遇到錯誤時直接把錯誤訊息貼給 AI，讓它修正
