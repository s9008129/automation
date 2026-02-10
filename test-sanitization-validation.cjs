/**
 * Comprehensive test script to validate sanitizeRecording function
 * Tests that literal credentials are replaced with environment variables
 * and that comments are preserved unchanged.
 */

const fs = require('fs');
const path = require('path');

// Test cases with expected transformations
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

// Sanitization function (simplified version matching collect-materials.ts logic)
function sanitizeRecording(content) {
  const lines = content.split(/\r?\n/);
  let inBlock = false;
  const outLines = [];

  for (let rawLine of lines) {
    let line = rawLine;

    // Handle block comment range
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

    // Skip single-line comments
    if (line.trim().startsWith('//')) {
      outLines.push(line);
      continue;
    }

    // Apply replacements in order (from specific to general)
    // 1) Two-param form: .fill(selector, 'secret') or .type(selector, 'secret')
    line = line.replace(/\.fill\(\s*([^,]+?)\s*,\s*(['"])((?:\\.|[^\\])*)\2\s*\)/g, `.fill($1, process.env.RECORDING_PASSWORD)`);
    line = line.replace(/\.type\(\s*([^,]+?)\s*,\s*(['"])((?:\\.|[^\\])*)\2\s*\)/g, `.type($1, process.env.RECORDING_PASSWORD)`);

    // 2) Chained getByRole single-param form, match by name for password/username
    line = line.replace(/(\.getByRole\([^)]*name\s*:\s*['"](?:密碼|password|pwd)['"][^)]*\)\s*\.\s*(?:fill|type))\(\s*(['"])(?:\\.|[^\\])*?\2\s*\)/giu, `$1(process.env.RECORDING_PASSWORD)`);
    line = line.replace(/(\.getByRole\([^)]*name\s*:\s*['"](?:帳號|account|user|username)['"][^)]*\)\s*\.\s*(?:fill|type))\(\s*(['"])(?:\\.|[^\\])*?\2\s*\)/giu, `$1(process.env.NCERT_USERNAME)`);

    // 3) locator('#password') type selector
    line = line.replace(/(\.locator\([^)]*(?:password|pwd)[^)]*\)\s*\.\s*(?:fill|type))\(\s*(['"])(?:\\.|[^\\])*?\2\s*\)/giu, `$1(process.env.RECORDING_PASSWORD)`);

    // 4) Fallback: single-param .fill('...') /.type('...')
    line = line.replace(/\.(?:fill|type)\(\s*(['"])(?:\\.|[^\\])*?\1\s*\)/gu, `.fill(process.env.RECORDING_PASSWORD)`);

    outLines.push(line);
  }

  return outLines.join('\n');
}

// Run tests
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

// Test with a complete example file
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

// Verify key transformations
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
