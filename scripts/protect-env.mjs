/**
 * 🔐 protect-env — .env 加解密 CLI 工具
 *
 * 純 Node.js（ES Module），不依賴 tsx 或任何外部套件。
 * 一般使用者透過 protect-env.ps1 呼叫，技術人員可直接用 node 執行。
 *
 * 用法：
 *   node scripts/protect-env.mjs                 # 加密 .env 中的所有值
 *   node scripts/protect-env.mjs --decrypt        # 解密 .env 中的所有值（還原明文）
 *   node scripts/protect-env.mjs --status         # 顯示 .env 加密狀態
 *   node scripts/protect-env.mjs --rotate-key     # 換鑰（產生新金鑰，重新加密）
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ── 常數 ───────────────────────────────────────────────────
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32;
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const ENC_PREFIX = 'ENC(';
const ENC_SUFFIX = ')';
const KEY_FILE_NAME = '.env.key';
const ENV_FILE_NAME = '.env';

// ── 平台感知的指令提示 ─────────────────────────────────────
function getProtectCmd() {
  return process.platform === 'win32'
    ? '.\\protect-env.ps1'
    : 'node scripts/protect-env.mjs';
}
function getTaipeiTime() {
  return new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
}

// ── 加解密函數（與 src/lib/crypto.ts 邏輯一致） ─────────────
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
  const minLength = IV_LENGTH + AUTH_TAG_LENGTH;
  if (combined.length < minLength) {
    throw new Error(`加密資料長度不足（最少 ${minLength} bytes）`);
  }
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

// ── 金鑰檔案操作 ──────────────────────────────────────────
function loadKeyFile(dir) {
  const keyPath = path.join(dir, KEY_FILE_NAME);
  if (!fs.existsSync(keyPath)) return null;
  const keyHex = fs.readFileSync(keyPath, 'utf8').trim();
  if (!/^[0-9a-fA-F]+$/.test(keyHex)) {
    throw new Error(
      `金鑰檔案含有非法字元：${keyPath}\n` +
      `金鑰必須為純 hex 字元（0-9, a-f）。`
    );
  }
  const keyBuf = Buffer.from(keyHex, 'hex');
  if (keyBuf.length !== KEY_LENGTH) {
    throw new Error(
      `金鑰檔案格式不正確：${keyPath}\n` +
      `預期 ${KEY_LENGTH} bytes（${KEY_LENGTH * 2} 個 hex 字元），實際 ${keyBuf.length} bytes。`
    );
  }
  return keyBuf;
}

function getOrCreateKeyFile(dir) {
  const existing = loadKeyFile(dir);
  if (existing) return existing;
  const key = generateKey();
  const keyPath = path.join(dir, KEY_FILE_NAME);
  fs.writeFileSync(keyPath, key.toString('hex') + '\n', { mode: 0o600 });
  return key;
}

// ── .env 解析與寫回 ─────────────────────────────────────────
function parseEnvFile(envPath) {
  const content = fs.readFileSync(envPath, 'utf8');
  const lines = content.split(/\r?\n/);
  const entries = [];

  for (const line of lines) {
    const m = line.match(/^\s*([^#=\s][^=]*?)\s*=\s*(.*)\s*$/);
    if (!m) {
      entries.push({ type: 'raw', raw: line });
      continue;
    }
    const key = m[1].trim();
    let val = m[2].trim();
    let quoted = '';
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      quoted = val[0];
      val = val.slice(1, -1);
    }
    entries.push({ type: 'kv', key, val, quoted });
  }
  return entries;
}

function writeEnvFile(envPath, entries) {
  const lines = entries.map(entry => {
    if (entry.type === 'raw') return entry.raw;
    const { key, val, quoted } = entry;
    if (quoted) return `${key}=${quoted}${val}${quoted}`;
    return `${key}=${val}`;
  });
  fs.writeFileSync(envPath, lines.join('\n'), 'utf8');
}

// ── 指令實作 ────────────────────────────────────────────────
function doEncrypt(projectRoot) {
  const envPath = path.join(projectRoot, ENV_FILE_NAME);
  if (!fs.existsSync(envPath)) {
    console.error(`❌ 找不到 ${ENV_FILE_NAME}，請先建立此檔案。`);
    console.error(`   提示：複製 .env.example 為 .env，再填入你的實際值。`);
    process.exit(1);
  }

  const key = getOrCreateKeyFile(projectRoot);
  const entries = parseEnvFile(envPath);
  let encCount = 0;
  let skipCount = 0;

  for (const entry of entries) {
    if (entry.type !== 'kv') continue;
    if (isEncrypted(entry.val)) {
      skipCount++;
      continue;
    }
    // 跳過空值
    if (entry.val.length === 0) continue;
    entry.val = encryptValue(entry.val, key);
    // 加密後的 ENC(...) 值不需要引號包裝
    entry.quoted = '';
    encCount++;
  }

  writeEnvFile(envPath, entries);

  console.log('');
  console.log('╔════════════════════════════════════════════════════╗');
  console.log('║   🔐 .env 加密完成                                ║');
  console.log('╚════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`  ✅ 加密了 ${encCount} 個值`);
  if (skipCount > 0) {
    console.log(`  ⏭️  跳過 ${skipCount} 個已加密的值`);
  }
  console.log(`  🔑 金鑰檔案：${path.join(projectRoot, KEY_FILE_NAME)}`);
  console.log(`  📄 加密檔案：${envPath}`);
  console.log('');
  console.log('  ⚠️  注意事項：');
  console.log(`  1. ${KEY_FILE_NAME} 是解密的唯一金鑰，請妥善保管`);
  console.log(`  2. ${KEY_FILE_NAME} 不可提交到 Git，也不應打包進離線工具包`);
  console.log('  3. 若遺失金鑰，需要重新填寫 .env 明文後再次加密');
  console.log('');
}

function doDecrypt(projectRoot) {
  const envPath = path.join(projectRoot, ENV_FILE_NAME);
  if (!fs.existsSync(envPath)) {
    console.error(`❌ 找不到 ${ENV_FILE_NAME}`);
    process.exit(1);
  }

  const key = loadKeyFile(projectRoot);
  if (!key) {
    console.error(`❌ 找不到金鑰檔案 ${KEY_FILE_NAME}，無法解密。`);
    process.exit(1);
  }

  const entries = parseEnvFile(envPath);
  let decCount = 0;

  for (const entry of entries) {
    if (entry.type !== 'kv') continue;
    if (!isEncrypted(entry.val)) continue;
    try {
      const decrypted = decryptValue(entry.val, key);
      entry.val = decrypted;
      // 若解密後的值含前後空白，自動加上雙引號保護語意
      if (decrypted.length > 0 && (decrypted.startsWith(' ') || decrypted.endsWith(' '))) {
        entry.quoted = '"';
      } else {
        entry.quoted = '';
      }
      decCount++;
    } catch (err) {
      console.error(`❌ 解密 ${entry.key} 失敗：${err.message}`);
      process.exit(1);
    }
  }

  writeEnvFile(envPath, entries);

  console.log('');
  console.log('╔════════════════════════════════════════════════════╗');
  console.log('║   🔓 .env 解密完成                                ║');
  console.log('╚════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`  ✅ 解密了 ${decCount} 個值`);
  console.log(`  📄 檔案：${envPath}`);
  console.log('');
  const reEncryptHint = getProtectCmd();
  console.log('  ⚠️  .env 現在包含明文密碼，建議編輯完成後重新加密：');
  console.log(`      ${reEncryptHint}`);
  console.log('');
}

function doStatus(projectRoot) {
  const envPath = path.join(projectRoot, ENV_FILE_NAME);
  const keyPath = path.join(projectRoot, KEY_FILE_NAME);

  console.log('');
  console.log('╔════════════════════════════════════════════════════╗');
  console.log('║   🔍 .env 安全狀態檢查                            ║');
  console.log('╚════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`  檢查時間：${getTaipeiTime()}`);
  console.log('');

  // 檢查 .env 是否存在
  if (!fs.existsSync(envPath)) {
    console.log('  📄 .env 檔案：❌ 不存在');
    console.log('');
    console.log('  💡 提示：複製 .env.example 為 .env，再填入你的實際值。');
    console.log('');
    return;
  }
  console.log('  📄 .env 檔案：✅ 存在');

  // 檢查 .env.key 是否存在
  if (fs.existsSync(keyPath)) {
    console.log(`  🔑 ${KEY_FILE_NAME} 金鑰：✅ 存在`);
  } else {
    console.log(`  🔑 ${KEY_FILE_NAME} 金鑰：⚠️  不存在（尚未加密）`);
  }

  // 分析 .env 內容
  const entries = parseEnvFile(envPath);
  let encCount = 0;
  let plainCount = 0;
  let emptyCount = 0;

  for (const entry of entries) {
    if (entry.type !== 'kv') continue;
    if (entry.val.length === 0) {
      emptyCount++;
    } else if (isEncrypted(entry.val)) {
      encCount++;
    } else {
      plainCount++;
    }
  }

  console.log('');
  console.log('  📊 值統計：');
  console.log(`     加密值：${encCount} 個`);
  console.log(`     明文值：${plainCount} 個`);
  console.log(`     空白值：${emptyCount} 個`);
  console.log('');

  if (plainCount > 0 && encCount === 0) {
    console.log('  🔴 安全等級：未加密');
    console.log(`     建議執行 ${getProtectCmd()} 加密敏感值。`);
  } else if (plainCount > 0 && encCount > 0) {
    console.log('  🟡 安全等級：部分加密');
    console.log(`     建議重新執行 ${getProtectCmd()} 加密剩餘明文值。`);
  } else if (encCount > 0 && plainCount === 0) {
    console.log('  🟢 安全等級：全部加密');
  } else {
    console.log('  ⚪ 安全等級：無敏感值');
  }
  console.log('');
}

function doRotateKey(projectRoot) {
  const envPath = path.join(projectRoot, ENV_FILE_NAME);
  if (!fs.existsSync(envPath)) {
    console.error(`❌ 找不到 ${ENV_FILE_NAME}`);
    process.exit(1);
  }

  const oldKey = loadKeyFile(projectRoot);
  if (!oldKey) {
    console.error(`❌ 找不到舊金鑰 ${KEY_FILE_NAME}，無法換鑰。`);
    console.error(`   若要首次加密，請直接執行 ${getProtectCmd()}（不加 --rotate-key）。`);
    process.exit(1);
  }

  // 先用舊金鑰解密
  const entries = parseEnvFile(envPath);
  for (const entry of entries) {
    if (entry.type !== 'kv') continue;
    if (!isEncrypted(entry.val)) continue;
    try {
      const decrypted = decryptValue(entry.val, oldKey);
      entry.val = decrypted;
      // 若解密後的值含前後空白，自動加上雙引號保護語意
      if (decrypted.length > 0 && (decrypted.startsWith(' ') || decrypted.endsWith(' '))) {
        entry.quoted = '"';
      } else {
        entry.quoted = '';
      }
    } catch (err) {
      console.error(`❌ 用舊金鑰解密 ${entry.key} 失敗：${err.message}`);
      process.exit(1);
    }
  }

  // 產生新金鑰
  const newKey = generateKey();
  const keyPath = path.join(projectRoot, KEY_FILE_NAME);
  fs.writeFileSync(keyPath, newKey.toString('hex') + '\n', { mode: 0o600 });

  // 用新金鑰重新加密
  let encCount = 0;
  for (const entry of entries) {
    if (entry.type !== 'kv') continue;
    if (entry.val.length === 0) continue;
    entry.val = encryptValue(entry.val, newKey);
    entry.quoted = '';
    encCount++;
  }

  writeEnvFile(envPath, entries);

  console.log('');
  console.log('╔════════════════════════════════════════════════════╗');
  console.log('║   🔄 .env 金鑰輪換完成                            ║');
  console.log('╚════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`  ✅ 已用新金鑰重新加密 ${encCount} 個值`);
  console.log(`  🔑 新金鑰：${keyPath}`);
  console.log('');
}

// ── 主程式 ─────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
🔐 protect-env — .env 加解密工具

用法：
  node scripts/protect-env.mjs                 加密 .env 中的所有明文值
  node scripts/protect-env.mjs --decrypt        解密 .env（還原為明文）
  node scripts/protect-env.mjs --status         顯示 .env 加密狀態
  node scripts/protect-env.mjs --rotate-key     換鑰（產生新金鑰並重新加密）
  node scripts/protect-env.mjs --help           顯示此說明

說明：
  使用 AES-256-GCM 加密，金鑰存於 ${KEY_FILE_NAME}（自動產生）。
  加密後的值以 ENC(...) 格式儲存，RPA 執行時自動透明解密。
  `);
  process.exit(0);
}

if (args.includes('--decrypt')) {
  doDecrypt(projectRoot);
} else if (args.includes('--status')) {
  doStatus(projectRoot);
} else if (args.includes('--rotate-key')) {
  doRotateKey(projectRoot);
} else {
  doEncrypt(projectRoot);
}
