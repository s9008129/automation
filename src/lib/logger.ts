/**
 * 📝 logger.ts — 日誌 Helper
 *
 * 統一的日誌輸出格式，支援台北時間時間戳記與分級輸出。
 * 所有使用者可見訊息使用正體中文。
 *
 * 使用方式：
 *   import { createLogger } from './lib/logger.js';
 *   const log = createLogger('我的任務');
 *   log.info('開始執行');
 *   log.success('任務完成');
 *   log.error('發生錯誤', err);
 */

export type LogLevel = 'INFO' | 'SUCCESS' | 'WARN' | 'ERROR' | 'DEBUG';

export interface LogEntry {
    timestamp: string;
    level: LogLevel;
    taskName: string;
    message: string;
    detail?: string;
}

const LEVEL_EMOJI: Record<LogLevel, string> = {
    INFO:    'ℹ️ ',
    SUCCESS: '✅ ',
    WARN:    '⚠️ ',
    ERROR:   '❌ ',
    DEBUG:   '🔍 ',
};

/**
 * 取得台北時間的 ISO 8601 格式時間字串。
 */
function getTaipeiISO(): string {
    return new Date().toLocaleString('sv-SE', {
        timeZone: 'Asia/Taipei',
        hour12: false,
    }).replace(' ', 'T') + '+08:00';
}

/**
 * 建立指定任務名稱的 Logger 實例。
 */
export function createLogger(taskName: string) {
    const entries: LogEntry[] = [];

    function write(level: LogLevel, message: string, detail?: string): void {
        const timestamp = getTaipeiISO();
        const entry: LogEntry = { timestamp, level, taskName, message, detail };
        entries.push(entry);

        const prefix = `${LEVEL_EMOJI[level]} [${timestamp}][${taskName}]`;
        if (level === 'ERROR') {
            console.error(`${prefix} ${message}`);
            if (detail) console.error(`   ${detail}`);
        } else if (level === 'WARN') {
            console.warn(`${prefix} ${message}`);
            if (detail) console.warn(`   ${detail}`);
        } else {
            console.log(`${prefix} ${message}`);
            if (detail) console.log(`   ${detail}`);
        }
    }

    return {
        info:    (msg: string, detail?: string) => write('INFO',    msg, detail),
        success: (msg: string, detail?: string) => write('SUCCESS', msg, detail),
        warn:    (msg: string, detail?: string) => write('WARN',    msg, detail),
        error:   (msg: string, detail?: string) => write('ERROR',   msg, detail),
        debug:   (msg: string, detail?: string) => write('DEBUG',   msg, detail),
        /** 取得所有已記錄的日誌條目 */
        getEntries: () => [...entries],
    };
}

export type Logger = ReturnType<typeof createLogger>;
