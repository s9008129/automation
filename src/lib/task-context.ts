/**
 * 📋 task-context.ts — 任務上下文 Helper
 *
 * 提供任務腳本執行時的上下文資訊：
 * - 台北時間時間戳記
 * - 任務識別名稱
 * - 輸出目錄管理
 * - 命令列參數解析
 *
 * 使用方式：
 *   import { createTaskContext } from './lib/task-context.js';
 *   const ctx = createTaskContext('批次簽核');
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** 預設專案根目錄為 src/lib 的上兩層 */
const DEFAULT_PROJECT_ROOT = path.resolve(__dirname, '..', '..');

/** 檔名最大允許長度 */
const MAX_FILENAME_LENGTH = 200;

/** Intl.DateTimeFormat 日期時間欄位的預設填充值 */
const DATE_PART_FALLBACK = '00';

/**
 * 取得台北時間的 ISO 8601 格式時間字串。
 */
export function getTaipeiISO(): string {
    return new Date().toLocaleString('sv-SE', {
        timeZone: 'Asia/Taipei',
        hour12: false,
    }).replace(' ', 'T') + '+08:00';
}

/**
 * 取得台北時間的緊湊時間戳記字串（用於目錄與檔案命名）。
 * 格式：YYYYMMDDHHmmss
 */
export function getTaipeiTimestamp(): string {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Asia/Taipei',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
    }).formatToParts(now);

    const get = (type: string) => parts.find(p => p.type === type)?.value ?? DATE_PART_FALLBACK;
    return `${get('year')}${get('month')}${get('day')}${get('hour')}${get('minute')}${get('second')}`;
}

/**
 * 清理字串，使其可安全用於檔案系統路徑。
 */
export function safeFileName(name: string): string {
    return name
        .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
        .replace(/\s+/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '')
        .slice(0, MAX_FILENAME_LENGTH);
}

export interface TaskContext {
    /** 任務名稱 */
    taskName: string;
    /** 任務啟動時的台北時間戳記（YYYYMMDDHHmmss） */
    timestamp: string;
    /** 專案根目錄的絕對路徑 */
    projectRoot: string;
    /** 本次任務的輸出目錄（logs/<timestamp>_<taskName>/） */
    outputDir: string;
    /** 是否為 dry-run 模式（只列印操作，不實際執行） */
    isDryRun: boolean;
    /** 原始命令列參數 */
    argv: string[];
    /** 解析後的 flag 參數（以 -- 開頭的參數） */
    flags: Record<string, string | boolean>;
}

/**
 * 建立任務執行上下文。
 *
 * @param taskName 任務名稱（用於輸出目錄命名與日誌）
 * @param projectRoot 專案根目錄（預設自動偵測）
 */
export function createTaskContext(taskName: string, projectRoot?: string): TaskContext {
    const root = projectRoot ?? DEFAULT_PROJECT_ROOT;
    const timestamp = getTaipeiTimestamp();
    const safeName = safeFileName(taskName);
    const outputDir = path.join(root, 'logs', `${timestamp}_${safeName}`);

    // 解析命令列參數
    const argv = process.argv.slice(2);
    const flags: Record<string, string | boolean> = {};
    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        if (arg.startsWith('--')) {
            const key = arg.slice(2);
            const next = argv[i + 1];
            if (next && !next.startsWith('--')) {
                flags[key] = next;
                i++;
            } else {
                flags[key] = true;
            }
        }
    }

    const isDryRun = flags['dry-run'] === true || flags['dryRun'] === true;

    return {
        taskName,
        timestamp,
        projectRoot: root,
        outputDir,
        isDryRun,
        argv,
        flags,
    };
}

/**
 * 確保目錄存在，不存在時自動建立。
 */
export function ensureDir(dirPath: string): void {
    fs.mkdirSync(dirPath, { recursive: true });
}
