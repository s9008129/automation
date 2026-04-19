### 🟢 Prompt A：請 AI 生成新腳本

````text
我已上傳這次任務的全部附件，包含：
- 骨架檔：src\qiz201-批次簽核.ts             ⬅ 改成你的骨架檔名[XXXX.ts]
- ARIA 快照（頁面結構）
- 截圖（畫面狀態）
- 錄製檔（操作流程）                       
- metadata.json（任務背景資訊）

請以我上傳的骨架檔為基礎，幫我補完這支腳本。

我要完成的事情：                          ⬅ 以下全部改成你要自動化的操作步驟
1. 用我的憑證密碼自動登入（密碼放在 `.env` 裡）
2. 登入後畫面會自己跳轉好幾次，最後回到首頁，要等它跳完
3. 看首頁上顯示待辦數量的那一塊，「電子表單待辦事項」的「待辦」和「代辦」如果都是 0，就直接結束
4. 另外開一個新分頁進 QIZ 批次簽核頁面（不要在原本的頁面點連結跳過去）
5. 進入「我的批次簽核」
6. 看畫面上的「功能代碼」下拉選單，如果裡面沒有東西可以選就提前結束
7. 每個功能代碼都要做：全選 → 按「F6批次處理」→ 跳出確認視窗就按確定 → 如果有好幾頁就一頁一頁做到清完為止
8. 全部功能代碼都處理完之後，回到「我的待辦事項」查一下，確認顯示 0 筆

特別注意：                                ⬅ 如果有要強調的事項可以加這段
- 登入後畫面會自己跳轉好幾次，腳本要等它全部跳完自己回到首頁，不要中途強制切換頁面（會造成登入失敗）
- 要先看首頁上的待辦數量，如果都是 0 就不用進 QIZ，直接結束
- 進 QIZ 的時候要開新分頁，不要在原本的頁面跳轉，不然登入狀態會跑掉
- 批次簽核頁面裡面還有一層畫面（內嵌頁面），請從 ARIA 快照確認結構
- 「功能代碼」下拉選單裡可能有好幾個項目，每個都要分別處理完再換下一個
- 按完「F6批次處理」之後會跳出確認視窗，要自動按確定
- 每個功能代碼的資料可能有好幾頁（每頁 50 筆），要一頁一頁做到清完為止
- 全部做完後，回到待辦事項確認最終數量是 0

專案已有的共享模組（直接 import 使用，不要重寫）：
- ./lib/task.js — 任務入口：runTaskEntry、TaskRunContext
- ./lib/env.js — 環境變數：getEnv、requireEnv（自動支援 ENC(...) 加密值透明解密）
- ./lib/crypto.js — 加解密工具：isEncrypted、encryptValue、decryptValue、loadKeyFile、generateKey（一般腳本不需直接使用，由 env.js 自動處理）
- ./lib/logger.js — 日誌輸出：log、logContext、printSection
- ./lib/browser.js — 瀏覽器控制：launchTaskBrowser、closeTaskBrowser、cdpConnect、cdpDisconnect、getNestedFrame、waitForMatchingPageInContext、waitForNavigation、takeScreenshot
- ./lib/security.js — 檔名安全處理：safeFileName
骨架檔已示範正確的 import 寫法，請以相同方式引用，不要自己重寫這些功能。

你回覆時請遵守：
- 直接補完我上傳的骨架檔，不要另外建立新專案
- 保留骨架裡的 import、runTaskEntry、Edge 設定，不要刪掉
- 優先使用上面列出的共享模組（從 ./lib/*.js import），不要重寫瀏覽器、環境變數、日誌、任務入口、檔名安全等已有功能
- 不要叫我執行 npm install、npx 或 npm run
- 帳號密碼不要寫死在程式裡，改用 requireEnv 或 getEnv 從 .env 讀取
- .env 中的值可能是加密過的 ENC(...) 格式，loadDotEnv() 會自動解密，腳本中直接使用 requireEnv/getEnv 即可
- run-task.ps1 會在執行前自動解密 .env、執行後自動換鑰並重新加密，腳本不需要自己處理加解密邏輯

請依照以下順序回覆：
1. 你從附件裡看懂了什麼（頁面結構、按鈕位置等）
2. 還缺什麼資訊（沒有就寫「資訊已足夠」）
3. 完整的腳本（可以直接複製貼上覆蓋骨架檔的版本）
4. 需要在 .env 加入的欄位（沒有就寫「無」）
5. 執行步驟
6. 怎麼確認執行成功
````
