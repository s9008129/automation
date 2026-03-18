/**
 * 🌐 瀏覽器 / 任務上下文 Helper
 *
 * 提供任務腳本常用的 Playwright 輔助函數：
 * - 啟動 Edge 瀏覽器（任務執行模式）
 * - 連接已開啟的 CDP 瀏覽器（RPA-Cowork 素材蒐集模式）
 * - 雙層 iframe 存取
 * - 頁面等待與截圖工具
 */

import { chromium, type Browser, type BrowserContext, type Page, type FrameLocator } from 'playwright';
import { log, logError, formatError } from './logger.js';

// ============================================================
// 常數
// ============================================================

/** 預設 CDP Debug 連接端口 */
export const DEFAULT_CDP_PORT = 9222;

/** Chromium branded browser 內部頁面 URL scheme 前綴 — 必須過濾 */
export const INTERNAL_URL_PREFIXES = [
  'chrome://',
  'chrome-extension://',
  'chrome-untrusted://',
  'edge://',
  'edge-extension://',
  'devtools://',
  'about:blank',
  'about:srcdoc',
] as const;

// ============================================================
// 型別定義
// ============================================================

/** 任務執行選項 */
export interface TaskLaunchOptions {
  /** 瀏覽器頻道（預設 'msedge'） */
  channel?: string;
  /** 是否顯示瀏覽器視窗（預設 false，即 headless: false） */
  headless?: false;
  /** 視窗寬度（預設 1280） */
  width?: number;
  /** 視窗高度（預設 800） */
  height?: number;
  /** 額外的 launch 選項 */
  extraArgs?: string[];
}

/** 任務上下文，包含 browser / context / page */
export interface TaskContext {
  browser: Browser;
  context: BrowserContext;
  page: Page;
}

// ============================================================
// 任務執行模式（自動啟動 Edge）
// ============================================================

/**
 * 啟動 Edge 瀏覽器並建立任務上下文。
 * 使用 `channel: 'msedge'`，不需要 Playwright 下載瀏覽器，離線環境友善。
 *
 * @param options 啟動選項
 * @returns 任務上下文（browser, context, page）
 */
export async function launchTaskBrowser(options: TaskLaunchOptions = {}): Promise<TaskContext> {
  const {
    channel = 'msedge',
    headless = false,
    width = 1280,
    height = 800,
    extraArgs = [],
  } = options;

  log('🚀', `正在啟動瀏覽器（channel: ${channel}）...`);

  const browser = await chromium.launch({
    channel,
    headless,
    args: extraArgs,
  });

  const context = await browser.newContext({
    viewport: { width, height },
  });

  const page = await context.newPage();

  log('✅', '瀏覽器已啟動');
  return { browser, context, page };
}

/**
 * 關閉任務瀏覽器（正常結束流程時呼叫）。
 * 注意：若是 CDP 附加模式，請改用 cdpDisconnect() 而非此函數。
 */
export async function closeTaskBrowser(ctx: TaskContext): Promise<void> {
  try {
    await ctx.browser.close();
    log('🔌', '瀏覽器已關閉');
  } catch (err) {
    logError('關閉瀏覽器時發生錯誤', err);
  }
}

// ============================================================
// CDP 連接模式（附加到已登入的瀏覽器）
// ============================================================

/**
 * 連接到使用者已開啟的 Chrome / Edge CDP Debug 模式。
 * 不開新瀏覽器，不影響使用者已有的登入狀態。
 *
 * @param port CDP Debug 端口（預設 9222）
 * @returns Browser 物件（注意：斷開時請用 cdpDisconnect，不要呼叫 browser.close()）
 */
export async function cdpConnect(port = DEFAULT_CDP_PORT): Promise<Browser> {
  const endpoint = `http://localhost:${port}`;
  log('🔌', `正在連接 CDP（${endpoint}）...`);

  const browser = await chromium.connectOverCDP(endpoint);
  log('✅', '已連接 CDP');
  return browser;
}

/**
 * 斷開 CDP 連接（不關閉使用者的瀏覽器）。
 * 本專案原則：NEVER 呼叫 browser.close() 於 CDP 連接模式。
 *
 * 注意：在 CDP 連接模式下，browser.close() 只會斷開 Playwright 側的連接參考，
 * 不會真正關閉使用者的瀏覽器程序。與直接 launch 的瀏覽器不同。
 */
export async function cdpDisconnect(browser: Browser): Promise<void> {
  try {
    // 僅斷開 Playwright 側的參考，不關閉使用者瀏覽器
    await browser.close();
    log('🔌', '已斷開 CDP 連接（瀏覽器保持運行）');
  } catch {
    // CDP 連接斷開時 close() 可能拋錯，忽略即可
  }
}

/**
 * 判斷 URL 是否為瀏覽器內部頁面（應過濾，不操作）
 */
export function isInternalUrl(url: string): boolean {
  return INTERNAL_URL_PREFIXES.some(prefix => url.startsWith(prefix));
}

/**
 * 取得 CDP 瀏覽器中所有使用者可見頁面（過濾內部頁面）。
 */
export function getUserPages(browser: Browser): Page[] {
  const pages: Page[] = [];
  for (const context of browser.contexts()) {
    for (const page of context.pages()) {
      const url = page.url();
      if (!isInternalUrl(url) && url !== '') {
        pages.push(page);
      }
    }
  }
  return pages;
}

// ============================================================
// iframe 輔助
// ============================================================

/**
 * 取得標準雙層 iframe 的 FrameLocator（QIZ / EIP 系統常用）。
 *
 * @param page 頁面物件
 * @param outerSelector 外層 iframe 選擇器（預設 'iframe[name="mainFrame"]'）
 * @param innerSelector 內層 iframe 選擇器（預設 'iframe[name="v1"]'）
 */
export function getNestedFrame(
  page: Page,
  outerSelector = 'iframe[name="mainFrame"]',
  innerSelector = 'iframe[name="v1"]'
): FrameLocator {
  return page.frameLocator(outerSelector).frameLocator(innerSelector);
}

// ============================================================
// 頁面等待與錯誤擷取
// ============================================================

/**
 * 等待頁面導航完成，並在逾時時拋出含中文說明的錯誤。
 *
 * @param page 頁面物件
 * @param urlPattern 等待的 URL 模式（glob 或正規表示式）
 * @param timeoutMs 逾時毫秒數（預設 30000）
 * @param description 說明文字（用於錯誤訊息）
 */
export async function waitForNavigation(
  page: Page,
  urlPattern: string | RegExp,
  timeoutMs = 30000,
  description = '頁面導航'
): Promise<void> {
  try {
    await page.waitForURL(urlPattern, { timeout: timeoutMs });
  } catch (err) {
    const detail = formatError(err);
    throw new Error(
      `❌ 等待${description}逾時（${timeoutMs / 1000} 秒）。\n` +
        `目前 URL：${page.url()}\n` +
        `原始錯誤：${detail.message}`
    );
  }
}

/**
 * 嘗試截圖並儲存到指定路徑。失敗時記錄警告但不中斷流程。
 *
 * @param page 頁面物件
 * @param filePath 截圖儲存路徑
 * @param label 說明標籤（用於日誌）
 */
export async function takeScreenshot(page: Page, filePath: string, label: string): Promise<void> {
  try {
    await page.screenshot({ path: filePath, fullPage: true });
    log('📷', `截圖已儲存：${label}`);
  } catch (err) {
    try {
      // 全頁截圖失敗時降級為視窗截圖
      await page.screenshot({ path: filePath });
      log('📷', `截圖已儲存（降級模式）：${label}`);
    } catch (err2) {
      logError(`截圖失敗：${label}`, err2);
    }
  }
}
