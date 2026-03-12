/**
 * 🔽 NCERT 資安聯防監控月報 自動下載腳本
 *
 * 連接到使用者已開啟的 Chrome Debug 模式，自動登入 NCERT 網站，
 * 下載最新的資安聯防監控月報 PDF，續下載 Post/list.do 的 Excel，然後登出。
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
import * as os from 'os';
import * as path from 'path';
import { safeFileName, validateUrl } from './materialsCollector';

// ============================================================
// 常數 — 整支腳本共用的固定設定值，就像食譜裡預先量好的材料
// ============================================================

/** Chrome 偵錯模式的預設連接埠，像是大樓的門牌號碼，讓程式知道要敲哪扇門 */
const DEFAULT_CDP_PORT = 9222;

/** NCERT 網站首頁網址 — 程式會從這裡開始操作 */
const TARGET_URL = 'https://www.ncert.nat.gov.tw/index.jsp';

/** 下載完的檔案最終存放資料夾（專案目錄下的 output/） */
const OUTPUT_DIR = path.join(process.cwd(), 'output');

/** 瀏覽器預設的「下載」資料夾，用來接住 Chrome 自動下載的檔案 */
const DEFAULT_STABLE_DOWNLOAD_DIR = path.join(os.homedir(), 'Downloads');

/** PDF 檔案最小合理大小（1 KB），低於此值代表可能是錯誤頁面而非真正的報告 */
const MIN_VALID_PDF_SIZE_BYTES = 1024;

// --- 以下是「辨識規則」，像是用關鍵字搜尋信件一樣，幫程式認出不同類型的檔案 ---

/** 辨識 PDF 檔案的副檔名 */
const PDF_PATTERN = /\.pdf/i;

/** 辨識 Excel 檔案的各種副檔名（.xls / .xlsx / .xlsm / .xlsb） */
const EXCEL_PATTERN = /\.(xls|xlsx|xlsm|xlsb)/i;

/** 辨識文字中是否提到 Excel 相關關鍵字 */
const EXCEL_KEYWORD_PATTERN = /\bexcel\b|\bxls(x|m|b)?\b/i;

/** 辨識檔名中是否包含「資安聯防監控月報」——這就是我們要找的目標報告 */
const REPORT_FILE_PATTERN = /資安聯防監控月報/i;

/** 辨識「威脅指標」檔案——這類檔案長得很像月報，但不是我們要的，需要排除 */
const THREAT_INDICATOR_PATTERN = /威脅指標/i;

/** 一天有幾毫秒（用來做日期計算，就像知道一天有 24 小時一樣基本） */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ============================================================
// 工具函數 — 主流程會重複用到的小幫手，像廚房裡的各種器具
// ============================================================

/**
 * 取得「台北時間」的時間戳記（UTC+8）。
 * 因為我們在台灣使用，所有日誌和檔名都統一用台北時間，方便對照。
 */
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

/**
 * 印出一行日誌訊息，前面會自動加上台北時間與圖示。
 * 像是在筆記本上寫「幾點幾分做了什麼事」，方便事後排查問題。
 */
function log(icon: string, message: string): void {
  const ts = taipeiTimestamp();
  console.log('[' + ts + '] ' + icon + ' ' + message);
}

/**
 * 載入 .env 設定檔。.env 就像一張「密碼小抄」，把帳號密碼等機密資料
 * 寫在這個檔案裡，程式執行時再讀取，避免把密碼直接寫死在程式碼中。
 * 這裡自己手動解析，不需要額外安裝套件，離線環境也能用。
 */
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

/**
 * 確保「output」資料夾存在。就像寄包裹前先確認收件地址存在一樣，
 * 如果資料夾還沒建立，就自動建好，避免後續存檔時找不到地方放。
 */
function ensureOutputDir(): void {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    log('📁', '已建立輸出目錄: ' + OUTPUT_DIR);
  }
}

/**
 * 決定「穩定下載目錄」的位置。有些網站會直接觸發瀏覽器下載（不經過程式），
 * 檔案會掉進系統的「下載」資料夾。這個函數找出那個資料夾在哪裡，
 * 也可以透過環境變數 NCERT_STABLE_DOWNLOAD_DIR 自訂路徑。
 */
function resolveStableDownloadDir(): string {
  const configuredDir = (process.env.NCERT_STABLE_DOWNLOAD_DIR ?? '').trim();
  return configuredDir ? path.resolve(configuredDir) : DEFAULT_STABLE_DOWNLOAD_DIR;
}

/**
 * 驗證下載回來的 PDF 是否「真的是 PDF」。就像收到包裹要拆開看看裡面對不對：
 * 1. 檔案存不存在？ 2. 大小是否合理（太小可能是錯誤頁面）？
 * 3. 開頭是否有 %PDF 標記（PDF 的身分證）？通過才算合格。
 */
function verifyPdfIntegrity(filePath: string, minSizeBytes = MIN_VALID_PDF_SIZE_BYTES): number {
  if (!fs.existsSync(filePath)) {
    throw new Error('找不到下載檔案: ' + filePath);
  }

  const stat = fs.statSync(filePath);
  if (stat.size < minSizeBytes) {
    throw new Error(
      'PDF 檔案過小，疑似錯誤頁（' + stat.size + ' bytes < ' + minSizeBytes + ' bytes）: ' + filePath
    );
  }

  const headerBuffer = Buffer.alloc(5);
  const fd = fs.openSync(filePath, 'r');
  let bytesRead = 0;
  try {
    bytesRead = fs.readSync(fd, headerBuffer, 0, headerBuffer.length, 0);
  } finally {
    fs.closeSync(fd);
  }

  const header = headerBuffer.toString('utf8', 0, bytesRead);
  if (!header.startsWith('%PDF')) {
    throw new Error('檔案非有效 PDF（缺少 %PDF 檔頭）: ' + filePath);
  }

  return stat.size;
}

/**
 * 解決檔名衝突。如果目標位置已經有同名檔案，就自動加上編號，
 * 例如「月報.pdf」→「月報 (1).pdf」→「月報 (2).pdf」，跟 Windows 檔案複製行為一樣。
 */
function resolveNonConflictingPath(targetPath: string): string {
  if (!fs.existsSync(targetPath)) return targetPath;
  const parsed = path.parse(targetPath);
  let suffix = 1;
  let candidate = path.join(parsed.dir, parsed.name + ' (' + suffix + ')' + parsed.ext);
  while (fs.existsSync(candidate)) {
    suffix++;
    candidate = path.join(parsed.dir, parsed.name + ' (' + suffix + ')' + parsed.ext);
  }
  return candidate;
}

/** 解析後的上傳日期：包含 ISO 格式日期字串，以及用於比較先後的數值 */
type ParsedUploadDate = {
  isoDate: string;
  utcDayKey: number;
};

/** PDF 候選檔案的資訊卡：記錄在表格第幾列、連結在哪、檔名、上傳日期等 */
type PdfCandidate = {
  rowIndex: number;
  link: Locator;
  fileName: string;
  rowText: string;
  uploadDate: ParsedUploadDate | null;
};

/** Excel 候選檔案的資訊卡，結構與 PDF 候選相同 */
type ExcelCandidate = {
  rowIndex: number;
  link: Locator;
  fileName: string;
  rowText: string;
  uploadDate: ParsedUploadDate | null;
};

/**
 * 將「年、月、日」轉換成電腦內部的時間數值（毫秒）。
 * 同時檢查日期是否合理（例如 2 月 30 日就不合理），不合理就回傳 null。
 */
function toDateEpochMs(year: number, month: number, day: number): number | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) {
    return null;
  }
  return d.getTime();
}

/**
 * 把日期轉成「第幾天」的編號（從 1970 年 1 月 1 日起算）。
 * 這樣兩個日期相減就能知道差幾天，方便比較哪份報告比較新。
 */
function toUtcDayKey(year: number, month: number, day: number): number | null {
  const epochMs = toDateEpochMs(year, month, day);
  if (epochMs === null) return null;
  return Math.floor(epochMs / MS_PER_DAY);
}

/**
 * 從一段文字中找出上傳日期。支援兩種常見格式：
 * - 數字格式：113/06/15 或 2024-06-15
 * - 中文格式：113年06月15日
 * 如果年份是三位數（如 113），會自動加上 1911 轉成西元年（民國 → 西元）。
 */
function parseUploadDateFromText(text: string): ParsedUploadDate | null {
  const datePatterns = [
    // 格式一：用 / - . 分隔的日期，例如 113/06/15
    /(^|[^\d])(\d{3,4})[\/\-.](0?[1-9]|1[0-2])[\/\-.](0?[1-9]|[12]\d|3[01])(?=$|[^\d])/g,
    // 格式二：中文年月日，例如 113年6月15日
    /(^|[^\d])(\d{3,4})\s*年\s*(0?[1-9]|1[0-2])\s*月\s*(0?[1-9]|[12]\d|3[01])\s*日(?=$|[^\d])/g
  ];
  for (const datePattern of datePatterns) {
    const matches = text.matchAll(datePattern);
    for (const m of matches) {
      const rawYear = Number(m[2]);
      const month = Number(m[3]);
      const day = Number(m[4]);
      // 三位數年份 = 民國年，加 1911 轉換為西元年
      const year = m[2].length === 3 ? rawYear + 1911 : rawYear;
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

/**
 * 取得「現在台北是幾月幾號」。用來跟報告的上傳日期做比較，
 * 判斷下載到的報告是不是最新的那一份。
 */
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

/**
 * 判斷這個檔名是不是我們真正要的「月報」。
 * 規則：檔名要包含「資安聯防監控月報」，但不能包含「威脅指標」
 * （因為威脅指標是另一種報告，容易混淆）。
 */
function isPreferredMonthlyReportFile(fileName: string): boolean {
  return REPORT_FILE_PATTERN.test(fileName) && !THREAT_INDICATOR_PATTERN.test(fileName);
}

// ============================================================
// 主流程
// ============================================================
// 以下是整個腳本的「大腦」：依序完成登入→找報告→下載→登出
// 就像一位助理幫你自動完成瀏覽器上的所有操作步驟

async function main(): Promise<void> {
  // 整體流程：載入設定 → 連上既有 Chrome → 登入 → 找 PDF / Excel 並下載 → 登出
  // 【第 1 步】載入設定檔（.env），就像開工前先看備忘錄，確認帳號密碼等設定值已就位
  loadDotEnv();

  // 【第 2 步】驗證帳號密碼是否已設定
  // 沒有帳密就無法登入 NCERT，就像沒帶鑰匙進不了門
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

  // 【第 3 步】準備下載檔案要放的資料夾
  // 「穩定落地目錄」= 讓使用者在檔案總管容易找到的地方（如系統「下載」資料夾）
  // 另外也會存一份到專案的 output 目錄當備份，確保檔案不會搞丟
  ensureOutputDir();
  const preferredStableDownloadDir = resolveStableDownloadDir();
  const configuredStableSource = (process.env.NCERT_STABLE_DOWNLOAD_DIR ?? '').trim()
    ? 'NCERT_STABLE_DOWNLOAD_DIR'
    : '系統 Downloads';
  let stableDownloadDir = preferredStableDownloadDir;
  try {
    fs.mkdirSync(stableDownloadDir, { recursive: true });
    fs.accessSync(stableDownloadDir, fs.constants.W_OK);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    log('⚠️', '穩定落地目錄不可用: ' + stableDownloadDir + '，原因: ' + reason + '；改用專案 output');
    stableDownloadDir = OUTPUT_DIR;
  }
  const stableDirSource = path.resolve(stableDownloadDir) === path.resolve(preferredStableDownloadDir)
    ? configuredStableSource
    : 'fallback: 專案 output';
  log(
    'ℹ️',
    '下載落地策略：專案輸出=' + OUTPUT_DIR + '；穩定落地=' + stableDownloadDir
    + ' (' + stableDirSource + ')'
  );
  log('ℹ️', '說明：Chrome 下載列可能顯示暫存位置，請以上述落地路徑為準');

  let browser: Browser | null = null;

  try {
    // 【第 4 步】用「遙控器」連上你已經打開的 Chrome
    // CDP（Chrome DevTools Protocol）就像一條遙控線，
    // 讓腳本可以操作你已經登入的 Chrome，而不是重新開一個新的瀏覽器
    log('🔗', '正在連接 Chrome CDP (http://localhost:' + cdpPort + ') ...');
    browser = await chromium.connectOverCDP('http://localhost:' + cdpPort);
    log('✅', 'Chrome CDP 連接成功');

    // 列出目前 Chrome 裡開了哪些分頁（方便除錯記錄）
    const connectedPages = browser.contexts()
      .flatMap((ctx) => ctx.pages())
      .map((p) => p.url())
      .filter((url) => validateUrl(url));
    log('ℹ️', 'CDP pages: ' + (connectedPages.join(', ') || '(none)'));

    // 【第 5 步】找一個可以用的分頁
    // 優先使用你已經打開的 NCERT 頁面；如果沒有，就開一個新分頁
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

    // 如果沒找到已開啟的 NCERT 頁面，就開一個新分頁
    if (!page) {
      const ctx = contexts.length > 0 ? contexts[0] : await browser.newContext();
      page = await ctx.newPage();
      log('ℹ️', '已開啟新分頁');
    }

    // 【第 6 步】打開 NCERT 網站首頁
    // `networkidle` = 等到網頁完全載入完畢（不再有資料在傳輸），才繼續下一步
    log('🌐', '正在導航到 ' + TARGET_URL + ' ...');
    if (!validateUrl(TARGET_URL)) {
      throw new Error('不允許的 URL: ' + TARGET_URL);
    }
    await page.goto(TARGET_URL, { waitUntil: 'networkidle' });
    log('✅', '已載入 NCERT 首頁');

    // 【第 7 步】自動填入帳號密碼並按下登入
    // 就像有人幫你在登入畫面輸入帳密、按下「登入」按鈕
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

    // 【第 8 步】點擊或導航到「資安聯防監控月報」頁面
    // 先走最直覺路徑；若選單需要滑鼠移入（hover）才會展開子選單，這裡也會嘗試模擬，必要時再直接輸入網址
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
        // 直接找不到連結 → 改用「滑鼠移到父選單上」讓子選單彈出來
        // 就像去餐廳點餐，要先打開主菜單才看得到細項
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
            // 模擬滑鼠移上去（hover）
            try { await pm.hover(); } catch {}
            // 有些網站需要額外的事件才會反應，所以多送幾種「滑鼠進入」訊號
            try {
              await pm.dispatchEvent('pointerenter');
              await pm.dispatchEvent('pointerover');
              await pm.dispatchEvent('mouseenter');
              await pm.dispatchEvent('mouseover');
              await pm.focus();
            } catch {}
            // 用模擬滑鼠移動來觸發選單展開（有些網站需要「真的」看到滑鼠經過）
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
      // 最後的備案（fallback）：直接在網址列輸入月報頁面的網址
      log('⚠️', '未找到資安聯防監控月報連結或 hover 顯示失敗，嘗試直接導航至列表頁 Post2/list.do');
      const listUrl = 'https://www.ncert.nat.gov.tw/Post2/list.do';
      if (!validateUrl(listUrl)) {
        throw new Error('不允許的 URL: ' + listUrl);
      }
      await page.goto(listUrl, { waitUntil: 'networkidle' });
      log('✅', '已直接導航至月報列表頁');
    }

    // 【第 9 步】從網頁表格中找出所有 PDF 檔案，挑出「上傳日期最接近今天」的那一個
    // 想像你面前有一份報告清單，每份報告都有上傳日期——
    // 這段程式會像助理一樣，幫你逐列掃描表格、辨識所有 PDF 連結，
    // 然後選出日期離今天最近的那份來下載
    log('🔍', '嘗試從「資安聯防監控月報」表格所有 PDF 候選中選取最接近 CurrentDate 的檔案...');
    // Locator = Playwright 用來「在網頁中指認特定元素」的方式，像是指著說「就是那個按鈕」
    let targetLink: Locator | null = null;
    let selectedCandidate: PdfCandidate | null = null;
    try {
      // 先找到含有「資安聯防監控月報」文字的區塊，再定位它附近的表格
      const section = page.locator('text=/資安聯防監控月報/i');
      let table: Locator | null = null;
      // 逐一檢查頁面上所有表格，找出同時包含「上傳日期」和「檔案名稱」欄位的那一個
      const allTables = page.locator('table');
      const allTableCount = await allTables.count();
      for (let i = 0; i < allTableCount; i++) {
        const candidateTable = allTables.nth(i);
        const tableText = (await candidateTable.innerText()).replace(/\s+/g, ' ');
        if (!/上傳日期/.test(tableText) || !/檔案名稱/.test(tableText)) continue;
        if (!/資安聯防監控月報/.test(tableText)) continue;
        table = candidateTable;
        break;
      }

      if (!table && await section.count() > 0) {
        table = section.first().locator('xpath=following::table[1]');
        log('⚠️', '未找到符合欄位特徵的目標表格，改用標題後第一個 table fallback');
      }

      if (table) {
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
        // 這個小幫手負責「鑑定」一個元素是不是 PDF 下載連結，是的話就加入候選名單
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

        // 逐列掃描表格：每一列可能包含 PDF 連結、PDF 文字、PDF 圖示等多種線索
        // 用五種偵測方式「地毯式搜索」，確保不漏掉任何下載連結
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
            // 找到 PDF 文字後，往上找它的「可點擊父元素」（連結、按鈕等）
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

          // 有些 PDF 是用圖示（小 icon）來表示，同樣往上找可點擊的父元素
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

        // 如果一個候選都沒找到，印出每列的診斷資訊，幫助排查問題
        if (candidates.length === 0) {
          for (const rowDiagnostic of rowDiagnostics) {
            log('🔎', 'PDF 候選診斷: ' + JSON.stringify(rowDiagnostic));
          }
          log('❌', '表格中找不到可下載的 PDF 候選');
          throw new Error('找不到可下載的 PDF 候選');
        }

        // 所有 PDF 候選找完了，接下來要挑出「最新」的那一份
        // 選擇邏輯：優先選「上傳日期 ≤ 今天」中最接近今天的；
        // 如果都是未來日期，則選最近的未來日期；日期相同時，偏好檔名含「月報」的
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

          // 計算每個候選距離今天幾天，日期差最小的勝出（平手時看檔名、列序）
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
          // 如果所有候選都無法辨識上傳日期，退而求其次選第一個
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

    // 【第 10 步】下載選定的 PDF 檔案
    await targetLink.waitFor({ state: 'visible', timeout: 15000 });
    const pdfText = (await targetLink.textContent())?.trim() ?? selectedCandidate?.fileName ?? '(unknown)';
    log('📄', '找到目標連結: ' + pdfText);

    // 觸發下載：先建立 waitForEvent('download') 再點擊，避免下載事件太快而漏接
    // 就像先打開收件通知，再按下下載連結，確保瀏覽器一開始下載就能被接住
    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
    await targetLink.click();
    const download: Download = await downloadPromise;
    const downloadFailure = await download.failure();
    if (downloadFailure) {
      log('❌', '下載失敗: ' + downloadFailure);
      throw new Error('下載失敗: ' + downloadFailure);
    }
    const suggested = download.suggestedFilename() ?? '';
    const fallbackName = 'ncert-report-' + new Date().toISOString().replace(/[:.]/g, '-') + '.pdf';

    const filename = suggested || fallbackName;
    const ensuredPdf = filename.toLowerCase().endsWith('.pdf') ? filename : (filename + '.pdf');
    // safeFileName = 把檔名中可能造成問題的字元（如 / \ : 等）替換掉，避免存檔失敗
    const safeBase = safeFileName(ensuredPdf);
    const safeFilename = safeBase.toLowerCase().endsWith('.pdf') ? safeBase : (safeBase + '.pdf');

    // 儲存到專案 output 目錄；檔名會先淨化，再透過 resolveNonConflictingPath 自動避開同名覆寫
    const intendedSavePath = path.join(OUTPUT_DIR, safeFilename);
    const savePath = resolveNonConflictingPath(intendedSavePath);
    if (path.resolve(savePath) !== path.resolve(intendedSavePath)) {
      log('⚠️', '專案 output 已存在同名檔案，改以新檔名避免覆寫: ' + savePath);
    }
    try {
      await download.saveAs(savePath);
      const outputFileSize = verifyPdfIntegrity(savePath);
      log('✅', '月報已儲存至專案 output: ' + savePath + ' (' + outputFileSize + ' bytes)');

      // 額外複製一份到「穩定落地目錄」（如系統下載資料夾），方便使用者直接找到檔案
      let userVisiblePath = savePath;
      if (path.resolve(stableDownloadDir) === path.resolve(path.dirname(savePath))) {
        log('ℹ️', '穩定落地目錄與 output 相同，略過同步複製: ' + savePath);
      } else {
        const intendedStableSavePath = path.join(stableDownloadDir, safeFilename);
        const stableSavePath = resolveNonConflictingPath(intendedStableSavePath);
        if (path.resolve(stableSavePath) !== path.resolve(intendedStableSavePath)) {
          log('⚠️', '穩定落地目錄已存在同名檔案，改以新檔名避免覆寫: ' + stableSavePath);
        }
        fs.copyFileSync(savePath, stableSavePath);
        const stableFileSize = verifyPdfIntegrity(stableSavePath);
        log('✅', '已同步可見下載檔案至: ' + stableSavePath + ' (' + stableFileSize + ' bytes)');
        userVisiblePath = stableSavePath;
      }

      if (path.resolve(userVisiblePath) === path.resolve(savePath)) {
        log('📍', '檔案位置：' + savePath);
      } else {
        log('📍', '檔案位置：可見下載=' + userVisiblePath + '；專案備份=' + savePath);
      }
    } catch (err) {
      log('❌', '儲存下載檔案失敗: ' + (err as Error).message);
      throw err;
    }

    // 【第 11 步】下載 Excel 版月報（和 PDF 流程類似，只是目標改為 Excel 檔案）
    // 以下掃描、選擇、下載的邏輯與前面 PDF 段落相同，不再重複詳細說明
    log('📊', '開始續流程：嘗試下載 Post/list.do 中最接近 CurrentDate 的 Excel');
    try {
      const excelListUrl = 'https://www.ncert.nat.gov.tw/Post/list.do';
      if (!validateUrl(excelListUrl)) {
        throw new Error('不允許的 URL: ' + excelListUrl);
      }
      await page.goto(excelListUrl, { waitUntil: 'networkidle' });
      log('✅', '已進入 Excel 列表頁: ' + excelListUrl);

      let excelTargetLink: Locator | null = null;
      let selectedExcelCandidate: ExcelCandidate | null = null;
      let excelSkipReason = '';

      const section = page.locator('text=/資安聯防監控月報|威脅指標|月報|Excel|XLS/i');
      let table: Locator | null = null;
      const allTables = page.locator('table');
      const allTableCount = await allTables.count();
      for (let i = 0; i < allTableCount; i++) {
        const candidateTable = allTables.nth(i);
        const tableText = (await candidateTable.innerText()).replace(/\s+/g, ' ');
        if (!/上傳日期/.test(tableText) || !/檔案名稱/.test(tableText)) continue;
        table = candidateTable;
        break;
      }

      if (!table && await section.count() > 0) {
        table = section.first().locator('xpath=following::table[1]');
        log('⚠️', 'Excel 未找到符合欄位特徵的表格，改用標題後第一個 table fallback');
      }
      if (!table && allTableCount > 0) {
        table = allTables.first();
        log('⚠️', 'Excel 無法定位目標區塊，改用第一個 table fallback');
      }

      if (table) {
        let rows = table.locator('tbody tr');
        let rowsCount = await rows.count();
        if (rowsCount === 0) {
          rows = table.locator('tr');
          rowsCount = await rows.count();
        }

        const candidates: ExcelCandidate[] = [];
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
        // （同 PDF 的 addPdfCandidate，改為偵測 Excel 相關關鍵字）
        const addExcelCandidate = async (
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
              const title = el.getAttribute('title') ?? '';
              const ariaLabel = el.getAttribute('aria-label') ?? '';
              const tag = el.tagName.toLowerCase();
              return { text, href, onclick, alt, title, ariaLabel, tag };
            });
            const isExcelCandidate = EXCEL_PATTERN.test(metadata.text)
              || EXCEL_PATTERN.test(metadata.href)
              || EXCEL_PATTERN.test(metadata.onclick)
              || EXCEL_KEYWORD_PATTERN.test(metadata.text)
              || EXCEL_KEYWORD_PATTERN.test(metadata.alt)
              || EXCEL_KEYWORD_PATTERN.test(metadata.title)
              || EXCEL_KEYWORD_PATTERN.test(metadata.ariaLabel);
            if (!isExcelCandidate) return;

            const dedupeKey = [
              rowIndex,
              metadata.tag,
              metadata.href,
              metadata.onclick,
              metadata.text,
              metadata.alt,
              metadata.title,
              metadata.ariaLabel
            ].join('|');
            if (seenCandidateKeys.has(dedupeKey)) return;
            seenCandidateKeys.add(dedupeKey);

            const hrefName = metadata.href.split('#')[0].split('?')[0].split('/').filter(Boolean).pop() ?? '';
            const fileName = metadata.text || hrefName || metadata.title || metadata.ariaLabel || metadata.alt || '(unknown)';
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
          if (tdCount === 0) continue;
          dataRowIndex++;
          const rowText = (await r.innerText()).replace(/\s+/g, ' ').trim();
          const uploadDate = parseUploadDateFromText(rowText);
          const rowTextSummary = rowText.length > 120 ? rowText.slice(0, 120) + '…' : rowText;

          const excelLinksInRow = r.getByRole('link', { name: /excel|xls|xlsx|xlsm|xlsb/i });
          const excelLinksCount = await excelLinksInRow.count();

          const excelTextsInRow = r.getByText(/excel|xls|xlsx|xlsm|xlsb/i);
          const excelTextsCount = await excelTextsInRow.count();

          const hrefExcelCandidatesInRow = r.locator(
            'a[href*=".xls" i], a[href*=".xlsx" i], a[href*=".xlsm" i], a[href*=".xlsb" i], '
            + 'a[download*=".xls" i], a[download*=".xlsx" i], a[download*=".xlsm" i], a[download*=".xlsb" i]'
          );
          const hrefExcelCount = await hrefExcelCandidatesInRow.count();

          const onclickExcelCandidatesInRow = r.locator(
            '[onclick*=".xls" i], [onclick*=".xlsx" i], [onclick*=".xlsm" i], [onclick*=".xlsb" i], [onclick*="excel" i]'
          );
          const onclickExcelCount = await onclickExcelCandidatesInRow.count();

          const excelIconsInRow = r.locator(
            'img[alt*="excel" i], img[alt*="xls" i], img[alt*="xlsx" i], img[src*="excel" i], img[src*="xls" i]'
          );
          const excelIconCount = await excelIconsInRow.count();

          rowDiagnostics.push({
            rowIndex: dataRowIndex,
            rowTextSummary,
            linkCount: excelLinksCount,
            textCount: excelTextsCount,
            hrefCount: hrefExcelCount,
            onclickCount: onclickExcelCount,
            iconCount: excelIconCount
          });

          for (let j = 0; j < excelLinksCount; j++) {
            await addExcelCandidate(excelLinksInRow.nth(j), dataRowIndex, rowText, uploadDate);
          }

          for (let j = 0; j < excelTextsCount; j++) {
            const textMatch = excelTextsInRow.nth(j);
            let matchedClickableAncestor = false;
            const textBasedCandidates = [
              textMatch.locator('xpath=ancestor-or-self::a[1]'),
              textMatch.locator('xpath=ancestor-or-self::*[@role="link"][1]'),
              textMatch.locator('xpath=ancestor-or-self::button[1]'),
              textMatch.locator('xpath=ancestor-or-self::*[@onclick][1]')
            ];
            for (const candidate of textBasedCandidates) {
              if (await candidate.count() === 0) continue;
              await addExcelCandidate(candidate.first(), dataRowIndex, rowText, uploadDate);
              matchedClickableAncestor = true;
              break;
            }
            if (!matchedClickableAncestor) {
              const textSnippet = ((await textMatch.textContent()) ?? '').replace(/\s+/g, ' ').trim();
              log('⚠️', '第' + dataRowIndex + '列偵測到 Excel 文字但找不到可點擊元素: ' + (textSnippet || '(empty)'));
            }
          }

          for (let j = 0; j < hrefExcelCount; j++) {
            await addExcelCandidate(hrefExcelCandidatesInRow.nth(j), dataRowIndex, rowText, uploadDate);
          }

          for (let j = 0; j < onclickExcelCount; j++) {
            await addExcelCandidate(onclickExcelCandidatesInRow.nth(j), dataRowIndex, rowText, uploadDate);
          }

          for (let j = 0; j < excelIconCount; j++) {
            const icon = excelIconsInRow.nth(j);
            const iconBasedCandidates = [
              icon.locator('xpath=ancestor-or-self::a[1]'),
              icon.locator('xpath=ancestor-or-self::*[@role="link"][1]'),
              icon.locator('xpath=ancestor-or-self::button[1]'),
              icon.locator('xpath=ancestor-or-self::*[@onclick][1]')
            ];
            for (const candidate of iconBasedCandidates) {
              if (await candidate.count() === 0) continue;
              await addExcelCandidate(candidate.first(), dataRowIndex, rowText, uploadDate);
              break;
            }
          }
        }

        if (candidates.length === 0) {
          for (const rowDiagnostic of rowDiagnostics) {
            log('🔎', 'Excel 候選診斷: ' + JSON.stringify(rowDiagnostic));
          }
          excelSkipReason = '表格中找不到可下載的 Excel 候選';
          log('⚠️', excelSkipReason + '（將略過 Excel 並繼續登出）');
        } else {
          const currentDate = getTaipeiCurrentDate();
          const candidateSummary = candidates.map((c) => ({
            rowIndex: c.rowIndex,
            fileName: c.fileName,
            uploadDate: c.uploadDate?.isoDate ?? null
          }));
          log('ℹ️', 'CurrentDate=' + currentDate.isoDate + '，候選 Excel 數=' + candidates.length);
          log('ℹ️', 'Excel 候選摘要: ' + JSON.stringify(candidateSummary));

          const datedCandidates = candidates.filter((c) => c.uploadDate !== null);
          if (datedCandidates.length > 0) {
            const pastOrToday = datedCandidates.filter(
              (c) => (c.uploadDate as ParsedUploadDate).utcDayKey <= currentDate.utcDayKey
            );
            const usePastOrToday = pastOrToday.length > 0;
            const pool = usePastOrToday ? pastOrToday : datedCandidates;
            const selectionRule = usePastOrToday
              ? 'Excel 規則1：uploadDate <= CurrentDate 且最接近者'
              : 'Excel 規則2：全部為未來日期，選最接近未來者';

            const tieBreakCandidates = pool.map((c) => {
              const uploadDayKey = (c.uploadDate as ParsedUploadDate).utcDayKey;
              const dayDiff = usePastOrToday
                ? currentDate.utcDayKey - uploadDayKey
                : uploadDayKey - currentDate.utcDayKey;
              return {
                rowIndex: c.rowIndex,
                fileName: c.fileName,
                uploadDate: c.uploadDate?.isoDate ?? null,
                dayDiff
              };
            });
            const minDayDiff = Math.min(...tieBreakCandidates.map((c) => c.dayDiff));
            const topTies = tieBreakCandidates.filter((c) => c.dayDiff === minDayDiff);
            if (topTies.length > 1) {
              log('ℹ️', 'Excel tie-break 啟動（同 dayDiff=' + minDayDiff + '）: ' + JSON.stringify(topTies));
            }

            pool.sort((a, b) => {
              const aDayKey = (a.uploadDate as ParsedUploadDate).utcDayKey;
              const bDayKey = (b.uploadDate as ParsedUploadDate).utcDayKey;
              const aDiff = usePastOrToday ? currentDate.utcDayKey - aDayKey : aDayKey - currentDate.utcDayKey;
              const bDiff = usePastOrToday ? currentDate.utcDayKey - bDayKey : bDayKey - currentDate.utcDayKey;
              if (aDiff !== bDiff) return aDiff - bDiff;
              if (a.rowIndex !== b.rowIndex) return a.rowIndex - b.rowIndex;
              return 0;
            });

            selectedExcelCandidate = pool[0];
            excelTargetLink = selectedExcelCandidate.link;
            log('✅', selectionRule + '，已選定 Excel: ' + JSON.stringify({
              rowIndex: selectedExcelCandidate.rowIndex,
              uploadDate: selectedExcelCandidate.uploadDate?.isoDate ?? null,
              fileName: selectedExcelCandidate.fileName
            }));
          } else {
            selectedExcelCandidate = candidates[0];
            excelTargetLink = selectedExcelCandidate.link;
            log('⚠️', 'Excel 規則 fallback：所有候選皆無法解析日期，改選第一個 Excel: ' + JSON.stringify({
              rowIndex: selectedExcelCandidate.rowIndex,
              fileName: selectedExcelCandidate.fileName,
              rowText: selectedExcelCandidate.rowText
            }));
          }
        }
      } else {
        excelSkipReason = '找不到可用表格（包含 fallback）';
      }

      if (!excelTargetLink) {
        log('⚠️', 'Excel 續流程未執行下載，原因: ' + (excelSkipReason || '未選定可下載連結'));
      } else {
        await excelTargetLink.waitFor({ state: 'visible', timeout: 15000 });
        const excelText = (await excelTargetLink.textContent())?.trim() ?? selectedExcelCandidate?.fileName ?? '(unknown)';
        // 找到 Excel 連結後，執行下載（流程同 PDF 下載）
        log('📄', '找到 Excel 目標連結: ' + excelText);

        const excelDownloadPromise = page.waitForEvent('download', { timeout: 30000 });
        await excelTargetLink.click();
        const excelDownload: Download = await excelDownloadPromise;
        const excelDownloadFailure = await excelDownload.failure();
        if (excelDownloadFailure) {
          throw new Error('Excel 下載失敗: ' + excelDownloadFailure);
        }

        const excelSuggested = excelDownload.suggestedFilename() ?? '';
        const excelFallbackName = 'ncert-report-excel-' + new Date().toISOString().replace(/[:.]/g, '-') + '.xlsx';
        const excelFilename = excelSuggested || excelFallbackName;
        // 檔名淨化與存檔（同 PDF 的做法）
        const safeExcelBase = safeFileName(excelFilename);
        const safeExcelFilename = path.extname(safeExcelBase)
          ? safeExcelBase
          : (safeExcelBase + '.xlsx');

        const intendedExcelSavePath = path.join(OUTPUT_DIR, safeExcelFilename);
        const excelSavePath = resolveNonConflictingPath(intendedExcelSavePath);
        if (path.resolve(excelSavePath) !== path.resolve(intendedExcelSavePath)) {
          log('⚠️', 'Excel 專案 output 已存在同名檔案，改以新檔名避免覆寫: ' + excelSavePath);
        }
        await excelDownload.saveAs(excelSavePath);
        const excelOutputFileSize = fs.statSync(excelSavePath).size;
        if (excelOutputFileSize <= 0) {
          throw new Error('Excel 檔案大小為 0 bytes，疑似下載異常: ' + excelSavePath);
        }
        log('✅', 'Excel 已儲存至專案 output: ' + excelSavePath + ' (' + excelOutputFileSize + ' bytes)');

        // 同 PDF，額外複製一份到穩定落地目錄
        let excelUserVisiblePath = excelSavePath;
        if (path.resolve(stableDownloadDir) === path.resolve(path.dirname(excelSavePath))) {
          log('ℹ️', 'Excel 穩定落地目錄與 output 相同，略過同步複製: ' + excelSavePath);
        } else {
          const intendedStableExcelPath = path.join(stableDownloadDir, safeExcelFilename);
          const stableExcelPath = resolveNonConflictingPath(intendedStableExcelPath);
          if (path.resolve(stableExcelPath) !== path.resolve(intendedStableExcelPath)) {
            log('⚠️', 'Excel 穩定落地目錄已存在同名檔案，改以新檔名避免覆寫: ' + stableExcelPath);
          }
          fs.copyFileSync(excelSavePath, stableExcelPath);
          const stableExcelSize = fs.statSync(stableExcelPath).size;
          if (stableExcelSize <= 0) {
            throw new Error('Excel 穩定落地檔案大小為 0 bytes，疑似複製異常: ' + stableExcelPath);
          }
          log('✅', 'Excel 已同步可見下載檔案至: ' + stableExcelPath + ' (' + stableExcelSize + ' bytes)');
          excelUserVisiblePath = stableExcelPath;
        }

        if (path.resolve(excelUserVisiblePath) === path.resolve(excelSavePath)) {
          log('📍', 'Excel 檔案位置：' + excelSavePath);
        } else {
          log('📍', 'Excel 檔案位置：可見下載=' + excelUserVisiblePath + '；專案備份=' + excelSavePath);
        }
      }
    // Excel 下載失敗不會中斷整個流程——PDF 已經下載成功，繼續執行登出
    } catch (excelError: unknown) {
      const excelErr = excelError instanceof Error ? excelError : new Error(String(excelError));
      log('⚠️', 'Excel 續流程失敗，將繼續登出: ' + excelErr.message);
    }

    // 【最後一步】登出 NCERT 系統
    // 用完要登出，就像離開辦公室要鎖門一樣
    log('🚪', '正在登出 ...');
    const logoutLink = page.getByRole('link', { name: '登出' });
    await logoutLink.waitFor({ state: 'visible', timeout: 10000 });
    await logoutLink.click();
    await page.waitForLoadState('networkidle');
    log('✅', '已成功登出');

    log('🎉', 'NCERT 月報下載流程完成！');
  // 如果上面任何步驟出錯，會跳到這裡統一處理，並印出錯誤訊息供除錯
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    log('❌', '執行失敗: ' + err.message);
    if (err.stack) {
      log('📝', 'Stack trace:\n' + err.stack);
    }
    process.exit(1);
  } finally {
    // 清理：只釋放程式內的 CDP 連線參考，把「遙控器」放下，不主動關閉使用者本來開著的 Chrome
    browser = null;
    log('🧹', '已釋放 CDP 連線參考（Chrome 保持運行）');
  }
}

// ============================================================
// 執行入口：程式從這裡開始跑，呼叫上面的 main() 函數
// ============================================================

main();
