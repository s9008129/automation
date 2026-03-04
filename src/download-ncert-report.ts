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

import { chromium, type Browser, type Page, type Download, type Locator } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { safeFileName, validateUrl } from './materialsCollector';

// ============================================================
// 常數
// ============================================================

const DEFAULT_CDP_PORT = 9222;
const TARGET_URL = 'https://www.ncert.nat.gov.tw/index.jsp';
const OUTPUT_DIR = path.join(process.cwd(), 'output');
const PDF_PATTERN = /\.pdf/i;
const REPORT_FILE_PATTERN = /資安聯防監控月報/i;
const THREAT_INDICATOR_PATTERN = /威脅指標/i;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

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

type ParsedUploadDate = {
  isoDate: string;
  utcDayKey: number;
};

type PdfCandidate = {
  rowIndex: number;
  link: Locator;
  fileName: string;
  rowText: string;
  uploadDate: ParsedUploadDate | null;
};

function toDateEpochMs(year: number, month: number, day: number): number | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    return null;
  }
  return d.getTime();
}

function toUtcDayKey(year: number, month: number, day: number): number | null {
  const epochMs = toDateEpochMs(year, month, day);
  if (epochMs === null) return null;
  return Math.floor(epochMs / MS_PER_DAY);
}

function parseUploadDateFromText(text: string): ParsedUploadDate | null {
  const datePatterns = [
    /(^|[^\d])(\d{3,4})[\/\-.](0?[1-9]|1[0-2])[\/\-.](0?[1-9]|[12]\d|3[01])(?=$|[^\d])/g,
    /(^|[^\d])(\d{3,4})\s*年\s*(0?[1-9]|1[0-2])\s*月\s*(0?[1-9]|[12]\d|3[01])\s*日(?=$|[^\d])/g
  ];
  for (const datePattern of datePatterns) {
    const matches = text.matchAll(datePattern);
    for (const m of matches) {
      const rawYear = Number(m[2]);
      const month = Number(m[3]);
      const day = Number(m[4]);
      const year = m[2].length === 3 ? rawYear + 1911 : rawYear; // 民國年轉西元
      const utcDayKey = toUtcDayKey(year, month, day);
      if (utcDayKey === null) continue;
      const isoDate = [
        year.toString().padStart(4, '0'),
        month.toString().padStart(2, '0'),
        day.toString().padStart(2, '0')
      ].join('-');
      return { isoDate, utcDayKey };
    }
  }
  return null;
}

function getTaipeiCurrentDate(): ParsedUploadDate {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(new Date());
  const year = Number(parts.find((p) => p.type === 'year')?.value ?? '0');
  const month = Number(parts.find((p) => p.type === 'month')?.value ?? '0');
  const day = Number(parts.find((p) => p.type === 'day')?.value ?? '0');
  const utcDayKey = toUtcDayKey(year, month, day) ?? Math.floor(Date.now() / MS_PER_DAY);
  const isoDate = [
    year.toString().padStart(4, '0'),
    month.toString().padStart(2, '0'),
    day.toString().padStart(2, '0')
  ].join('-');
  return { isoDate, utcDayKey };
}

function isPreferredMonthlyReportFile(fileName: string): boolean {
  return REPORT_FILE_PATTERN.test(fileName) && !THREAT_INDICATOR_PATTERN.test(fileName);
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

    // 9. 從表格候選 PDF 中，選出 uploadDate 最接近 CurrentDate 的檔案
    log('🔍', '嘗試從「資安聯防監控月報」表格所有 PDF 候選中選取最接近 CurrentDate 的檔案...');
    let targetLink: Locator | null = null;
    let selectedCandidate: PdfCandidate | null = null;
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

        const candidates: PdfCandidate[] = [];
        const seenCandidateKeys = new Set<string>();
        const rowDiagnostics: Array<{
          rowIndex: number;
          rowTextSummary: string;
          linkCount: number;
          textCount: number;
          hrefCount: number;
          onclickCount: number;
          iconCount: number;
        }> = [];
        const addPdfCandidate = async (
          rawCandidate: Locator,
          rowIndex: number,
          rowText: string,
          uploadDate: ParsedUploadDate | null
        ): Promise<void> => {
          try {
            if (await rawCandidate.count() === 0) return;
            const link = rawCandidate.first();
            const metadata = await link.evaluate((el) => {
              const text = (el.textContent ?? '').replace(/\s+/g, ' ').trim();
              const href = el.getAttribute('href') ?? '';
              const onclick = el.getAttribute('onclick') ?? '';
              const ownAlt = el.getAttribute('alt') ?? '';
              const nestedAlt = el.querySelector('img')?.getAttribute('alt') ?? '';
              const alt = ownAlt || nestedAlt;
              const tag = el.tagName.toLowerCase();
              return { text, href, onclick, alt, tag };
            });
            const isPdfCandidate = PDF_PATTERN.test(metadata.text)
              || PDF_PATTERN.test(metadata.href)
              || PDF_PATTERN.test(metadata.onclick)
              || /\bpdf\b/i.test(metadata.alt);
            if (!isPdfCandidate) return;

            const dedupeKey = [
              rowIndex,
              metadata.tag,
              metadata.href,
              metadata.onclick,
              metadata.text,
              metadata.alt
            ].join('|');
            if (seenCandidateKeys.has(dedupeKey)) return;
            seenCandidateKeys.add(dedupeKey);

            const hrefName = metadata.href.split('#')[0].split('?')[0].split('/').filter(Boolean).pop() ?? '';
            const fileName = metadata.text || hrefName || metadata.alt || '(unknown)';
            candidates.push({
              rowIndex,
              link,
              fileName,
              rowText,
              uploadDate
            });
          } catch {}
        };

        let dataRowIndex = 0;
        for (let i = 0; i < rowsCount; i++) {
          const r = rows.nth(i);
          const tdCount = await r.locator('td').count();
          if (tdCount === 0) continue; // skip header-like rows
          dataRowIndex++;
          const rowText = (await r.innerText()).replace(/\s+/g, ' ').trim();
          const uploadDate = parseUploadDateFromText(rowText);
          const rowTextSummary = rowText.length > 120 ? rowText.slice(0, 120) + '…' : rowText;

          const pdfLinksInRow = r.getByRole('link', { name: PDF_PATTERN });
          const pdfLinksCount = await pdfLinksInRow.count();

          const pdfTextsInRow = r.getByText(PDF_PATTERN);
          const pdfTextsCount = await pdfTextsInRow.count();

          const hrefPdfCandidatesInRow = r.locator('a[href*=".pdf" i], a[download*=".pdf" i]');
          const hrefPdfCount = await hrefPdfCandidatesInRow.count();

          const onclickPdfCandidatesInRow = r.locator('[onclick*=".pdf" i]');
          const onclickPdfCount = await onclickPdfCandidatesInRow.count();

          const pdfIconsInRow = r.locator('img[alt*="pdf" i]');
          const pdfIconCount = await pdfIconsInRow.count();

          rowDiagnostics.push({
            rowIndex: dataRowIndex,
            rowTextSummary,
            linkCount: pdfLinksCount,
            textCount: pdfTextsCount,
            hrefCount: hrefPdfCount,
            onclickCount: onclickPdfCount,
            iconCount: pdfIconCount
          });

          for (let j = 0; j < pdfLinksCount; j++) {
            await addPdfCandidate(pdfLinksInRow.nth(j), dataRowIndex, rowText, uploadDate);
          }

          for (let j = 0; j < pdfTextsCount; j++) {
            const textMatch = pdfTextsInRow.nth(j);
            let matchedClickableAncestor = false;
            const textBasedCandidates = [
              textMatch.locator('xpath=ancestor-or-self::a[1]'),
              textMatch.locator('xpath=ancestor-or-self::*[@role="link"][1]'),
              textMatch.locator('xpath=ancestor-or-self::button[1]'),
              textMatch.locator('xpath=ancestor-or-self::*[@onclick][1]')
            ];
            for (const candidate of textBasedCandidates) {
              if (await candidate.count() === 0) continue;
              await addPdfCandidate(candidate.first(), dataRowIndex, rowText, uploadDate);
              matchedClickableAncestor = true;
              break;
            }
            if (!matchedClickableAncestor) {
              const textSnippet = ((await textMatch.textContent()) ?? '').replace(/\s+/g, ' ').trim();
              log('⚠️', '第' + dataRowIndex + '列偵測到 PDF 文字但找不到可點擊元素: ' + (textSnippet || '(empty)'));
            }
          }

          for (let j = 0; j < hrefPdfCount; j++) {
            await addPdfCandidate(hrefPdfCandidatesInRow.nth(j), dataRowIndex, rowText, uploadDate);
          }

          for (let j = 0; j < onclickPdfCount; j++) {
            await addPdfCandidate(onclickPdfCandidatesInRow.nth(j), dataRowIndex, rowText, uploadDate);
          }

          for (let j = 0; j < pdfIconCount; j++) {
            const icon = pdfIconsInRow.nth(j);
            const iconBasedCandidates = [
              icon.locator('xpath=ancestor-or-self::a[1]'),
              icon.locator('xpath=ancestor-or-self::*[@role="link"][1]'),
              icon.locator('xpath=ancestor-or-self::button[1]'),
              icon.locator('xpath=ancestor-or-self::*[@onclick][1]')
            ];
            for (const candidate of iconBasedCandidates) {
              if (await candidate.count() === 0) continue;
              await addPdfCandidate(candidate.first(), dataRowIndex, rowText, uploadDate);
              break;
            }
          }
        }

        if (candidates.length === 0) {
          for (const rowDiagnostic of rowDiagnostics) {
            log('🔎', 'PDF 候選診斷: ' + JSON.stringify(rowDiagnostic));
          }
          log('❌', '表格中找不到可下載的 PDF 候選');
          throw new Error('找不到可下載的 PDF 候選');
        }

        const currentDate = getTaipeiCurrentDate();
        const candidateSummary = candidates.map((c) => ({
          rowIndex: c.rowIndex,
          fileName: c.fileName,
          uploadDate: c.uploadDate?.isoDate ?? null,
          preferredName: isPreferredMonthlyReportFile(c.fileName)
        }));
        log('ℹ️', 'CurrentDate=' + currentDate.isoDate + '，候選 PDF 數=' + candidates.length);
        log('ℹ️', 'PDF 候選摘要: ' + JSON.stringify(candidateSummary));

        const datedCandidates = candidates.filter((c) => c.uploadDate !== null);
        if (datedCandidates.length > 0) {
          const pastOrToday = datedCandidates.filter(
            (c) => (c.uploadDate as ParsedUploadDate).utcDayKey <= currentDate.utcDayKey
          );
          const usePastOrToday = pastOrToday.length > 0;
          const pool = usePastOrToday ? pastOrToday : datedCandidates;
          const selectionRule = usePastOrToday
            ? '規則1：uploadDate <= CurrentDate 且最接近者'
            : '規則2：全部為未來日期，選最接近未來者';

          const tieBreakCandidates = pool.map((c) => {
            const uploadDayKey = (c.uploadDate as ParsedUploadDate).utcDayKey;
            const dayDiff = usePastOrToday
              ? currentDate.utcDayKey - uploadDayKey
              : uploadDayKey - currentDate.utcDayKey;
            return {
              rowIndex: c.rowIndex,
              fileName: c.fileName,
              uploadDate: c.uploadDate?.isoDate ?? null,
              preferredName: isPreferredMonthlyReportFile(c.fileName),
              dayDiff
            };
          });
          const minDayDiff = Math.min(...tieBreakCandidates.map((c) => c.dayDiff));
          const topTies = tieBreakCandidates.filter((c) => c.dayDiff === minDayDiff);
          if (topTies.length > 1) {
            log('ℹ️', 'Tie-break 啟動（同 dayDiff=' + minDayDiff + '）: ' + JSON.stringify(topTies));
          }

          pool.sort((a, b) => {
            const aDayKey = (a.uploadDate as ParsedUploadDate).utcDayKey;
            const bDayKey = (b.uploadDate as ParsedUploadDate).utcDayKey;
            const aDiff = usePastOrToday ? currentDate.utcDayKey - aDayKey : aDayKey - currentDate.utcDayKey;
            const bDiff = usePastOrToday ? currentDate.utcDayKey - bDayKey : bDayKey - currentDate.utcDayKey;
            if (aDiff !== bDiff) return aDiff - bDiff;
            const aPreferred = isPreferredMonthlyReportFile(a.fileName) ? 1 : 0;
            const bPreferred = isPreferredMonthlyReportFile(b.fileName) ? 1 : 0;
            if (aPreferred !== bPreferred) return bPreferred - aPreferred;
            if (a.rowIndex !== b.rowIndex) return a.rowIndex - b.rowIndex;
            return 0;
          });

          selectedCandidate = pool[0];
          targetLink = selectedCandidate.link;
          log('✅', selectionRule + '，已選定: ' + JSON.stringify({
            rowIndex: selectedCandidate.rowIndex,
            uploadDate: selectedCandidate.uploadDate?.isoDate ?? null,
            fileName: selectedCandidate.fileName,
            preferredName: isPreferredMonthlyReportFile(selectedCandidate.fileName)
          }));
        } else {
          selectedCandidate = candidates[0];
          targetLink = selectedCandidate.link;
          log('⚠️', '規則4 fallback：所有 PDF 候選皆無法解析日期，改選第一個 PDF: ' + JSON.stringify({
            rowIndex: selectedCandidate.rowIndex,
            fileName: selectedCandidate.fileName,
            rowText: selectedCandidate.rowText
          }));
        }
      } else {
        log('❌', '找不到資安聯防監控月報標題，無法定位目標表格');
        throw new Error('找不到資安聯防監控月報目標表格');
      }
    } catch (e) {
      log('❌', '解析表格時發生例外: ' + (e as Error).message);
      throw e;
    }

    if (!targetLink) {
      log('❌', '找不到可用的 PDF 連結，停止執行');
      throw new Error('找不到可用的 PDF 連結');
    }

    await targetLink.waitFor({ state: 'visible', timeout: 15000 });
    const pdfText = (await targetLink.textContent())?.trim() ?? selectedCandidate?.fileName ?? '(unknown)';
    log('📄', '找到目標連結: ' + pdfText);

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
