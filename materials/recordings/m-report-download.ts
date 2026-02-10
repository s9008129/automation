// ⚠️ 此錄製檔已被敏感資訊清理，密碼欄位已替換為 process.env.RECORDING_PASSWORD
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({
    headless: false
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto('https://www.ncert.nat.gov.tw/index.jsp');
  await page.getByRole('textbox', { name: '帳號' }).click();
  await page.getByRole('textbox', { name: '帳號' }).click();
  await page.getByRole('textbox', { name: '帳號' }).fill(process.env.NCERT_USERNAME);
  await page.getByRole('textbox', { name: '密碼' }).click();
  await page.getByRole('textbox', { name: '密碼' }).fill(process.env.RECORDING_PASSWORD);
  await page.getByRole('button', { name: '登入' }).click();
  await page.getByRole('link', { name: '資安聯防監控月報' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByText('資安聯防監控月報202512_v1.pdf').click();
  const download = await downloadPromise;
  await page.getByRole('link', { name: '登出' }).click();

  // ---------------------
  await context.close();
  await browser.close();
})();