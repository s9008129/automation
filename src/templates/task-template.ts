/**
 * 📦 任務腳本範本 — Task Script Template
 *
 * 這是供 AI 生成任務腳本時參考的標準範本。
 * 複製此檔案到 src\{系統代碼}-{任務名稱}.ts 並依需求修改。
 *
 * 執行方式：
 *   .\run-task.ps1 src\{系統代碼}-{任務名稱}.ts
 *
 * ⚠️ 規範提醒（AI 生成時必須遵守）：
 *   - 使用 ESM import，不用 require()
 *   - 使用 tsx 執行，不用 ts-node
 *   - 不引入 dotenv 套件，用 src/lib/env.ts 的 loadDotEnv()
 *   - 瀏覽器使用 channel: 'msedge'，不下載 Playwright 瀏覽器
 *   - headless: false，保留畫面供使用者觀察
 *   - 使用者可見訊息使用正體中文
 *   - 有分頁的表單必須用 while 迴圈處理所有頁面
 *   - CAS ticket 不可硬編碼，用 waitForURL 等待 SSO redirect
 */

import { chromium } from 'playwright';
import { loadDotEnv, requireEnv } from './lib/env.js';
import { createLogger } from './lib/logger.js';
import { handleTaskError } from './lib/error.js';
import { createTaskContext, ensureDir } from './lib/task-context.js';

// ── 任務設定 ─────────────────────────────────────────────────

/** 任務名稱，用於日誌與輸出目錄命名（請改為你的實際任務名稱） */
const TASK_NAME = '任務名稱範本';

/** 目標系統 URL（請改為你的內部系統網址） */
const TARGET_URL = 'https://your-intranet-system.example.com/';

// ── 主程式 ───────────────────────────────────────────────────

async function main(): Promise<void> {
    // 1. 載入環境變數（從 .env 讀取，不依賴 dotenv 套件）
    loadDotEnv();

    // 2. 建立任務上下文（時間戳記、輸出目錄、dry-run 模式判斷）
    const ctx = createTaskContext(TASK_NAME);
    const log = createLogger(TASK_NAME);

    log.info(`任務啟動 — ${ctx.timestamp}`);
    log.info(`輸出目錄：${ctx.outputDir}`);

    if (ctx.isDryRun) {
        log.warn('Dry-run 模式：只列印操作，不實際執行');
    }

    // 3. 讀取必要的環境變數（缺少時自動拋出中文錯誤）
    const username = requireEnv('USERNAME');
    // const password = requireEnv('PASSWORD');  // 依需求取消註解

    log.info(`使用者帳號：${username}`);

    // 4. 建立輸出目錄
    ensureDir(ctx.outputDir);

    // 5. 啟動 Microsoft Edge（使用系統已安裝的 Edge，不需要下載）
    log.info('啟動 Microsoft Edge…');
    const browser = await chromium.launch({
        channel: 'msedge',
        headless: false,
    });

    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        // 6. 導覽至目標頁面
        log.info(`開啟目標頁面：${TARGET_URL}`);
        await page.goto(TARGET_URL, { waitUntil: 'networkidle' });

        // 7. 若有 SSO 登入（CAS 協議），等待 redirect 完成
        //    ✅ 正確作法：等待 redirect，不硬編碼 ticket
        //    await page.getByRole('button', { name: '憑證登入' }).click();
        //    await page.waitForURL('**/eip100/eip100m_v1.jsp**', { timeout: 30000 });

        // ── 任務邏輯（依實際需求修改以下區塊）─────────────────

        // 範例：找到主要功能按鈕並點擊
        // await page.getByRole('button', { name: '我的批次簽核' }).click();

        // 範例：處理有分頁的清單（必須用迴圈處理所有頁面）
        // let pageNum = 1;
        // while (true) {
        //     log.info(`處理第 ${pageNum} 頁…`);
        //
        //     // 在此頁面執行操作
        //     const items = page.getByRole('row');
        //     const count = await items.count();
        //     log.info(`本頁共 ${count} 筆資料`);
        //
        //     // 嘗試前往下一頁
        //     const nextBtn = page.getByRole('button', { name: '下一頁' });
        //     if (!(await nextBtn.isVisible()) || await nextBtn.isDisabled()) {
        //         log.info('已到最後一頁');
        //         break;
        //     }
        //     await nextBtn.click();
        //     await page.waitForLoadState('networkidle');
        //     pageNum++;
        // }

        // ── 任務邏輯結束 ────────────────────────────────────────

        log.success('任務完成！');

    } finally {
        // 8. 關閉瀏覽器（任務執行模式下，關閉自己啟動的瀏覽器）
        await browser.close();
        log.info('瀏覽器已關閉');
    }
}

// ── 程式進入點 ───────────────────────────────────────────────

main().catch(err => handleTaskError(err, TASK_NAME));
