### 🟡 Prompt B：請 AI 修正失敗的腳本

> **使用時機：腳本跑過一次但失敗了，需要 AI 修正。**

📎 **上傳給 AI 的完整附件清單：**

| # | 上傳什麼 | 到哪裡找 | 必要？ |
|---|---------|---------|--------|
| 1 | **目前的 `.ts` 腳本** | `src\` 資料夾裡你上次存回去的那支檔案（例如 `src\qiz201-批次簽核.ts`） | ✅ 必要 |  ⬅ 改成你的腳本檔名[XXXX.ts]
| 2 | **最新的 `.log` 日誌檔** | `logs\` 資料夾，依檔名日期排序找最新的（見下方說明） | ✅ 必要 |
| 3 | **PowerShell 錯誤訊息** | 在 PowerShell 視窗用滑鼠選取紅色文字 → 右鍵複製，直接貼到 Prompt 訊息裡 | ✅ 必要 |
| 4 | **最新的 ARIA 快照** | 重新執行 `.\collect.ps1 --snapshot --browser edge`，到 `materials\` 找最新資料夾裡的 `aria-snapshots\` | ⭐ 強烈建議 |
| 5 | **最新的截圖** | 同上，在最新資料夾的 `screenshots\` 裡 | ⭐ 強烈建議 |
| 6 | **畫面截圖（手動）** | 腳本卡住時，用鍵盤 `Print Screen` 截下 Edge 畫面，存成圖片上傳 | 選填 |


> 📌 **怎麼找「最新的」log？**
> - `logs\` 資料夾裡的檔案名稱包含日期時間，例如 `2026-03-18_203000.log`。**找日期數字最大的那個**。
>
> 📌 **為什麼要重新蒐集快照？** 
> - 腳本可能跑到一半停在某個頁面。重新蒐集快照可以讓 AI 看到「腳本失敗當下」的頁面狀態，而不是你最初蒐集時的狀態。這對 AI 判斷問題非常有幫助。

 **以下 Prompt 已用「QIZ201 批次簽核 — F6 按鈕 Timeout」填好作為範例。**
> 📌 把有 `⬅` 標記的行改成你自己的狀況，其他原封不動保留。

````text
我已上傳這次任務的全部附件，包含：
- 目前失敗的腳本：src\qiz201-批次簽核.ts      ⬅ 改成你的腳本檔名[XXXX.ts]
- ARIA 快照（失敗當下的頁面結構）
- 截圖（失敗當下的頁面狀態）
- metadata.json（任務背景資訊）
- 執行日誌（logs 資料夾裡最新的 .log 檔）

這支腳本目前的問題：                      ⬅ 改成你遇到的狀況
執行到「按下 F6 批次處理按鈕」這一步就停住了。

PowerShell 顯示的錯誤訊息：               ⬅ 把 PowerShell 裡的紅色錯誤文字貼在這裡
Timeout 30000ms exceeded waiting for
role "button" with name "F6批次處理"

請幫我找出問題並直接修正。

專案已有的共享模組（直接 import 使用，不要重寫）：
- ./lib/task.js — 任務入口：runTaskEntry、TaskRunContext
- ./lib/env.js — 環境變數：getEnv、requireEnv
- ./lib/logger.js — 日誌輸出：log、logContext、printSection
- ./lib/browser.js — 瀏覽器控制：launchTaskBrowser、closeTaskBrowser、cdpConnect、cdpDisconnect、getNestedFrame、waitForMatchingPageInContext、waitForNavigation、takeScreenshot
- ./lib/security.js — 檔名安全處理：safeFileName
修正時請繼續使用這些共享模組，不要替換成自己重寫的版本。

你回覆時請遵守：
- 直接修正我上傳的腳本，不要另外建立新專案
- 保留骨架裡的 import、runTaskEntry、Edge 設定，不要刪掉
- 優先使用上面列出的共享模組（從 ./lib/*.js import），不要重寫瀏覽器、環境變數、日誌、任務入口、檔名安全等已有功能
- 不要叫我執行 npm install、npx 或 npm run
- 帳號密碼不要寫死在程式裡，改用 requireEnv 或 getEnv 從 .env 讀取

請依照以下順序回覆：
1. 最可能的原因（列 1~3 個，說明根據）
2. 還缺什麼資訊（沒有就寫「資訊已足夠」）
3. 完整的腳本（可以直接複製貼上覆蓋的版本）
4. 需要調整的 .env 欄位（沒有就寫「無」）
5. 重新執行的步驟
6. 修正後怎麼確認成功
7. 還是失敗的話，下次要多上傳什麼給你
````
