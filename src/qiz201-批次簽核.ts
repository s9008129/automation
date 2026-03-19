/**
 * 📋 QIZ201 批次簽核任務腳本
 *
 * 流程：
 *   1. 開啟 SSO 憑證登入頁並送出登入
 *   2. 穩定解析登入後真正存活的 QIZ 頁面
 *   3. 進入「我的批次簽核」逐一處理所有功能代碼
 *   4. 回到「我的待辦事項」確認待辦是否清零
 */

import { getEnv, requireEnv } from './lib/env.js'
import {
  closeTaskBrowser,
  getNestedFrame,
  launchTaskBrowser,
  waitForMatchingPageInContext,
} from './lib/browser.js'
import { log, logContext, printSection } from './lib/logger.js'
import { runTaskEntry, type TaskRunContext } from './lib/task.js'
import type { Dialog, FrameLocator, Page } from 'playwright'

const TASK_NAME = 'QIZ201-批次簽核'
const DEFAULT_SSO_LOGIN_URL =
  'https://sso.voa.fia.gov.tw/cas/login?service=https%3A%2F%2Fqiz.voa.fia.gov.tw%2Fqiz%2Fhome%2Findex.jsp%3Ffunc_id%3DQIZ201Q_'
const QIZ_URL_PATTERN = /qiz\.voa\.fia\.gov\.tw/
const MAX_BATCH_PAGE_SIZE = 50

interface PaginationInfo {
  totalRows: number
  totalPages: number
  currentPage: number
}

interface FunOption {
  value: string
  label: string
}

function getV1Frame(page: Page): FrameLocator {
  return getNestedFrame(page)
}

async function captureQueryResultSnapshot(v1: FrameLocator): Promise<string> {
  const articleText = await v1.locator('article').innerText().catch(() => '')
  return articleText.replace(/\s+/g, ' ').trim()
}

async function waitForQueryResult(
  v1: FrameLocator,
  options: {
    timeoutMs?: number
    previousSnapshot?: string | null
  } = {}
): Promise<string> {
  const { timeoutMs = 15_000, previousSnapshot = null } = options

  await v1.locator('article').waitFor({ state: 'visible', timeout: timeoutMs })
  await v1.getByText('筆 / 共').first().waitFor({ state: 'visible', timeout: timeoutMs })

  if (!previousSnapshot) {
    return captureQueryResultSnapshot(v1)
  }

  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const currentSnapshot = await captureQueryResultSnapshot(v1)
    if (currentSnapshot && currentSnapshot !== previousSnapshot) {
      return currentSnapshot
    }
    await new Promise(resolve => setTimeout(resolve, 300))
  }

  return captureQueryResultSnapshot(v1)
}

async function parsePagination(v1: FrameLocator): Promise<PaginationInfo> {
  const resultText = await v1.locator('article').innerText()
  const totalRowsMatch = resultText.match(/共\s*(\d+)\s*筆/)
  const pageMatches = [...resultText.matchAll(/第\s*(\d+)\s*頁\s*\/\s*共\s*(\d+)\s*頁/g)]
  const currentPageMatch = pageMatches.at(-1)

  return {
    totalRows: totalRowsMatch ? parseInt(totalRowsMatch[1], 10) : 0,
    currentPage: currentPageMatch ? parseInt(currentPageMatch[1], 10) : 1,
    totalPages: currentPageMatch ? parseInt(currentPageMatch[2], 10) : 0,
  }
}

async function readFunOptions(v1: FrameLocator): Promise<FunOption[]> {
  return v1.locator('#FUN_CD option').evaluateAll(elements =>
    elements
      .map(element => {
        const option = element as HTMLOptionElement
        return {
          value: option.value.trim(),
          label: option.textContent?.trim() ?? '',
        }
      })
      .filter(option => option.value !== '')
  )
}

async function processFunCode(
  page: Page,
  v1: FrameLocator,
  funOption: FunOption
): Promise<number> {
  let totalProcessed = 0
  log('📂', `選擇功能代碼：${funOption.value} ${funOption.label}`)

  const beforeSelectSnapshot = await captureQueryResultSnapshot(v1)
  await v1.locator('#FUN_CD').selectOption(funOption.value)
  await waitForQueryResult(v1, {
    previousSnapshot: beforeSelectSnapshot,
    timeoutMs: 15_000,
  })

  while (true) {
    const pagination = await parsePagination(v1)
    log(
      '📊',
      `功能 ${funOption.value} — 共 ${pagination.totalRows} 筆，第 ${pagination.currentPage} / ${pagination.totalPages} 頁`
    )

    if (pagination.totalRows === 0) {
      log('✅', `功能 ${funOption.value} 無待辦事項，跳過`)
      break
    }

    await v1.getByRole('link', { name: '全選' }).click()
    await page.waitForTimeout(500)

    const beforeBatchSnapshot = await captureQueryResultSnapshot(v1)
    await v1.getByRole('button', { name: 'F6批次處理' }).click()
    log('⏳', `已送出 F6 批次處理（第 ${pagination.currentPage} 頁）`)

    try {
      await waitForQueryResult(v1, {
        previousSnapshot: beforeBatchSnapshot,
        timeoutMs: 20_000,
      })
    } catch {
      log('⚠️', '等待批次處理結果逾時，將重新解析頁面狀態後繼續')
    }

    totalProcessed += Math.min(pagination.totalRows, MAX_BATCH_PAGE_SIZE)

    const afterProcess = await parsePagination(v1)
    if (afterProcess.totalRows === 0) {
      log('✅', `功能 ${funOption.value} 已處理完成`)
      break
    }

    log('📄', `功能 ${funOption.value} 尚餘 ${afterProcess.totalRows} 筆，繼續下一輪處理`)
  }

  return totalProcessed
}

async function runTask(context: TaskRunContext): Promise<void> {
  const certPassword = requireEnv('CERT_PASSWORD')
  const loginUrl = getEnv('QIZ201_SSO_LOGIN_URL', DEFAULT_SSO_LOGIN_URL)

  logContext('task.inputs', {
    taskArgs: context.taskArgs,
    loginUrl,
  })
  log('⚙️', `登入網址：${loginUrl}`)

  const browserContext = await launchTaskBrowser({
    channel: 'msedge',
    headless: false,
    width: 1280,
    height: 800,
  })
  const { page, context: playwrightContext } = browserContext

  try {
    printSection('Step 1：SSO 憑證登入')
    log('🌐', '正在開啟 SSO 登入頁...')
    await page.goto(loginUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 })

    await page.getByRole('img', { name: '財稅雲端平台入口網' }).waitFor({
      state: 'visible',
      timeout: 15_000,
    })

    log('🔑', '正在輸入憑證密碼...')
    const certPasswordInput = page.getByRole('textbox', { name: '請輸入憑證密碼' })
    await certPasswordInput.click()
    await certPasswordInput.fill(certPassword)

    logContext('task.login.beforeSubmitPages', {
      pageCount: playwrightContext.pages().length,
      pages: playwrightContext.pages().map(currentPage => currentPage.url()),
    })

    await page.getByRole('button', { name: '憑證登入' }).click()
    log('🔐', '已送出登入，等待 QIZ 系統頁面穩定...')

    printSection('Step 2：等待 QIZ 系統載入')
    const qizPage = await waitForMatchingPageInContext(playwrightContext, QIZ_URL_PATTERN, {
      timeoutMs: 60_000,
      description: 'QIZ 系統頁面',
    })

    logContext('task.login.afterResolvePages', {
      pageCount: playwrightContext.pages().filter(currentPage => !currentPage.isClosed()).length,
      pages: playwrightContext
        .pages()
        .filter(currentPage => !currentPage.isClosed())
        .map(currentPage => currentPage.url()),
      reusedOriginalPage: qizPage === page,
      selectedUrl: qizPage.url(),
    })

    if (qizPage === page) {
      log('📌', '登入後沿用原始頁面進入 QIZ')
    } else {
      log('📌', `登入後已切換至新頁面：${qizPage.url()}`)
    }
    await qizPage.bringToFront().catch(() => undefined)

    const dialogHandler = async (dialog: Dialog): Promise<void> => {
      log('💬', `系統對話框：${dialog.message()}`)
      await dialog.accept()
    }
    qizPage.on('dialog', dialogHandler)

    try {
      const v1 = getV1Frame(qizPage)
      await v1.getByRole('button', { name: '我的待辦事項' }).waitFor({
        state: 'visible',
        timeout: 20_000,
      })
      log('✅', 'QIZ 待辦事項頁面已就緒')

      printSection('Step 3：進入我的批次簽核')
      const beforeBatchTabSnapshot = await captureQueryResultSnapshot(v1)
      await v1.getByRole('button', { name: '我的批次簽核' }).click()
      await waitForQueryResult(v1, {
        previousSnapshot: beforeBatchTabSnapshot,
        timeoutMs: 15_000,
      })
      log('📋', '已進入「我的批次簽核」')

      printSection('Step 4：批次簽核處理')
      const funOptions = await readFunOptions(v1)
      log('📑', `共有 ${funOptions.length} 個功能代碼待處理`)
      logContext('task.funOptions', { funOptions })

      let grandTotal = 0
      for (const funOption of funOptions) {
        const processedCount = await processFunCode(qizPage, v1, funOption)
        grandTotal += processedCount
        if (processedCount > 0) {
          log('🎯', `功能 ${funOption.value} 已處理 ${processedCount} 筆`)
        }
      }

      printSection('Step 5：確認待辦清零')
      const beforeTodoSnapshot = await captureQueryResultSnapshot(v1)
      await v1.getByRole('button', { name: '我的待辦事項' }).click()
      await waitForQueryResult(v1, {
        previousSnapshot: beforeTodoSnapshot,
        timeoutMs: 15_000,
      })

      const finalPagination = await parsePagination(v1)
      if (finalPagination.totalRows === 0) {
        log('🎉', '確認完成：我的待辦事項共 0 筆')
      } else {
        log('⚠️', `我的待辦事項尚餘 ${finalPagination.totalRows} 筆，可能有非批次簽核項目`)
      }

      log('✅', `${TASK_NAME} 任務完成，本次共處理 ${grandTotal} 筆`)
    } finally {
      qizPage.off('dialog', dialogHandler)
    }
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

process.exit(exitCode)
