/**
 * 🔽 NCERT 資安聯防監控月報 自動下載腳本
 *
 * 連接到使用者已開啟的 Chrome Debug 模式，自動登入 NCERT 網站，
 * 下載最新的資安聯防監控月報 PDF，然後登出。
 *
 * 執行方式：
 *   npx tsx src/download-ncert-report.ts
 *
 * 必要環境變數：
 *   NCERT_USERNAME — NCERT 帳號
 *   NCERT_PASSWORD — NCERT 密碼
 *   CDP_PORT       — Chrome Debug Protocol 埠號（預設 9222）
 *
 * 離線運作，不依賴任何外部網路。
 */

import { chromium, type Browser, type Page, type Download } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { safeFileName, validateUrl } from './materialsCollector';

// ============================================================
// 常數
// ============================================================

const DEFAULT_CDP_PORT = 9222;
const TARGET_URL = 'https://www.ncert.nat.gov.tw/index.jsp';
const OUTPUT_DIR = path.join(process.cwd(), 'output');
const PDF_PATTERN = /資安聯防監控月報.*\.pdf/i;
const STRICT_SECOND_ROW = (process.env.STRICT_SECOND_ROW ?? 'true').toLowerCase() !== 'false';

// ============================================================
// 工具函數
// ============================================================

/** 台北時間戳記（Asia/Taipei UTC+8） */
function taipeiTimestamp(): string {
  return new Date().toLocaleString('zh-TW', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/** 結構化日誌 — 帶台北時間戳記 */
function log(icon: string, message: string): void {
  const ts = taipeiTimestamp();
  console.log('[' + ts + '] ' + icon + ' ' + message);
}

/** 載入 .env 檔案（不依賴外部套件） */
function loadDotEnv(): void {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  content.split(/\r?\n/).forEach((line) => {
    const m = line.match(/^\s*([^#=]+?)\s*=\s*(.*)\s*$/);
    if (m) {
      const key = m[1].trim();
      let val = m[2].trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      // 不覆蓋已存在的環境變數
      if (!process.env[key]) process.env[key] = val;
    }
  });
  log('ℹ️', '.env loaded (' + envPath + ')');
}

/** 確保輸出目錄存在 */
function ensureOutputDir(): void {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    log('📁', '已建立輸出目錄: ' + OUTPUT_DIR);
  }
}

// ============================================================
// 主流程
// ============================================================

async function main(): Promise<void> {
  // 1. 載入 .env
  loadDotEnv();

  // 2. 驗證環境變數
  const username = process.env.NCERT_USERNAME ?? '';
  const password = process.env.NCERT_PASSWORD ?? '';
  const cdpPort = Number(process.env.CDP_PORT) || DEFAULT_CDP_PORT;

  if (!username || !password) {
    log('❌', '缺少必要環境變數：請設定 NCERT_USERNAME 與 NCERT_PASSWORD');
    log('ℹ️', '可在專案根目錄建立 .env 檔案，或直接設定環境變數');
    process.exit(1);
  }

  log('🚀', 'NCERT 月報下載腳本啟動');
  log('ℹ️', '環境: ' + process.platform + ' ' + process.version + ' CWD=' + process.cwd());
  log('ℹ️', 'CDP 連線埠: ' + cdpPort);

  // 3. 確保輸出目錄存在
  ensureOutputDir();

  let browser: Browser | null = null;

  try {
    // 4. 連接到使用者已開啟的 Chrome（CDP）
    log('🔗', '正在連接 Chrome CDP (http://localhost:' + cdpPort + ') ...');
    browser = await chromium.connectOverCDP('http://localhost:' + cdpPort);
    log('✅', 'Chrome CDP 連接成功');

    const connectedPages = browser.contexts()
      .flatMap((ctx) => ctx.pages())
      .map((p) => p.url())
      .filter((url) => validateUrl(url));
    log('ℹ️', 'CDP pages: ' + (connectedPages.join(', ') || '(none)'));

    // 5. 取得或建立頁面
    const contexts = browser.contexts();
    let page: Page | null = null;

    // 嘗試尋找已開啟的 NCERT 頁面
    for (const ctx of contexts) {
      for (const p of ctx.pages()) {
        const url = p.url();
        if (url.includes('ncert.nat.gov.tw')) {
          page = p;
          log('ℹ️', '找到已開啟的 NCERT 頁面: ' + url);
          break;
        }
      }
      if (page) break;
    }

    // 若無，使用第一個 context 開新分頁
    if (!page) {
      const ctx = contexts.length > 0 ? contexts[0] : await browser.newContext();
      page = await ctx.newPage();
      log('ℹ️', '已開啟新分頁');
    }

    // 6. 導航到 NCERT 首頁
    log('🌐', '正在導航到 ' + TARGET_URL + ' ...');
    if (!validateUrl(TARGET_URL)) {
      throw new Error('不允許的 URL: ' + TARGET_URL);
    }
    await page.goto(TARGET_URL, { waitUntil: 'networkidle' });
    log('✅', '已載入 NCERT 首頁');

    // 7. 登入
    log('🔐', '正在執行登入 ...');
    const accountField = page.getByRole('textbox', { name: '帳號' });
    await accountField.waitFor({ state: 'visible', timeout: 15000 });
    await accountField.click();
    await accountField.fill(username);

    const passwordField = page.getByRole('textbox', { name: '密碼' });
    await passwordField.click();
    await passwordField.fill(password);

    await page.getByRole('button', { name: '登入' }).click();
    await page.waitForLoadState('networkidle');
    log('✅', '登入成功');

    // 8. 點擊或導航到「資安聯防監控月報」頁面（包含 hover 顯示子選單與 fallback）
    log('📋', '尋找資安聯防監控月報連結或直接導航...');
    const reportLinkLocator = page.getByRole('link', { name: /資安聯防監控月報/i });
    try {
      // 先嘗試直接找到可見的連結
      try {
        await reportLinkLocator.first().waitFor({ state: 'visible', timeout: 3000 });
        await reportLinkLocator.first().click();
        await page.waitForLoadState('networkidle');
        log('✅', '已進入月報頁面（透過直接可見連結）');
      } catch (firstErr) {
        // 直接可見的連結不存在或不可見，嘗試透過父選單 hover/互動揭露子選單
        const parentCandidates = [
          page.getByRole('link', { name: /資安訊息公告/i }),
          page.getByText('資安訊息公告'),
          page.locator('nav').getByText('資安訊息公告')
        ];
        let revealed = false;
        for (const candidate of parentCandidates) {
          try {
            if (!candidate) continue;
            const cnt = await candidate.count();
            if (cnt === 0) continue;
            const pm = candidate.first();
            await pm.waitFor({ state: 'visible', timeout: 3000 });
            // 原生 hover
            try { await pm.hover(); } catch {}
            // 補事件與 focus
            try {
              await pm.dispatchEvent('pointerenter');
              await pm.dispatchEvent('pointerover');
              await pm.dispatchEvent('mouseenter');
              await pm.dispatchEvent('mouseover');
              await pm.focus();
            } catch {}
            // 使用 page.mouse 模擬路徑移動以觸發 CSS/JS
            try {
              const box = await pm.boundingBox();
              if (box) {
                const cx = box.x + box.width / 2;
                const cy = box.y + box.height / 2;
                await page.mouse.move(cx - 10, cy);
                await page.waitForTimeout(50);
                await page.mouse.move(cx + 10, cy);
                await page.waitForTimeout(100);
              }
            } catch {}
            // 嘗試等待並點擊子選單連結
            try {
              await reportLinkLocator.first().waitFor({ state: 'visible', timeout: 8000 });
              await reportLinkLocator.first().click();
              await page.waitForLoadState('networkidle');
              log('✅', '已透過互動顯示下拉選單並進入月報頁面');
              revealed = true;
              break;
            } catch {}
          } catch {}
        }
        if (!revealed) throw firstErr;
      }
    } catch (err) {
      log('⚠️', '未找到資安聯防監控月報連結或 hover 顯示失敗，嘗試直接導航至列表頁 Post2/list.do');
      const listUrl = 'https://www.ncert.nat.gov.tw/Post2/list.do';
      if (!validateUrl(listUrl)) {
        throw new Error('不允許的 URL: ' + listUrl);
      }
      await page.goto(listUrl, { waitUntil: 'networkidle' });
      log('✅', '已直接導航至月報列表頁');
    }

    // 9. 以固定位置（表格由上而下的第二個資料列）選取 PDF 並下載
    log('🔍', '嘗試從「資安聯防監控月報」表格的第二個資料列取得 PDF 連結...');
    let targetLink: any = null;
    try {
      const section = page.locator('text=/資安聯防監控月報/i');
      if (await section.count() > 0) {
        const table = section.first().locator('xpath=following::table[1]');
        let rows = table.locator('tbody tr');
        let rowsCount = await rows.count();
        if (rowsCount === 0) {
          rows = table.locator('tr');
          rowsCount = await rows.count();
        }

        // 逐行檢查是否為 data row（包含 td），並尋找第二個 data row
        let dataRow: any = null;
        let seenData = 0;
        for (let i = 0; i < rowsCount; i++) {
          const r = rows.nth(i);
          const tdCount = await r.locator('td').count();
          if (tdCount === 0) continue; // skip header-like rows
          if (seenData === 1) { // found second data row
            dataRow = r;
            break;
          }
          seenData++;
        }

        if (dataRow) {
          const linkInRow = dataRow.getByRole('link', { name: PDF_PATTERN });
          const textInRow = dataRow.getByText(PDF_PATTERN);
          if ((await linkInRow.count()) > 0) {
            targetLink = linkInRow.first();
          } else if ((await textInRow.count()) > 0) {
            targetLink = textInRow.first();
          }
        } else {
          log('❌', '表格資料列不足或找不到第二列（檢測到的 data rows: ' + seenData + '）');
          throw new Error('表格資料列不足，無法選取第二列');
        }
      } else {
        log('⚠️', '找不到資安聯防監控月報標題，改以全頁搜尋 PDF');
      }
    } catch (e) {
      log('❌', '解析表格時發生例外: ' + (e as Error).message);
      throw e;
    }

    // 不進行全頁搜尋的 fallback：依 STRICT_SECOND_ROW 決定是否允許表格內第一個 PDF
    if (!targetLink && !STRICT_SECOND_ROW) {
      try {
        const tablePdf = page.getByRole('table').filter({ hasText: '檔案名稱' }).getByText(PDF_PATTERN).first();
        if ((await tablePdf.count()) > 0) {
          targetLink = tablePdf;
          log('⚠️', "STRICT_SECOND_ROW=false，改用表格內第一個 PDF 連結");
        }
      } catch (e) {
        // ignore
      }
    }
    if (!targetLink) {
      log('❌', '找不到第二個資料列中可下載的 PDF 連結；依規格停止執行（不做全頁 fallback）');
      throw new Error('找不到第二列的 PDF 連結，停止執行');
    }

    await targetLink.waitFor({ state: 'visible', timeout: 15000 });
    const pdfText = await targetLink.textContent();
    log('📄', '找到目標連結: ' + (pdfText ?? '(unknown)'));

    // 觸發下載
    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
    await targetLink.click();
    const download: Download = await downloadPromise;
    const suggested = download.suggestedFilename() ?? '';
    const fallbackName = 'ncert-report-' + new Date().toISOString().replace(/[:.]/g, '-') + '.pdf';

    const filename = suggested || fallbackName;
    const ensuredPdf = filename.toLowerCase().endsWith('.pdf') ? filename : (filename + '.pdf');
    // 使用 materialsCollector.safeFileName 進行嚴格淨化，並確保副檔名為 .pdf
    const safeBase = safeFileName(ensuredPdf);
    const safeFilename = safeBase.toLowerCase().endsWith('.pdf') ? safeBase : (safeBase + '.pdf');

    // 儲存到 output 目錄
    const savePath = path.join(OUTPUT_DIR, safeFilename);
    try {
      await download.saveAs(savePath);
      log('✅', '月報已儲存至: ' + savePath);
    } catch (err) {
      log('❌', '儲存下載檔案失敗: ' + (err as Error).message);
      throw err;
    }

    // 10. 登出
    log('🚪', '正在登出 ...');
    const logoutLink = page.getByRole('link', { name: '登出' });
    await logoutLink.waitFor({ state: 'visible', timeout: 10000 });
    await logoutLink.click();
    await page.waitForLoadState('networkidle');
    log('✅', '已成功登出');

    log('🎉', 'NCERT 月報下載流程完成！');
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    log('❌', '執行失敗: ' + err.message);
    if (err.stack) {
      log('📝', 'Stack trace:\n' + err.stack);
    }
    process.exit(1);
  } finally {
    // 清理：僅釋放參考，不關閉使用者的 Chrome
    browser = null;
    log('🧹', '已釋放 CDP 連線參考（Chrome 保持運行）');
  }
}

// ============================================================
// 執行入口
// ============================================================

main();
