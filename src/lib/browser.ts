/**
 * 🌐 browser.ts — 瀏覽器 Helper
 *
 * 封裝 Playwright 瀏覽器操作的常用工具。
 * 任務腳本模式（模式 B）：自動啟動 Edge 並自行登入。
 * 素材蒐集模式（模式 A）：連接已登入的 CDP Debug 瀏覽器。
 *
 * 使用方式：
 *   import { launchEdge, connectCDP } from './lib/browser.js';
 */

import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';

/** Chromium branded browser 內部頁面 URL scheme — 必須過濾 */
const INTERNAL_URL_PREFIXES = [
    'chrome://',
    'chrome-extension://',
    'chrome-untrusted://',
    'edge://',
    'edge-extension://',
    'devtools://',
    'about:blank',
    'about:srcdoc',
] as const;

/**
 * 判斷 URL 是否為使用者內容頁面（非瀏覽器內部頁面）。
 */
export function isUserContentPage(url: string): boolean {
    return !INTERNAL_URL_PREFIXES.some(prefix => url.startsWith(prefix));
}

/**
 * 模式 B：啟動系統已安裝的 Microsoft Edge。
 * 使用 channel: 'msedge'，不需要 Playwright 下載瀏覽器，離線環境友善。
 *
 * @param userDataDir 使用者資料目錄（若需要保留登入狀態）
 */
export async function launchEdge(userDataDir?: string): Promise<Browser> {
    if (userDataDir) {
        // 使用持久化 context 保留 session
        const context = await chromium.launchPersistentContext(userDataDir, {
            channel: 'msedge',
            headless: false,
        });
        // 回傳 context 的 browser（型別相容）
        return context.browser()!;
    }
    return chromium.launch({
        channel: 'msedge',
        headless: false,
    });
}

/**
 * 模式 A：連接已登入使用者的 CDP Debug 瀏覽器。
 * 預設連接 localhost:9222。
 */
export async function connectCDP(port = 9222): Promise<Browser> {
    return chromium.connectOverCDP(`http://localhost:${port}`);
}

/**
 * 從 Browser 中取得使用者內容頁面（過濾掉瀏覽器內部頁面）。
 */
export function getUserPages(browser: Browser): Page[] {
    return browser.contexts()
        .flatMap(ctx => ctx.pages())
        .filter(page => isUserContentPage(page.url()));
}

/**
 * 等待頁面導覽至符合 URL 模式的頁面（用於處理 SSO redirect）。
 *
 * @param page Playwright Page 物件
 * @param urlPattern URL glob 模式，例如 '**/eip100/eip100m_v1.jsp**'
 * @param timeoutMs 逾時毫秒數，預設 30000
 */
export async function waitForNavigation(
    page: Page,
    urlPattern: string,
    timeoutMs = 30000
): Promise<void> {
    await page.waitForURL(urlPattern, { timeout: timeoutMs });
}

/**
 * 取得雙層 iframe 的 FrameLocator（QIZ 系統常用模式）。
 *
 * @param page Playwright Page 物件
 * @param outerName 外層 iframe 的 name 屬性
 * @param innerName 內層 iframe 的 name 屬性
 */
export function getNestedIframe(
    page: Page,
    outerName: string,
    innerName: string
) {
    return page
        .frameLocator(`iframe[name="${outerName}"]`)
        .frameLocator(`iframe[name="${innerName}"]`);
}

/**
 * 安全地斷開 CDP 連接（不關閉使用者的瀏覽器視窗）。
 * 僅用於 connectOverCDP 模式。
 */
export async function disconnectCDP(browser: Browser): Promise<void> {
    try {
        await browser.close();
    } catch {
        // connectOverCDP 模式下，close() 只是斷開連接，不關閉瀏覽器
    }
}

export type { Browser, BrowserContext, Page };
