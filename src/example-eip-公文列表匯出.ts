/**
 * 📘 範例任務腳本：EIP 公文列表匯出
 *
 * 這是一個示範用腳本，展示本專案任務腳本的標準寫法：
 * - ESM import
 * - .env 載入（不使用 dotenv）
 * - channel: 'msedge'，headless: false
 * - 正體中文訊息
 * - 統一錯誤處理
 * - 多頁迴圈處理
 * - CAS SSO 登入等待模式
 *
 * 執行方式：
 *   .\run-task.ps1 src\example-eip-公文列表匯出.ts
 *
 * ⚠️ 此腳本為範例展示，目標 URL 為佔位符，執行前請修改為實際網址。
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { loadDotEnv, getEnv } from './lib/env.js';
import {
  log,
  logError,
  initLogger,
  printHeader,
  printSection,
  getTaipeiTaskTimestamp,
  getTaipeiISO,
} from './lib/logger.js';
import { launchTaskBrowser, closeTaskBrowser, waitForNavigation } from './lib/browser.js';

// ============================================================
// 取得 __dirname（ESM 必須）
// ============================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================
// 常數
// ============================================================

const TASK_NAME = 'EIP-公文列表匯出';
const LOG_DIR = path.join(__dirname, '..', 'logs');

// ============================================================
// 型別定義
// ============================================================

/** 單筆公文記錄 */
interface Document {
  序號: number;
  主旨: string;
  文號: string;
  發文日期: string;
  狀態: string;
}

// ============================================================
// 主要任務實作
// ============================================================

async function runTask(): Promise<void> {
  // ---- 1. 載入環境變數 ----
  const envPath = loadDotEnv();
  if (envPath) {
    log('⚙️', `已載入環境設定：${envPath}`);
  } else {
    log('⚠️', '未找到 .env 檔案，使用預設設定或環境變數');
  }

  // ---- 2. 讀取設定 ----
  // 密碼等敏感資訊從 .env 讀取，禁止硬編碼
  const systemUrl = getEnv('EIP_URL', 'https://eip-lts.voa.fia.gov.tw');
  const maxPages = parseInt(getEnv('EIP_MAX_PAGES', '100'), 10);

  log('⚙️', `系統網址：${systemUrl}`);
  log('⚙️', `最多處理頁數：${maxPages}`);

  // ---- 3. 啟動瀏覽器 ----
  const ctx = await launchTaskBrowser({
    channel: 'msedge',  // 使用系統已安裝的 Edge，離線環境友善
    headless: false,     // 顯示瀏覽器視窗，方便觀察執行過程
    width: 1280,
    height: 800,
  });
  const { page } = ctx;

  const allDocuments: Document[] = [];

  try {
    // ---- 4. 導航到 EIP 系統 ----
    printSection('登入流程');
    log('🌐', `正在開啟 ${systemUrl}...`);
    await page.goto(systemUrl, { timeout: 30000 });

    // ---- 5. CAS SSO 登入 ----
    // 正確做法：等待 redirect 完成，而非硬編碼 ticket
    // ⚠️ ticket 每次不同，絕對不能硬編碼
    log('🔐', '等待 CAS SSO 登入完成...');
    log('💡', '請在瀏覽器中完成憑證登入，腳本將自動繼續');

    // 等待登入後跳轉到主畫面
    await waitForNavigation(
      page,
      '**/eip100/eip100m_v1.jsp**',
      60000,
      'EIP 主畫面'
    );
    log('✅', '已進入 EIP 主畫面');

    // ---- 6. 導航到公文列表 ----
    printSection('讀取公文列表');
    // 此處為佔位符，實際路徑請依蒐集到的 ARIA 快照調整
    await page.getByRole('link', { name: '公文管理' }).click();
    await page.waitForLoadState('networkidle');

    // ---- 7. 多頁迴圈讀取 ----
    let currentPage = 1;
    let hasNextPage = true;

    while (hasNextPage && currentPage <= maxPages) {
      log('📄', `正在讀取第 ${currentPage} 頁...`);

      // 讀取本頁資料（此處為示範邏輯，實際選擇器請依 ARIA 快照調整）
      const rows = await page.locator('table tbody tr').all();

      for (let i = 0; i < rows.length; i++) {
        const cells = await rows[i].locator('td').allTextContents();
        if (cells.length >= 5) {
          allDocuments.push({
            序號: allDocuments.length + 1,
            主旨: cells[1]?.trim() ?? '',
            文號: cells[2]?.trim() ?? '',
            發文日期: cells[3]?.trim() ?? '',
            狀態: cells[4]?.trim() ?? '',
          });
        }
      }

      log('ℹ️', `第 ${currentPage} 頁已讀取 ${rows.length} 筆`);

      // 檢查是否有下一頁
      const nextButton = page.getByRole('button', { name: '下一頁' });
      const isDisabled = await nextButton.isDisabled().catch(() => true);
      const isVisible = await nextButton.isVisible().catch(() => false);

      if (!isVisible || isDisabled) {
        hasNextPage = false;
      } else {
        await nextButton.click();
        await page.waitForLoadState('networkidle');
        currentPage++;
      }
    }

    log('✅', `共讀取 ${allDocuments.length} 筆公文資料（${currentPage} 頁）`);

    // ---- 8. 匯出結果 ----
    printSection('匯出結果');
    const outputDir = path.join(__dirname, '..', 'materials', 'exports');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const timestamp = getTaipeiTaskTimestamp();
    const outputPath = path.join(outputDir, `eip-公文列表-${timestamp}.json`);

    const exportData = {
      exportedAt: getTaipeiISO(),
      taskName: TASK_NAME,
      totalCount: allDocuments.length,
      documents: allDocuments,
    };

    fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2), 'utf-8');
    log('💾', `匯出完成：${outputPath}`);

  } finally {
    await closeTaskBrowser(ctx);
  }
}

// ============================================================
// 入口點
// ============================================================

(async () => {
  const runId = `${TASK_NAME}-${getTaipeiTaskTimestamp()}`;
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
