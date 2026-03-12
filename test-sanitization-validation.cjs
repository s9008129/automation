/**
 * 這份測試腳本會檢查 sanitizeRecording 的核心承諾：
 * 1) 帳密字串要被替換成環境變數
 * 2) 註解內容不能被誤改
 */

const fs = require('fs');
const path = require('path');

// 測試案例：每筆都包含「原始輸入」與「預期輸出」
const testCases = [
  {
    name: 'Single param fill with password',
    input: `  await page.getByRole('textbox', { name: '密碼' }).fill('mySecretPass123');`,
    expected: `  await page.getByRole('textbox', { name: '密碼' }).fill(process.env.RECORDING_PASSWORD);`,
  },
  {
    name: 'Single param fill with username',
    input: `  await page.getByRole('textbox', { name: '帳號' }).fill('admin@example.com');`,
    expected: `  await page.getByRole('textbox', { name: '帳號' }).fill(process.env.NCERT_USERNAME);`,
  },
  {
    name: 'Two-param fill with selector',
    input: `  await page.fill('#password', 'secret123');`,
    expected: `  await page.fill('#password', process.env.RECORDING_PASSWORD);`,
  },
  {
    name: 'Locator with password selector',
    input: `  await page.locator('#password').fill('mypass');`,
    expected: `  await page.locator('#password').fill(process.env.RECORDING_PASSWORD);`,
  },
  {
    name: 'Type method with password',
    input: `  await page.getByRole('textbox', { name: 'password' }).type('secret');`,
    expected: `  await page.getByRole('textbox', { name: 'password' }).type(process.env.RECORDING_PASSWORD);`,
  },
  {
    name: 'Generic fill fallback',
    input: `  await page.fill('somevalue');`,
    expected: `  await page.fill(process.env.RECORDING_PASSWORD);`,
  },
  {
    name: 'Comment line should be preserved',
    input: `  // await page.fill('this should not change');`,
    expected: `  // await page.fill('this should not change');`,
  },
  {
    name: 'Block comment should be preserved',
    input: `  /* await page.fill('this should not change') */`,
    expected: `  /* await page.fill('this should not change') */`,
  },
  {
    name: 'Multi-line block comment',
    input: `  /*
   * await page.fill('secret')
   */`,
    expected: `  /*
   * await page.fill('secret')
   */`,
  },
  {
    name: 'Code with special characters in password',
    input: `  await page.getByRole('textbox', { name: '密碼' }).fill('p@ss"word!123');`,
    expected: `  await page.getByRole('textbox', { name: '密碼' }).fill(process.env.RECORDING_PASSWORD);`,
  },
];

// 清理函式（簡化版）：邏輯與 collect-materials.ts 保持一致，用來做行為驗證
function sanitizeRecording(content) {
  const lines = content.split(/\r?\n/);
  let inBlock = false;
  const outLines = [];

  for (let rawLine of lines) {
    let line = rawLine;

    // 在區塊註解範圍內完全不替換，避免改壞說明內容
    if (inBlock) {
      outLines.push(line);
      if (line.includes('*/')) inBlock = false;
      continue;
    }
    if (line.includes('/*')) {
      inBlock = true;
      outLines.push(line);
      continue;
    }

    // 單行註解也直接略過
    if (line.trim().startsWith('//')) {
      outLines.push(line);
      continue;
    }

    // 依序替換（從精準規則到保守 fallback）
    // 1) 兩參數形式：.fill(selector, 'secret') / .type(selector, 'secret')
    line = line.replace(/\.fill\(\s*([^,]+?)\s*,\s*(['"])((?:\\.|[^\\])*)\2\s*\)/g, `.fill($1, process.env.RECORDING_PASSWORD)`);
    line = line.replace(/\.type\(\s*([^,]+?)\s*,\s*(['"])((?:\\.|[^\\])*)\2\s*\)/g, `.type($1, process.env.RECORDING_PASSWORD)`);

    // 2) getByRole 鏈式單參數形式，依欄位名稱判斷是帳號還是密碼
    line = line.replace(/(\.getByRole\([^)]*name\s*:\s*['"](?:密碼|password|pwd)['"][^)]*\)\s*\.\s*(?:fill|type))\(\s*(['"])(?:\\.|[^\\])*?\2\s*\)/giu, `$1(process.env.RECORDING_PASSWORD)`);
    line = line.replace(/(\.getByRole\([^)]*name\s*:\s*['"](?:帳號|account|user|username)['"][^)]*\)\s*\.\s*(?:fill|type))\(\s*(['"])(?:\\.|[^\\])*?\2\s*\)/giu, `$1(process.env.NCERT_USERNAME)`);

    // 3) locator('#password') 這類 selector 風格
    line = line.replace(/(\.locator\([^)]*(?:password|pwd)[^)]*\)\s*\.\s*(?:fill|type))\(\s*(['"])(?:\\.|[^\\])*?\2\s*\)/giu, `$1(process.env.RECORDING_PASSWORD)`);

    // 4) 最後 fallback：單參數 fill/type
    line = line.replace(/\.(?:fill|type)\(\s*(['"])(?:\\.|[^\\])*?\1\s*\)/gu, `.fill(process.env.RECORDING_PASSWORD)`);

    outLines.push(line);
  }

  return outLines.join('\n');
}

// 執行測試並逐筆列出結果，讓失敗案例一眼可見
console.log('🧪 Testing sanitizeRecording function...\n');

let passed = 0;
let failed = 0;

testCases.forEach((testCase, index) => {
  const result = sanitizeRecording(testCase.input);
  const success = result === testCase.expected;
  
  if (success) {
    console.log(`✅ Test ${index + 1}: ${testCase.name}`);
    passed++;
  } else {
    console.log(`❌ Test ${index + 1}: ${testCase.name}`);
    console.log(`   Input:    ${testCase.input}`);
    console.log(`   Expected: ${testCase.expected}`);
    console.log(`   Got:      ${result}`);
    failed++;
  }
});

console.log(`\n${'='.repeat(60)}`);
console.log(`📊 Results: ${passed} passed, ${failed} failed out of ${testCases.length} tests`);
console.log('='.repeat(60));

// 再用「完整錄製檔範例」做整體驗證，模擬真實使用情境
console.log('\n🔍 Testing complete file transformation...\n');

const sampleRecording = `const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  await page.goto('https://example.com/login');
  
  // Login with credentials
  await page.getByRole('textbox', { name: '帳號' }).fill('user@example.com');
  await page.getByRole('textbox', { name: '密碼' }).fill('mySecretPassword123');
  
  /* This is a block comment
     await page.fill('should not be changed')
  */
  
  await page.getByRole('button', { name: '登入' }).click();
  
  // Don't sanitize this: await page.fill('comment secret')
  
  await context.close();
  await browser.close();
})();`;

const sanitized = sanitizeRecording(sampleRecording);

console.log('Original recording:');
console.log('-'.repeat(60));
console.log(sampleRecording);
console.log('\nSanitized recording:');
console.log('-'.repeat(60));
console.log(sanitized);

// 最後確認幾個關鍵條件都成立（環境變數存在、明碼不存在、註解保留）
const hasUsername = sanitized.includes('process.env.NCERT_USERNAME');
const hasPassword = sanitized.includes('process.env.RECORDING_PASSWORD');
const noLiteralUsername = !sanitized.includes("fill('user@example.com')");
const noLiteralPassword = !sanitized.includes("fill('mySecretPassword123')");
const commentsPreserved = sanitized.includes("await page.fill('should not be changed')") &&
                           sanitized.includes("// Don't sanitize this: await page.fill('comment secret')");

console.log('\n✔️  Verification:');
console.log(`   Environment variable for username: ${hasUsername ? '✅' : '❌'}`);
console.log(`   Environment variable for password: ${hasPassword ? '✅' : '❌'}`);
console.log(`   No literal username remaining: ${noLiteralUsername ? '✅' : '❌'}`);
console.log(`   No literal password remaining: ${noLiteralPassword ? '✅' : '❌'}`);
console.log(`   Comments preserved: ${commentsPreserved ? '✅' : '❌'}`);

const allVerified = hasUsername && hasPassword && noLiteralUsername && noLiteralPassword && commentsPreserved;

console.log(`\n${'='.repeat(60)}`);
console.log(`🎯 Final Verdict: ${allVerified && failed === 0 ? '✅ PASS' : '❌ FAIL'}`);
console.log('='.repeat(60));

process.exit(allVerified && failed === 0 ? 0 : 1);
