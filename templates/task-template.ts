/**
 * 📋 任務腳本範本
 *
 * 使用說明：
 *   1. 複製此檔案到 src\ 目錄，依命名規範重新命名：
 *      src\{系統代碼}-{任務名稱}.ts
 *      例如：src\qiz-批次簽核.ts、src\eip-公文簽核.ts
 *
 *   2. 修改 TASK_NAME 與實作 runTask() 函數
 *
 *   3. 執行方式：
 *      .\run-task.ps1 src\你的腳本.ts
 *
 * ───────────────────────────────────────────────────────────
 * ⚠️  注意：此範本設計為複製到 src\ 目錄後使用。
 *     匯入路徑 './lib/env.js' 等，在複製到 src\ 後才正確。
 *     若直接在 templates\ 目錄執行，匯入路徑需調整為 '../src/lib/...'。
 * ───────────────────────────────────────────────────────────
 * ⚠️  注意事項（AI 生成腳本時必須遵守）
 * ───────────────────────────────────────────────────────────
 * ✅  使用 ESM import（禁止 require）
 * ✅  使用 tsx 執行（禁止 ts-node）
 * ✅  使用自製 loadDotEnv（禁止 dotenv 套件）
 * ✅  瀏覽器使用 channel: 'msedge'，headless: false
 * ✅  敏感資訊從 .env 讀取（禁止硬編碼）
 * ✅  面向使用者的訊息使用正體中文
 * ✅  多頁表單必須用迴圈完整處理所有頁面
 * ✅  CAS ticket 透過 waitForURL 等待 redirect（禁止硬編碼）
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { loadDotEnv, requireEnv } from './lib/env.js';
import { log, logError, initLogger, printHeader, getTaipeiTaskTimestamp } from './lib/logger.js';
import { launchTaskBrowser, closeTaskBrowser } from './lib/browser.js';

// ============================================================
// 取得 __dirname（ESM 必須）
// ============================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================
// 任務設定
// ============================================================

/** 任務名稱（用於日誌與輸出目錄命名） */
const TASK_NAME = '任務名稱';
/** 日誌目錄 */
const LOG_DIR = path.join(__dirname, '..', 'logs');

// ============================================================
// 主要任務實作
// ============================================================

/**
 * 主要任務邏輯。
 * 請在此函數中實作自動化步驟。
 */
async function runTask(): Promise<void> {
  // ---- 1. 載入環境變數 ----
  loadDotEnv();

  // ---- 2. 讀取必要設定 ----
  // 如需密碼等敏感資訊，使用 requireEnv() 從 .env 讀取，禁止硬編碼
  // const username = requireEnv('USERNAME', '系統帳號');
  // const password = requireEnv('PASSWORD', '系統密碼');

  // ---- 3. 啟動瀏覽器 ----
  const ctx = await launchTaskBrowser({
    channel: 'msedge',
    headless: false,  // 保持顯示畫面，方便觀察
    width: 1280,
    height: 800,
  });
  const { page } = ctx;

  try {
    // ---- 4. 導航到目標頁面 ----
    log('🌐', '正在開啟目標頁面...');
    await page.goto('https://your-target-url.example.com');

    // ---- 5. 處理登入流程（若需要）----
    // 範例：使用 CAS SSO 登入
    // await page.getByRole('button', { name: '憑證登入' }).click();
    // await page.waitForURL('**/your-system/main.jsp**', { timeout: 30000 });
    // log('✅', '登入成功');

    // ---- 6. 執行主要任務邏輯 ----
    // 範例：讀取表格資料並處理多頁
    // let currentPage = 1;
    // while (true) {
    //   log('📄', `處理第 ${currentPage} 頁...`);
    //   // 在此處理每一頁的資料
    //   // ...
    //   
    //   // 檢查是否有下一頁
    //   const nextButton = page.getByRole('button', { name: '下一頁' });
    //   const isDisabled = await nextButton.isDisabled().catch(() => true);
    //   if (isDisabled) break;
    //   
    //   await nextButton.click();
    //   await page.waitForLoadState('networkidle');
    //   currentPage++;
    // }
    // log('✅', `共處理 ${currentPage} 頁`);

    log('✅', `${TASK_NAME} 任務完成`);

  } finally {
    // ---- 7. 關閉瀏覽器 ----
    await closeTaskBrowser(ctx);
  }
}

// ============================================================
// 入口點
// ============================================================

(async () => {
  // 初始化日誌
  const runId = `${TASK_NAME.replace(/\s+/g, '-')}-${getTaipeiTaskTimestamp()}`;
  initLogger(LOG_DIR, runId);

  printHeader(`🤖 RPA 任務：${TASK_NAME}`);

  try {
    await runTask();
    log('🎉', `任務「${TASK_NAME}」執行完成`);
    process.exit(0);
  } catch (err) {
    logError(`任務「${TASK_NAME}」執行失敗`, err);
    process.exit(1);
  }
})();
