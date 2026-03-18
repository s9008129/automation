/**
 * 🔧 env.ts — .env 載入 Helper
 *
 * 讀取專案根目錄的 .env 檔，填充 process.env。
 * 不依賴任何第三方套件（不使用 dotenv）。
 *
 * 使用方式：
 *   import { loadDotEnv } from './lib/env.js';
 *   loadDotEnv();
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * 讀取並解析 .env 檔案，僅填充尚未設定的環境變數。
 * @param envPath .env 檔案的路徑，預設為專案根目錄的 .env
 */
export function loadDotEnv(envPath?: string): void {
    const resolvedPath = envPath ?? path.join(__dirname, '..', '..', '.env');
    if (!fs.existsSync(resolvedPath)) return;

    const content = fs.readFileSync(resolvedPath, 'utf8');
    content.split(/\r?\n/).forEach(line => {
        const m = line.match(/^\s*([^#=\s][^=]*?)\s*=\s*(.*?)\s*$/);
        if (!m) return;
        const key = m[1].trim();
        let val = m[2].trim();
        if ((val.startsWith('"') && val.endsWith('"')) ||
            (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
        }
        if (!process.env[key]) {
            process.env[key] = val;
        }
    });
}

/**
 * 取得必要的環境變數，若不存在則拋出錯誤。
 * @param key 環境變數名稱
 */
export function requireEnv(key: string): string {
    const val = process.env[key];
    if (!val) {
        throw new Error(`❌ 缺少必要的環境變數：${key}\n請複製 .env.example 為 .env 並填入正確設定。`);
    }
    return val;
}

/**
 * 取得環境變數，若不存在則回傳預設值。
 * @param key 環境變數名稱
 * @param defaultValue 預設值
 */
export function getEnv(key: string, defaultValue: string): string {
    return process.env[key] ?? defaultValue;
}
