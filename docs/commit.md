# NCERT 月報自動下載腳本 — 變更紀錄

> **文件版本**：1.1.0 ｜ **更新日期**：2026-03-15 ｜ **時區**：Asia/Taipei (UTC+8)

---

## 1. 專案背景與目的

本專案（`web-material-collector`）是一套**內部網路網頁素材離線蒐集工具**，透過 Playwright 連接使用者已開啟的 Chromium branded browser（Chrome / Edge，使用 CDP 協定），在不關閉使用者瀏覽器的前提下自動化蒐集 ARIA 快照、截圖與 PDF 文件。本次變更的核心為 `src/download-ncert-report.ts`——一支自動登入 NCERT 網站、定位「資安聯防監控月報」表格第二資料列、下載對應 PDF 並登出的端對端自動化腳本。此腳本完全離線運作，憑證由環境變數（`.env`）提供，檔名經 `safeFileName()` 嚴格淨化以防路徑穿越，並遵循專案的結構化日誌與 CDP 不關閉原則。

---

## 2. 本次變更清單

| 提交 | 檔案 | 目的 |
|------|------|------|
| `9e1110e` | `src/download-ncert-report.ts`（新增） | 初版 NCERT 月報自動下載腳本：CDP 連線、登入、PDF 下載、登出 |
| `c16f5f1` | `src/download-ncert-report.ts`（修改） | 改採 case-insensitive ARIA locator，並在隱藏下拉選單中透過 hover 顯示子選單以點選目標連結；若 hover 失敗則採多步驟互動 (hover, pointer events, focus, mouse.move, dispatchEvent) 以提高成功率；找不到時 fallback 至 `Post2/list.do`；檔名淨化使用 `path.basename()` + 正則替換 |
| `0e23506` | `src/download-ncert-report.ts`（修改） | 強化下拉選單揭露策略：嘗試多個父項 locator（link/text/nav），並使用 hover、dispatchEvent（pointerenter/over/mouseenter/mouseover）、focus 與 page.mouse 模擬路徑移動以提高成功率；若揭露失敗則 fallback 至 `Post2/list.do`；保留 CDP 不關閉使用者 Chrome 的原則 |
| `55d95a8` | `src/download-ncert-report.ts`（修改） | 引入 `safeFileName()` / `validateUrl()` 共用函數；新增 `STRICT_SECOND_ROW` 旗標控制是否只取第二資料列；改用字串串接取代 template literal；增加 CDP 連線後頁面列表日誌；所有 URL 導航前加入 `validateUrl()` 檢查 |
| `55d95a8` | `src/materialsCollector.ts`（依賴） | 匯出 `safeFileName()` 與 `validateUrl()` 供下載腳本使用 |
| `fd40ee5` | `.gitignore`、`output/` 清理 | 將 `output/` 加入 `.gitignore`，移除已誤提交的臨時輸出檔案 |
| — | `.env.example` | 提供環境變數範本（`NCERT_USERNAME`、`NCERT_PASSWORD`、`CDP_PORT`） |

---

## 3. 驗證步驟

### 3.1 TypeScript 編譯檢查

```powershell
npx tsc --noEmit
```

預期結果：無輸出（零錯誤）。

### 3.2 啟動瀏覽器 CDP（Chrome 預設 / Edge 替代）

```powershell
# 標準 Chrome 流程
.\launch-chrome.ps1          # 預設埠 9222
.\launch-chrome.ps1 -Port 9333

# 如果要驗證 Edge
.\launch-edge.ps1            # 預設埠 9222
.\launch-edge.ps1 -Port 9333
```

確認瀏覽器開啟後，可在瀏覽器中造訪 `http://localhost:9222/json/version` 驗證 CDP 可用。

### 3.3 設定環境變數並執行

```powershell
# 方法 A：複製 .env.example 並填入實際值
Copy-Item .env.example .env
# 編輯 .env 設定 NCERT_USERNAME 與 NCERT_PASSWORD

# 方法 B：直接設定環境變數
$env:NCERT_USERNAME = 'your-account'
$env:NCERT_PASSWORD = 'your-password'

# 執行腳本
npx tsx src/download-ncert-report.ts
```

### 3.4 預期輸出

```
[2026/02/11 17:00:00] 🚀 NCERT 月報下載腳本啟動
[...] ✅ <Browser> CDP 連接成功
[...] ✅ 登入成功
[...] 📄 找到目標連結: 114年01月資安聯防監控月報.pdf
[...] ✅ 月報已儲存至: D:\dev\automation\output\114年01月資安聯防監控月報.pdf
[...] ✅ 已成功登出
[...] 🎉 NCERT 月報下載流程完成！
```

PDF 檔案會存放於 `./output/` 目錄。

---

## 4. 風險與回退建議

| 風險項目 | 說明 | 緩解措施 |
|---------|------|---------|
| NCERT 網站 UI 結構變更 | 表格或連結的 DOM 結構變動會導致 locator 失敗 | 腳本已內建 fallback（直接導航 `Post2/list.do`）；失敗時日誌含完整堆疊追蹤 |
| 第二列定位錯誤 | 表格資料列數不足或排序改變可能取到錯誤的 PDF | 使用 `STRICT_SECOND_ROW` 旗標控制（見下方） |
| 檔名安全 | 伺服器回傳的檔名可能含路徑穿越字元 | 已使用 `safeFileName()` 做嚴格淨化 |
| CDP 連線失敗 | Chrome / Edge 未以 Debug 模式啟動或埠號不符 | 啟動前先確認 `http://localhost:9222/json/version` 可存取 |

### `STRICT_SECOND_ROW` 旗標

- **預設值**：`true`（僅允許從表格第二資料列取得 PDF）
- **用途**：確保下載的是「前一個月」的月報（第一列通常為最新月份、第二列為前月）
- **設定方式**：

```powershell
# 嚴格模式（預設）— 只取第二列，找不到則中止
$env:STRICT_SECOND_ROW = 'true'

# 寬鬆模式 — 若第二列找不到，退而取表格內第一個符合的 PDF
$env:STRICT_SECOND_ROW = 'false'
```

### 回退方式

若本次變更導致問題，可回退至初版：

```powershell
git revert fd40ee5 55d95a8 c16f5f1
# 或直接 checkout 初版
git checkout 9e1110e -- src/download-ncert-report.ts
```

---

## 5. 提交紀錄摘要

| SHA | 日期 (UTC+8) | 訊息 | 說明 |
|-----|-------------|------|------|
| `9e1110e` | 2026-02-11 15:55 | `feat(automation): 新增 NCERT 月報自動下載腳本` | 初版功能：CDP 連線、登入、下載 PDF、登出，含 `.env` 載入與結構化日誌 |
| `c16f5f1` | 2026-02-11 16:25 | `fix(automation): 修正 NCERT 月報下載流程的連結尋找與檔名安全處理` | 改善連結搜尋（case-insensitive + fallback 導航）；基本檔名淨化 |
| `55d95a8` | 2026-02-11 17:19 | `fix(automation): 強化第二列定位與檔名淨化` | 引入共用 `safeFileName()`/`validateUrl()`；新增 `STRICT_SECOND_ROW` 旗標；完善表格第二列定位邏輯 |
| `fd40ee5` | 2026-02-11 17:23 | `chore: 移除臨時檔案與輸出檔案，加入 output/ 到 .gitignore` | 清理誤提交的輸出檔，確保 `output/` 不進版控 |

---

> 📌 如需完整 commit 歷史，請執行 `git --no-pager log --oneline`。

---

## 6. 文件更新：強化使用指南 - 新增高品質 Prompt 與 Debug 範本

- **提交**：`docs(guides): 強化使用指南 - 新增高品質 Prompt 與 Debug 範本`
- **日期**：2026-02-12（Asia/Taipei）
- **說明**：在 `docs/使用指南.md` 新增「高品質 Prompt 範本（Template）」與「改良 Debug Prompt 範本（Template）」，補充了具體的欄位說明、三個層級的生成 prompt 範例（精簡/標準/極細節）、以及三個實務 Debug 範例（hover reveal / second-row / filename download）。README.md 同步新增精簡導覽連結；docs/commit.md 新增本次更新記錄與驗證步驟。

### 驗證步驟（快速）
1. 打開 `docs/使用指南.md`，搜尋「高品質 Prompt 範本」與「改良 Debug Prompt 範本」標題。
2. 確認文件中包含「精簡 / 標準 / 極細節」三種生成 prompt 範例與三個 Debug 範例。
3. 在有網路的環境複製一組範例進 LLM，確認能成功回傳 TypeScript 腳本範例。

---

> 📌 如需完整 commit 歷史，請執行 `git --no-pager log --oneline`。
