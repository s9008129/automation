/**
 * 🔧 環境變數載入 Helper
 *
 * 自製 .env 解析，不依賴 dotenv 套件，確保離線環境可用。
 * 讀取 process.cwd()/.env，並設定至 process.env（已有值的 key 不覆蓋）。
 *
 * 🔐 加密支援：
 * 若 .env 值為 ENC(...) 格式，會自動搜尋同目錄下的 .env.key 進行解密。
 * 向後相容：未加密的明文值仍可正常使用。
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { isEncrypted, loadKeyFile, tryDecrypt } from './crypto.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 載入 .env 檔案到 process.env。
 *
 * - 搜尋順序：先找腳本同目錄、再找 CWD、最後往上兩層尋找專案根目錄
 * - 已設定的 key 不覆蓋（與 dotenv 行為一致）
 * - 支援單引號 / 雙引號值
 * - 自動忽略空行與 # 開頭的註解行
 * - 🔐 自動偵測 ENC(...) 格式並透明解密（需 .env.key 存在）
 *
 * @param customEnvPath 可選：指定 .env 檔案的完整路徑
 * @returns 載入成功時回傳 .env 檔案路徑；找不到檔案時回傳 null
 */
export function loadDotEnv(customEnvPath?: string): string | null {
  const candidates = customEnvPath
    ? [customEnvPath]
    : [
        path.join(process.cwd(), '.env'),
        path.join(__dirname, '..', '..', '.env'),
        path.join(__dirname, '..', '..', '..', '.env'),
      ];

  for (const envPath of candidates) {
    if (!fs.existsSync(envPath)) continue;

    // 嘗試載入同目錄下的金鑰檔案（若存在）
    const envDir = path.dirname(envPath);
    let encKey: Buffer | null = null;
    try {
      encKey = loadKeyFile(envDir);
    } catch {
      // 金鑰檔案損壞時會拋出錯誤，這裡先靜默處理
      // 若後續遇到 ENC(...) 值，tryDecrypt 會拋出明確錯誤
    }

    const content = fs.readFileSync(envPath, 'utf8');

    content.split(/\r?\n/).forEach(line => {
      // 匹配 KEY=VALUE 格式（排除空行、# 開頭的註解行，以及 key 中含 = 或空白的行）
      const m = line.match(/^\s*([^#=\s][^=]*?)\s*=\s*(.*)\s*$/);
      if (!m) return;
      const key = m[1].trim();
      let val = m[2].trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }

      // 🔐 若值為加密格式，透明解密
      if (isEncrypted(val)) {
        val = tryDecrypt(val, encKey);
      }

      if (!process.env[key]) {
        process.env[key] = val;
      }
    });

    return envPath;
  }

  return null;
}

/**
 * 取得必要的環境變數，若未設定則拋出含中文說明的錯誤。
 *
 * @param key 環境變數名稱
 * @param description 用途說明（顯示於錯誤訊息中）
 */
export function requireEnv(key: string, description?: string): string {
  const val = process.env[key];
  if (!val) {
    const hint = description ? `（${description}）` : '';
    throw new Error(
      `❌ 找不到必要的環境變數 ${key}${hint}。\n請確認 .env 檔案已正確設定此欄位。`
    );
  }
  return val;
}

/**
 * 取得可選的環境變數，若未設定則回傳預設值。
 */
export function getEnv(key: string, defaultValue = ''): string {
  return process.env[key] ?? defaultValue;
}
