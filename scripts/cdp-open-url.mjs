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
  console.error('Usage: node scripts/cdp-open-url.mjs <port> <startUrl> <targetUrl>');
  process.exit(1);
}

const endpoint = `http://localhost:${port}`;
const browser = await chromium.connectOverCDP(endpoint);
const context = browser.contexts()[0];
if (!context) {
  console.error('No browser context found. Please open a Chrome window first.');
  process.exit(1);
}
const page = await context.newPage();

await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });
await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 45000 });

process.exit(0);
