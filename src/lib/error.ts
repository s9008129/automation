/**
 * 🔴 error.ts — 錯誤格式化 Helper
 *
 * 統一的錯誤處理與格式化工具。
 * 所有面向使用者的錯誤訊息使用正體中文。
 *
 * 使用方式：
 *   import { formatError, handleTaskError } from './lib/error.js';
 */

export interface FormattedError {
    message: string;
    stack?: string;
    cause?: string;
}

/**
 * 將 unknown 型別的錯誤統一格式化為結構化物件。
 */
export function formatError(error: unknown): FormattedError {
    if (error instanceof Error) {
        return {
            message: error.message,
            stack: error.stack,
            cause: error.cause ? String(error.cause) : undefined,
        };
    }
    return { message: String(error) };
}

/**
 * 在任務頂層使用：捕捉未處理的錯誤，輸出中文錯誤訊息並以 exit code 1 結束。
 *
 * @example
 * try {
 *   await main();
 * } catch (err) {
 *   handleTaskError(err, '批次簽核');
 * }
 */
export function handleTaskError(error: unknown, taskName?: string): never {
    const fmt = formatError(error);
    const prefix = taskName ? `【${taskName}】` : '';
    console.error(`\n❌ ${prefix}執行失敗：${fmt.message}`);
    if (fmt.stack) {
        console.error('\n--- 錯誤堆疊（供 AI 分析用）---');
        console.error(fmt.stack);
        console.error('---');
    }
    console.error('\n請將以上錯誤訊息提供給 AI 協助排查。');
    process.exit(1);
}

/**
 * 驗證必要條件，不符合時拋出帶有中文說明的錯誤。
 */
export function assert(condition: boolean, message: string): asserts condition {
    if (!condition) {
        throw new Error(message);
    }
}
