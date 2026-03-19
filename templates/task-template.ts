/**
 * 📋 任務腳本範本
 *
 * 建議流程：
 *   1. 先執行 .\new-task.ps1 建立 src\ 任務骨架
 *   2. 把這份腳本與同一次 materials\ 任務資料夾交給 AI 補完
 *   3. 透過 .\run-task.ps1 src\你的腳本.ts 執行
 *
 * ⚠️  注意事項（AI 生成腳本時必須遵守）
 * ✅  必須整合本專案既有框架，不可生成獨立專案
 * ✅  入口固定使用 runTaskEntry + run-task.ps1
 * ✅  共享模組優先重用 src/lib/*
 * ✅  預設使用 Edge（channel: 'msedge'）
 * ✅  敏感資訊從 .env 讀取，禁止硬編碼
 * ✅  面向使用者的訊息使用正體中文
 */

import { getEnv } from './lib/env.js'
import { launchTaskBrowser, closeTaskBrowser } from './lib/browser.js'
import { log, logContext, printSection } from './lib/logger.js'
import { runTaskEntry, type TaskRunContext } from './lib/task.js'

const TASK_NAME = '任務名稱'

async function runTask(context: TaskRunContext): Promise<void> {
  const systemUrl = getEnv('TARGET_URL', 'https://your-target-url.example.com')

  logContext('task.inputs', {
    taskArgs: context.taskArgs,
    systemUrl,
  })

  const browserContext = await launchTaskBrowser({
    channel: 'msedge',
    headless: false,
    width: 1280,
    height: 800,
  })
  const { page } = browserContext

  try {
    printSection('開始執行')
    log('🌐', `正在開啟目標頁面：${systemUrl}`)
    await page.goto(systemUrl)

    // TODO: 在這裡補上登入與任務邏輯
    // - 若需要帳號密碼，請改用 requireEnv() 或 getEnv() 從 .env 讀取
    // - 若要接上已登入的 Edge Debug 視窗，可改用 cdpConnect() / cdpDisconnect()
    // - 若需輸出檔名或資料夾名稱，請用 safeFileName() 避免非法字元

    log('✅', `${TASK_NAME} 任務完成`)
  } finally {
    await closeTaskBrowser(browserContext)
  }
}

const exitCode = await runTaskEntry(
  {
    taskName: TASK_NAME,
    scriptUrl: import.meta.url,
  },
  runTask
)

process.exitCode = exitCode
