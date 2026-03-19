/**
 * 📝 日誌 Helper（台北時區、正體中文、結構化）
 *
 * 提供統一的 console 輸出與日誌檔寫入能力。
 * 所有時間戳記皆以 Asia/Taipei（UTC+8）為準。
 */

import * as fs from 'fs';
import * as path from 'path';

// ============================================================
// 台北時間工具
// ============================================================

/** 取得台北當下時間（本地化顯示用） */
export function getTaipeiTime(): string {
  return new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
}

/** 取得台北時間各部分 */
function getTaipeiDateParts(): {
  year: string;
  month: string;
  day: string;
  hours: string;
  minutes: string;
  seconds: string;
} {
  const taipeiStr = new Date().toLocaleString('en-US', { timeZone: 'Asia/Taipei' });
  const taipeiTime = new Date(taipeiStr);
  return {
    year: String(taipeiTime.getFullYear()),
    month: String(taipeiTime.getMonth() + 1).padStart(2, '0'),
    day: String(taipeiTime.getDate()).padStart(2, '0'),
    hours: String(taipeiTime.getHours()).padStart(2, '0'),
    minutes: String(taipeiTime.getMinutes()).padStart(2, '0'),
    seconds: String(taipeiTime.getSeconds()).padStart(2, '0'),
  };
}

/** 回傳 ISO 8601 格式台北時間，帶 +08:00 時區 */
export function getTaipeiISO(): string {
  const { year, month, day, hours, minutes, seconds } = getTaipeiDateParts();
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+08:00`;
}

/** 回傳適合用於檔名的台北時間戳記（YYYYMMDDhhmmss） */
export function getTaipeiTaskTimestamp(): string {
  const { year, month, day, hours, minutes, seconds } = getTaipeiDateParts();
  return `${year}${month}${day}${hours}${minutes}${seconds}`;
}

// ============================================================
// 日誌狀態
// ============================================================

let _logFilePath: string | null = null;
const _logBuffer: string[] = [];

/** 取得目前的日誌檔路徑（未初始化時回傳 null） */
export function getLogFilePath(): string | null {
  return _logFilePath;
}

/** 初始化日誌檔。應在任務開始時呼叫。 */
export function initLogger(logDir: string, runId: string): void {
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  _logFilePath = path.join(logDir, `${runId}.log`);
  fs.writeFileSync(_logFilePath, '', 'utf-8');
  // 將緩衝中等待的日誌寫入檔案
  if (_logBuffer.length > 0) {
    fs.appendFileSync(_logFilePath, `${_logBuffer.join('\n')}\n`, 'utf-8');
    _logBuffer.length = 0;
  }
}

function writeLogLine(line: string): void {
  if (_logFilePath) {
    fs.appendFileSync(_logFilePath, `${line}\n`, 'utf-8');
  } else {
    _logBuffer.push(line);
  }
}

// ============================================================
// 日誌輸出函數
// ============================================================

/** 一般日誌，輸出到 console 並寫入日誌檔 */
export function log(
  emoji: string,
  message: string,
  level: 'INFO' | 'WARN' | 'ERROR' = 'INFO'
): void {
  const time = getTaipeiTime();
  console.log(`[${time}] ${emoji} ${message}`);
  writeLogLine(`[${getTaipeiISO()}][${level}] ${emoji} ${message}`);
}

/** 錯誤日誌，自動格式化 Error 物件，同時輸出到 console 與日誌檔 */
export function logError(message: string, error?: unknown): void {
  log('❌', message, 'ERROR');
  if (error !== undefined) {
    const detail = formatErrorDetail(error);
    // 寫入日誌檔
    writeLogLine(`[${getTaipeiISO()}][ERROR_DETAIL]\n${detail}`);
    // 同時輸出到 console，讓 PowerShell / 終端也能看到完整錯誤
    console.error(detail);
  }
}

/** 寫入結構化上下文（用於除錯記錄） */
export function logContext(label: string, data: unknown): void {
  writeLogLine(`[${getTaipeiISO()}][CONTEXT] ${label}`);
  try {
    writeLogLine(JSON.stringify(data, null, 2));
  } catch {
    writeLogLine(String(data));
  }
}

/** 在 console 顯示區塊標題 */
export function printHeader(title: string): void {
  console.log('');
  console.log('='.repeat(60));
  console.log(`  ${title}`);
  console.log('='.repeat(60));
  console.log('');
  writeLogLine('');
  writeLogLine('='.repeat(60));
  writeLogLine(`  ${title}`);
  writeLogLine('='.repeat(60));
  writeLogLine('');
}

/** 在 console 顯示小節標題 */
export function printSection(title: string): void {
  console.log(`\n  -- ${title} --\n`);
  writeLogLine(`\n  -- ${title} --\n`);
}

// ============================================================
// 錯誤格式化
// ============================================================

/** 統一格式化 Error 物件或任意例外（保留向後相容） */
export function formatError(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack };
  }
  return { message: String(error) };
}

/**
 * 完整格式化錯誤，包含 name / message / stack / cause 鏈。
 * 輸出為多行字串，適合直接寫入日誌檔或 console。
 */
export function formatErrorDetail(error: unknown, depth = 0): string {
  const indent = '  '.repeat(depth);
  const prefix = depth === 0 ? '' : `${indent}[Caused by] `;

  if (!(error instanceof Error)) {
    return `${prefix}${String(error)}`;
  }

  const lines: string[] = [];
  const name = error.name || 'Error';
  lines.push(`${prefix}${name}: ${error.message}`);
  if (error.stack) {
    const stackOnly = error.stack
      .split('\n')
      .filter(line => line.trimStart().startsWith('at '))
      .map(line => `${indent}  ${line.trim()}`)
      .join('\n');
    if (stackOnly) {
      lines.push(stackOnly);
    }
  }
  if ((error as NodeJS.ErrnoException).code) {
    lines.push(`${indent}  code: ${(error as NodeJS.ErrnoException).code}`);
  }
  if ('cause' in error && error.cause != null) {
    lines.push(formatErrorDetail(error.cause, depth + 1));
  }
  return lines.join('\n');
}
