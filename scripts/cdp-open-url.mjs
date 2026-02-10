import { chromium } from 'playwright';

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
