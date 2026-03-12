/**
 * 透過 Chrome 的 CDP 偵錯通道，在「既有的 Chrome 視窗」再開分頁並導向指定網址。
 * 這支工具適合搭配已啟動 debug port 的 Chrome，避免重開新瀏覽器造成登入狀態遺失。
 */
let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch (error) {
  const detail = error instanceof Error ? error.message : String(error);
  console.error('❌ 找不到 Playwright 套件，無法透過 CDP 連線開啟頁面。');
  console.error('請先執行 npm install 或 npm run setup（離線請先在有網路環境安裝 node_modules）。');
  console.error(`錯誤細節: ${detail}`);
  process.exit(1);
}

const [portArg, startUrl, targetUrl] = process.argv.slice(2);
const port = portArg || '9222';
if (!startUrl || !targetUrl) {
  // 參數不足時直接顯示用法，避免使用者不知道要填什麼
  console.error('Usage: node scripts/cdp-open-url.mjs <port> <startUrl> <targetUrl>');
  process.exit(1);
}

const endpoint = `http://localhost:${port}`;
const browser = await chromium.connectOverCDP(endpoint);
const context = browser.contexts()[0];
if (!context) {
  // 若沒有 context，代表目前沒有可用的 debug 視窗
  console.error('No browser context found. Please open a Chrome window first.');
  process.exit(1);
}
const page = await context.newPage();

// 先到起始頁，再去目標頁：可保留某些網站需要的前置導向流程
await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });

process.exit(0);
