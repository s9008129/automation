/**
 * 🧪 加解密功能測試
 *
 * 純 Node.js（ES Module），不依賴外部測試框架。
 * 驗證 protect-env 的加解密邏輯正確性。
 *
 * 用法：node scripts/test-crypto.mjs
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

// ── 內嵌加解密邏輯（與 src/lib/crypto.ts 和 scripts/protect-env.mjs 一致）──
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const ENC_PREFIX = 'ENC(';
const ENC_SUFFIX = ')';
const KEY_FILE_NAME = '.env.key';

function isEncrypted(value) {
  return value.startsWith(ENC_PREFIX) && value.endsWith(ENC_SUFFIX);
}

function generateKey() {
  return crypto.randomBytes(KEY_LENGTH);
}

function encryptValue(plaintext, key) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  const combined = Buffer.concat([iv, authTag, encrypted]);
  return `${ENC_PREFIX}${combined.toString('base64')}${ENC_SUFFIX}`;
}

function decryptValue(encryptedStr, key) {
  const base64Data = encryptedStr.slice(ENC_PREFIX.length, -ENC_SUFFIX.length);
  const combined = Buffer.from(base64Data, 'base64');
  const iv = combined.subarray(0, IV_LENGTH);
  const authTag = combined.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = combined.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

// ── 測試框架 ──────────────────────────────────────────────
let passCount = 0;
let failCount = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passCount++;
  } else {
    console.log(`  ❌ FAIL: ${testName}`);
    failCount++;
  }
}

function assertEqual(actual, expected, testName) {
  if (actual === expected) {
    console.log(`  ✅ PASS: ${testName}`);
    passCount++;
  } else {
    console.log(`  ❌ FAIL: ${testName}`);
    console.log(`     期望：${JSON.stringify(expected)}`);
    console.log(`     實際：${JSON.stringify(actual)}`);
    failCount++;
  }
}

function assertThrows(fn, testName) {
  try {
    fn();
    console.log(`  ❌ FAIL: ${testName} (未拋出錯誤)`);
    failCount++;
  } catch {
    console.log(`  ✅ PASS: ${testName}`);
    passCount++;
  }
}

// ── 測試案例 ──────────────────────────────────────────────
console.log('');
console.log('╔════════════════════════════════════════════════════╗');
console.log('║   🧪 加解密功能測試                                ║');
console.log('╚════════════════════════════════════════════════════╝');
console.log('');

// TEST 1: 基本加解密往返
console.log('━━ TEST 1: 基本加解密往返 ━━━━━━━━━━━━━━━━━━━━━━━━━━');
{
  const key = generateKey();
  const testValues = [
    'simple_password',
    '中文密碼測試',
    'p@$$w0rd!#%^&*()',
    '',
    'a',
    'a'.repeat(1000),
    '  spaces  ',
    'line1\nline2',
    'tab\there',
    '🔐🔑🛡️',
  ];

  for (const original of testValues) {
    const encrypted = encryptValue(original, key);
    const decrypted = decryptValue(encrypted, key);
    assertEqual(decrypted, original, `往返：${JSON.stringify(original).slice(0, 40)}`);
  }
}

// TEST 2: isEncrypted 偵測
console.log('');
console.log('━━ TEST 2: isEncrypted 格式偵測 ━━━━━━━━━━━━━━━━━━━━');
{
  const key = generateKey();
  const encrypted = encryptValue('test', key);
  assert(isEncrypted(encrypted), 'isEncrypted 偵測加密值');
  assert(!isEncrypted('plain_text'), 'isEncrypted 排除明文');
  assert(!isEncrypted('ENC('), 'isEncrypted 排除不完整前綴');
  assert(!isEncrypted(')'), 'isEncrypted 排除不完整後綴');
  assert(!isEncrypted(''), 'isEncrypted 排除空字串');
  assert(isEncrypted('ENC()'), 'ENC() 空內容仍符合格式標記（解密時才會因資料不足而失敗）');
  assertThrows(() => decryptValue('ENC()', generateKey()), 'ENC() 空內容解密應拋出資料不足錯誤');
}

// TEST 3: 錯誤金鑰無法解密
console.log('');
console.log('━━ TEST 3: 錯誤金鑰無法解密 ━━━━━━━━━━━━━━━━━━━━━━━');
{
  const key1 = generateKey();
  const key2 = generateKey();
  const encrypted = encryptValue('secret', key1);
  assertThrows(() => decryptValue(encrypted, key2), '用錯誤金鑰解密應拋出錯誤');
}

// TEST 4: 每次加密產生不同密文（隨機 IV）
console.log('');
console.log('━━ TEST 4: 隨機 IV 確保密文不同 ━━━━━━━━━━━━━━━━━━━━');
{
  const key = generateKey();
  const enc1 = encryptValue('same_value', key);
  const enc2 = encryptValue('same_value', key);
  assert(enc1 !== enc2, '相同明文產生不同密文');
  assertEqual(decryptValue(enc1, key), 'same_value', '密文 1 可正確解密');
  assertEqual(decryptValue(enc2, key), 'same_value', '密文 2 可正確解密');
}

// TEST 5: 金鑰檔案讀寫
console.log('');
console.log('━━ TEST 5: 金鑰檔案讀寫 ━━━━━━━━━━━━━━━━━━━━━━━━━━━');
{
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'crypto-test-'));
  try {
    // 寫入金鑰
    const key = generateKey();
    const keyPath = path.join(tmpDir, KEY_FILE_NAME);
    fs.writeFileSync(keyPath, key.toString('hex') + '\n');

    // 讀回金鑰
    const keyHex = fs.readFileSync(keyPath, 'utf8').trim();
    const loadedKey = Buffer.from(keyHex, 'hex');
    assert(key.equals(loadedKey), '金鑰檔案讀寫一致');

    // 用讀回的金鑰解密
    const encrypted = encryptValue('file_key_test', key);
    const decrypted = decryptValue(encrypted, loadedKey);
    assertEqual(decrypted, 'file_key_test', '檔案金鑰可正確解密');
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// TEST 6: .env 檔案往返（加密 → 寫入 → 讀取 → 解密）
console.log('');
console.log('━━ TEST 6: .env 檔案完整往返 ━━━━━━━━━━━━━━━━━━━━━━');
{
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'env-test-'));
  const parseEnvValue = (rawValue) => {
    const trimmed = rawValue.trim();
    if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
      return trimmed.slice(1, -1);
    }
    return trimmed;
  };
  try {
    const envPath = path.join(tmpDir, '.env');
    const envContent = [
      '# 註解行',
      'CERT_PASSWORD=my_secret_password',
      'API_KEY=abc123xyz',
      'QUOTED_SPACED="  padded secret  "',
      '',
      '# 另一段註解',
      'EMPTY_VAR=',
    ].join('\n');
    fs.writeFileSync(envPath, envContent);

    const key = generateKey();

    // 解析 → 加密 → 寫回
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    const result = [];
    for (const line of lines) {
      const m = line.match(/^\s*([^#=\s][^=]*?)\s*=\s*(.*)\s*$/);
      if (!m) {
        result.push(line);
        continue;
      }
      const k = m[1].trim();
      let v = parseEnvValue(m[2]);
      if (v.length > 0 && !isEncrypted(v)) {
        v = encryptValue(v, key);
      }
      result.push(`${k}=${v}`);
    }
    fs.writeFileSync(envPath, result.join('\n'));

    // 讀回 → 解密 → 驗證
    const encLines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of encLines) {
      const m = line.match(/^\s*([^#=\s][^=]*?)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const k = m[1].trim();
      let v = parseEnvValue(m[2]);
      if (isEncrypted(v)) {
        v = decryptValue(v, key);
      }
      if (k === 'CERT_PASSWORD') assertEqual(v, 'my_secret_password', '.env CERT_PASSWORD 往返');
      if (k === 'API_KEY') assertEqual(v, 'abc123xyz', '.env API_KEY 往返');
      if (k === 'QUOTED_SPACED') assertEqual(v, '  padded secret  ', '.env QUOTED_SPACED 保留引號內前後空白語意');
      if (k === 'EMPTY_VAR') assertEqual(v, '', '.env EMPTY_VAR 保持空白');
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// TEST 7: 篡改密文應失敗
console.log('');
console.log('━━ TEST 7: 篡改偵測（GCM 認證標籤） ━━━━━━━━━━━━━━━');
{
  const key = generateKey();
  const encrypted = encryptValue('tamper_test', key);
  // 取出 base64，篡改一個字元後重新包裝
  const base64 = encrypted.slice(ENC_PREFIX.length, -ENC_SUFFIX.length);
  const buf = Buffer.from(base64, 'base64');
  if (buf.length > 0) {
    buf[buf.length - 1] ^= 0xff; // 翻轉最後一個 byte
  }
  const tampered = `${ENC_PREFIX}${buf.toString('base64')}${ENC_SUFFIX}`;
  assertThrows(() => decryptValue(tampered, key), '篡改密文應拋出認證錯誤');
}

// TEST 8: protect-env.mjs CLI 整合測試
console.log('');
console.log('━━ TEST 8: protect-env.mjs CLI 整合測試 ━━━━━━━━━━━━');
{
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-test-'));
  try {
    // 建立測試 .env
    const envContent = '# test\nTEST_SECRET=hello_world\n';
    fs.writeFileSync(path.join(tmpDir, '.env'), envContent);

    // 建立假的 scripts 目錄結構（CLI 工具用 __dirname 推算 projectRoot）
    const fakeScriptsDir = path.join(tmpDir, 'scripts');
    fs.mkdirSync(fakeScriptsDir);

    // 複製 protect-env.mjs 到假的 scripts 目錄
    const cliSource = path.join(projectRoot, 'scripts', 'protect-env.mjs');
    fs.copyFileSync(cliSource, path.join(fakeScriptsDir, 'protect-env.mjs'));

    // 執行加密
    const encResult = execSync(
      `node ${path.join(fakeScriptsDir, 'protect-env.mjs')}`,
      { cwd: tmpDir, encoding: 'utf8' }
    );
    assert(encResult.includes('加密完成'), 'CLI 加密輸出包含「加密完成」');

    // 驗證 .env 已加密
    const encEnv = fs.readFileSync(path.join(tmpDir, '.env'), 'utf8');
    assert(encEnv.includes('ENC('), '.env 包含 ENC(...)');
    assert(!encEnv.includes('hello_world'), '.env 不再包含明文');

    // 驗證 .env.key 已建立
    assert(fs.existsSync(path.join(tmpDir, KEY_FILE_NAME)), '.env.key 已建立');

    // 執行狀態檢查
    const statusResult = execSync(
      `node ${path.join(fakeScriptsDir, 'protect-env.mjs')} --status`,
      { cwd: tmpDir, encoding: 'utf8' }
    );
    assert(statusResult.includes('全部加密'), 'CLI --status 顯示全部加密');

    // 執行解密
    const decResult = execSync(
      `node ${path.join(fakeScriptsDir, 'protect-env.mjs')} --decrypt`,
      { cwd: tmpDir, encoding: 'utf8' }
    );
    assert(decResult.includes('解密完成'), 'CLI 解密輸出包含「解密完成」');

    // 驗證 .env 已還原明文
    const decEnv = fs.readFileSync(path.join(tmpDir, '.env'), 'utf8');
    assert(decEnv.includes('hello_world'), '.env 已還原明文');
    assert(!decEnv.includes('ENC('), '.env 不再包含 ENC(...)');

    // 重新加密後測試換鑰
    execSync(
      `node ${path.join(fakeScriptsDir, 'protect-env.mjs')}`,
      { cwd: tmpDir, encoding: 'utf8' }
    );
    const oldKeyHex = fs.readFileSync(path.join(tmpDir, KEY_FILE_NAME), 'utf8').trim();

    const rotateResult = execSync(
      `node ${path.join(fakeScriptsDir, 'protect-env.mjs')} --rotate-key`,
      { cwd: tmpDir, encoding: 'utf8' }
    );
    assert(rotateResult.includes('金鑰輪換完成'), 'CLI 換鑰輸出包含「金鑰輪換完成」');

    const newKeyHex = fs.readFileSync(path.join(tmpDir, KEY_FILE_NAME), 'utf8').trim();
    assert(oldKeyHex !== newKeyHex, '換鑰後金鑰不同');

    // 用新金鑰解密驗證
    execSync(
      `node ${path.join(fakeScriptsDir, 'protect-env.mjs')} --decrypt`,
      { cwd: tmpDir, encoding: 'utf8' }
    );
    const finalEnv = fs.readFileSync(path.join(tmpDir, '.env'), 'utf8');
    assert(finalEnv.includes('hello_world'), '換鑰後解密仍得到原始值');

  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}

// ── 最終總結 ──────────────────────────────────────────────
console.log('');
console.log('╔════════════════════════════════════════════════════╗');
console.log('║                   測試結果                          ║');
console.log('╚════════════════════════════════════════════════════╝');
console.log('');
console.log(`  ✅ 通過：${passCount}`);
console.log(`  ❌ 失敗：${failCount}`);
console.log('');

if (failCount > 0) {
  console.log('❌ 有測試失敗，請檢查上方錯誤訊息。');
  process.exit(1);
} else {
  console.log('🎉 所有測試通過！加解密功能正常。');
  process.exit(0);
}
