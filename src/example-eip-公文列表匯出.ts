
/**
 * 📘 範例任務腳本：EIP 公文列表匯出
 *
 * 這是一個示範用腳本，展示本專案任務腳本的標準寫法：
 * - runTaskEntry 標準入口
 * - .env 載入（由 task helper 統一處理）
 * - channel: 'msedge'，headless: false
 * - 正體中文訊息 + 結構化 logContext
 * - 多頁迴圈處理
 * - CAS SSO 登入等待模式
 *
 * 執行方式：
 *   .un-task.ps1 src\example-eip-公文列表匯出.ts
 *
 * ⚠️ 此腳本為範例展示，目標 URL 為佔位符，執行前請修改為實際網址。
 */

import * as fs from 'fs'
import * as path from 'path'
import { getEnv } from './lib/env.js'
import {
  log,
  logContext,
  printSection,
  getTaipeiTaskTimestamp,
  getTaipeiISO,
} from './lib/logger.js'
import { launchTaskBrowser, closeTaskBrowser, waitForNavigation } from './lib/browser.js'
import { runTaskEntry, type TaskRunContext } from './lib/task.js'

const TASK_NAME = 'EIP-公文列表匯出'

interface Document {
  序號: number
  主旨: string
  文號: string
  發文日期: string
  狀態: string
}

async function runTask(context: TaskRunContext): Promise<void> {
  const systemUrl = getEnv('EIP_URL', 'https://eip-lts.voa.fia.gov.tw')
  const maxPages = parseInt(getEnv('EIP_MAX_PAGES', '100'), 10)

  logContext('task.inputs', {
    taskArgs: context.taskArgs,
    systemUrl,
    maxPages,
  })
  log('⚙️', `系統網址：${systemUrl}`)
  log('⚙️', `最多處理頁數：${maxPages}`)

  const browserContext = await launchTaskBrowser({
    channel: 'msedge',
    headless: false,
    width: 1280,
    height: 800,
  })
  const { page } = browserContext

  const allDocuments: Document[] = []

  try {
    printSection('登入流程')
    log('🌐', `正在開啟 ${systemUrl}...`)
    await page.goto(systemUrl, { timeout: 30000 })

    log('🔐', '等待 CAS SSO 登入完成...')
    log('💡', '請在瀏覽器中完成憑證登入，腳本將自動繼續')

    await waitForNavigation(page, '**/eip100/eip100m_v1.jsp**', 60000, 'EIP 主畫面')
    log('✅', '已進入 EIP 主畫面')

    printSection('讀取公文列表')
    await page.getByRole('link', { name: '公文管理' }).click()
    await page.waitForLoadState('networkidle')

    let currentPage = 1
    let hasNextPage = true

    while (hasNextPage && currentPage <= maxPages) {
      log('📄', `正在讀取第 ${currentPage} 頁...`)

      const rows = await page.locator('table tbody tr').all()
      for (let i = 0; i < rows.length; i++) {
        const cells = await rows[i].locator('td').allTextContents()
        if (cells.length >= 5) {
          allDocuments.push({
            序號: allDocuments.length + 1,
            主旨: cells[1]?.trim() ?? '',
            文號: cells[2]?.trim() ?? '',
            發文日期: cells[3]?.trim() ?? '',
            狀態: cells[4]?.trim() ?? '',
          })
        }
      }

      logContext('task.pageProgress', {
        currentPage,
        rowCount: rows.length,
        totalCount: allDocuments.length,
      })
      log('ℹ️', `第 ${currentPage} 頁已讀取 ${rows.length} 筆`)

      const nextButton = page.getByRole('button', { name: '下一頁' })
      const isDisabled = await nextButton.isDisabled().catch(() => true)
      const isVisible = await nextButton.isVisible().catch(() => false)

      if (!isVisible || isDisabled) {
        hasNextPage = false
      } else {
        await nextButton.click()
        await page.waitForLoadState('networkidle')
        currentPage++
      }
    }

    log('✅', `共讀取 ${allDocuments.length} 筆公文資料（${currentPage} 頁）`)

    printSection('匯出結果')
    const outputDir = path.join(context.projectRoot, 'materials', 'exports')
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true })
    }

    const timestamp = getTaipeiTaskTimestamp()
    const outputPath = path.join(outputDir, `eip-公文列表-${timestamp}.json`)
    const exportData = {
      exportedAt: getTaipeiISO(),
      taskName: TASK_NAME,
      totalCount: allDocuments.length,
      documents: allDocuments,
    }

    fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2), 'utf-8')
    log('💾', `匯出完成：${outputPath}`)
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
