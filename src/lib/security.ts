/**
 * 🔒 安全工具 Helper
 *
 * 提供 safeFileName、validateTaskScriptPath 等安全函數，
 * 確保路徑穿越與非法字元問題被正確處理。
 */

import * as path from 'path';

/**
 * 將任意字串轉換為安全的檔案名稱。
 * 移除或替換所有路徑分隔符、控制字元與 Windows / Unix 非法字元。
 *
 * @param name 原始名稱
 * @param maxLength 最大長度（預設 100）
 */
export function safeFileName(name: string, maxLength = 100): string {
  let safe = name
    // 路徑分隔符 → 空白
    .replace(/[/\\]/g, ' ')
    // Windows 非法字元 → 空白
    .replace(/[<>:"|?*]/g, ' ')
    // 控制字元（0x00–0x1F） → 空白
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f]/g, ' ')
    // 多餘空白壓縮成一個底線
    .replace(/\s+/g, '_')
    // 移除前後底線
    .replace(/^_+|_+$/g, '');

  if (safe.length === 0) {
    safe = 'unnamed';
  }

  if (safe.length > maxLength) {
    safe = safe.slice(0, maxLength);
  }

  return safe;
}

/** 允許執行任務腳本的副檔名白名單 */
const ALLOWED_SCRIPT_EXTENSIONS = new Set(['.ts', '.mts', '.cts']);

/**
 * 驗證任務腳本路徑：
 * 1. 必須為 .ts / .mts / .cts 副檔名
 * 2. 路徑正規化後必須仍在專案根目錄內（防止 ../../../ 穿越）
 *
 * @param scriptPath  使用者傳入的腳本路徑（相對或絕對）
 * @param projectRoot 專案根目錄（絕對路徑）
 * @returns 正規化後的絕對路徑
 * @throws 驗證失敗時拋出含中文說明的錯誤
 */
export function validateTaskScriptPath(scriptPath: string, projectRoot: string): string {
  const ext = path.extname(scriptPath).toLowerCase();

  if (!ALLOWED_SCRIPT_EXTENSIONS.has(ext)) {
    throw new Error(
      `❌ 不支援的腳本副檔名「${ext || '（無）'}」。\n` +
        `任務腳本必須是 TypeScript 檔案（.ts）。`
    );
  }

  // 正規化為絕對路徑
  const resolved = path.isAbsolute(scriptPath)
    ? path.normalize(scriptPath)
    : path.resolve(projectRoot, scriptPath);

  // 防止路徑穿越到專案外
  const normalizedRoot = path.normalize(projectRoot);
  const normalizedRootWithSep = normalizedRoot.endsWith(path.sep)
    ? normalizedRoot
    : normalizedRoot + path.sep;

  if (!resolved.startsWith(normalizedRootWithSep) && resolved !== normalizedRoot) {
    throw new Error(
      `❌ 腳本路徑超出專案目錄範圍，無法執行。\n` +
        `允許範圍：${projectRoot}\n` +
        `傳入路徑：${scriptPath}`
    );
  }

  return resolved;
}
