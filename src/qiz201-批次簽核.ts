/**
 * 📋 qiz201-批次簽核 任務腳本
 *
 * 嚴格依照 recording-1.ts + 所有實測修正：
 *
 *   Step 1: SSO 登入（service 指向 EIP）
 *   Step 2: 等待 SSO 自動 redirect 到 EIP（輪詢，不可 goto 打斷）
 *   Step 3: 在 EIP 首頁 article 區塊解析電子表單待辦數
 *           待辦=0 且代理=0 → 「無表單需要簽核!」→ 結束
 *   Step 4: 開新分頁直接導航到 QIZ（SSO session 已建立）
 *   Step 5: 進入「我的批次簽核」
 *   Step 6: 檢查 #FUN_CD 下拉選單（第二層防護）
 *   Step 7: 逐功能代碼全選 → F6批次處理 → 多頁迴圈
 *   Step 8: 回到「我的待辦事項」確認清零
 *
 * ✅  整合本專案既有框架
 * ✅  預設使用 Edge（channel: 'msedge'）
 * ✅  敏感資訊從 .env 讀取
 * ✅  面向使用者的訊息使用正體中文
 */

import { getEnv, requireEnv } from './lib/env.js'
import { launchTaskBrowser, closeTaskBrowser } from './lib/browser.js'
import { log, logContext, printSection } from './lib/logger.js'
import { runTaskEntry, type TaskRunContext } from './lib/task.js'
import type { Page, FrameLocator, BrowserContext } from 'playwright'

const TASK_NAME = '批次簽核'

const SSO_LOGIN_URL =
  'https://sso.voa.fia.gov.tw/cas/login?service=https%3A%2F%2Feip-lts.voa.fia.gov.tw%2Feip%2Feip%2Feip100%2Feip100m_v1.jsp'

const EIP_URL =
  'https://eip-lts.voa.fia.gov.tw/eip/eip/eip100/eip100m_v1.jsp'

// QIZ 待辦事項直連 URL（SSO session 建立後可直接存取）
const QIZ_URL =
  'https://qiz.voa.fia.gov.tw/qiz/home/index.jsp?func_id=QIZ201Q_'

function getV1Frame(page: Page): FrameLocator {
  return page
    .locator('iframe[name="mainFrame"]')
    .contentFrame()
    .locator('iframe[name="v1"]')
    .contentFrame()
}

async function parsePagination(v1: FrameLocator): Promise<{
  totalRows: number
  totalPages: number
  currentPage: number
}> {
  const resultText = await v1.locator('article').innerText({ timeout: 10_000 })
  const totalRowsMatch = resultText.match(/共\s*(\d+)\s*筆/)
  const totalPagesMatch = resultText.match(/共\s*(\d+)\s*頁/)
  const currentPageMatch = resultText.match(/第\s*(\d+)\s*頁/)
  return {
    totalRows: totalRowsMatch ? parseInt(totalRowsMatch[1], 10) : 0,
    totalPages: totalPagesMatch ? parseInt(totalPagesMatch[1], 10) : 0,
    currentPage: currentPageMatch ? parseInt(currentPageMatch[1], 10) : 1,
  }
}

async function waitForQueryResult(v1: FrameLocator, timeoutMs = 15_000): Promise<void> {
  await v1.getByText(/筆\s*\/\s*共/).first().waitFor({ state: 'visible', timeout: timeoutMs })
}

async function processFunCode(
  page: Page,
  v1: FrameLocator,
  funCode: string,
  funLabel: string
): Promise<number> {
  let totalProcessed = 0

  log('📂', `選擇功能代碼：${funCode} ${funLabel}`)

  await v1.locator('#FUN_CD').selectOption(funCode)
  await page.waitForTimeout(2_000)

  try {
    await waitForQueryResult(v1)
  } catch {
    log('⚠️', `功能 ${funCode} 查詢結果載入逾時，跳過`)
    return 0
  }

  let round = 0
  const MAX_ROUNDS = 50

  while (round < MAX_ROUNDS) {
    round++

    const { totalRows, totalPages, currentPage } = await parsePagination(v1)
    log('📊', `功能 ${funCode} — 共 ${totalRows} 筆，第 ${currentPage} / ${totalPages} 頁`)

    if (totalRows === 0) {
      if (round === 1) log('✅', `功能 ${funCode} 無待辦事項，跳過`)
      break
    }

    await v1.getByRole('link', { name: '全選' }).click()
    await page.waitForTimeout(500)

    const dialogPromise = new Promise<void>((resolve) => {
      const handler = async (dialog: import('playwright').Dialog) => {
        log('💬', `系統對話框：${dialog.message()}`)
        await dialog.accept()
        resolve()
      }
      page.once('dialog', handler)
      setTimeout(() => {
        page.removeListener('dialog', handler)
        resolve()
      }, 3_000)
    })

    await v1.getByRole('button', { name: 'F6批次處理' }).click()
    log('⏳', `已送出 F6 批次處理（第 ${round} 輪）`)

    await dialogPromise
    await page.waitForTimeout(3_000)

    try {
      await waitForQueryResult(v1, 20_000)
    } catch {
      log('⚠️', '等待查詢結果逾時，嘗試繼續...')
    }

    totalProcessed += Math.min(totalRows, 50)

    const after = await parsePagination(v1)
    if (after.totalRows === 0) break
    log('📄', `尚有 ${after.totalRows} 筆待處理，繼續下一輪...`)
  }

  return totalProcessed
}

/**
 * 等待頁面離開 SSO（輪詢，不可用 page.goto 打斷 redirect）
 */
async function waitForSsoRedirect(page: Page, timeoutMs = 60_000): Promise<void> {
  const startTime = Date.now()
  const pollInterval = 2_000
  let lastLogTime = 0

  while (Date.now() - startTime < timeoutMs) {
    const currentUrl = page.url()
    const hostname = new URL(currentUrl).hostname

    if (hostname !== 'sso.voa.fia.gov.tw') {
      log('✅', `頁面已離開 SSO：${currentUrl}`)
      return
    }

    const elapsed = Math.floor((Date.now() - startTime) / 1000)
    if (elapsed - lastLogTime >= 10) {
      log('⏳', `已等待 ${elapsed} 秒，仍在 SSO...`)
      lastLogTime = elapsed
    }

    await page.waitForTimeout(pollInterval)
  }

  log('⚠️', 'SSO 未自動跳轉，嘗試手動導航到 EIP...')
  await page.goto(EIP_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 })
}

/**
 * 從 EIP 首頁 article 元素解析「電子表單待辦事項」的待辦與代理數字
 *
 * ARIA 快照確認 EIP 首頁的 article 區塊包含文字：
 *   「公文簽核待辦事項 待辦 1 主管待簽核 0 代理 0 主管代理 0
 *    電子表單待辦事項 待辦 18 代理 0
 *    差勤待辦事項 待辦 - 通知事項 通知型 1 作業型 0」
 *
 * ⚠️ 不使用 CSS class 選擇器（.moddleft50 在實際頁面不存在，已實測確認）
 */
async function getEFormPendingCount(page: Page): Promise<{
  pending: number
  proxy: number
} | null> {
  try {
    // 使用 ARIA 快照確認存在的 article 元素
    const articleText = await page.locator('article').innerText({ timeout: 10_000 })
    log('📝', `EIP dashboard 文字已取得（${articleText.length} 字元）`)

    // 從整段文字中擷取「電子表單待辦事項」段落
    // 格式：「電子表單待辦事項 待辦 18 代理 0」
    const eFormMatch = articleText.match(
      /電子表單待辦事項[\s\S]*?待辦\s*(\d+)[\s\S]*?代理\s*(\d+)/
    )

    if (eFormMatch) {
      return {
        pending: parseInt(eFormMatch[1], 10),
        proxy: parseInt(eFormMatch[2], 10),
      }
    }

    log('⚠️', '在 article 中找不到「電子表單待辦事項」的數字格式')
    return null
  } catch (err) {
    log('⚠️', `解析 EIP 首頁 article 失敗：${err}`)
    return null
  }
}

async function runTask(context: TaskRunContext): Promise<void> {
  const certPassword = requireEnv('CERT_PASSWORD')

  logContext('task.inputs', {
    taskArgs: context.taskArgs,
    loginUrl: SSO_LOGIN_URL,
    eipUrl: EIP_URL,
  })

  const browserContext = await launchTaskBrowser({
    channel: 'msedge',
    headless: false,
    width: 1280,
    height: 800,
  })
  const { page } = browserContext

  try {
    // ══════════════════════════════════════════════
    //  Step 1：SSO 憑證登入
    // ══════════════════════════════════════════════
    printSection('Step 1：SSO 憑證登入')

    log('🌐', '正在開啟 SSO 登入頁...')
    await page.goto(SSO_LOGIN_URL, { waitUntil: 'domcontentloaded' })

    await page.getByRole('textbox', { name: '請輸入憑證密碼' }).waitFor({
      state: 'visible',
      timeout: 15_000,
    })

    log('🔑', '正在輸入憑證密碼...')
    await page.getByRole('textbox', { name: '請輸入憑證密碼' }).click()
    await page.getByRole('textbox', { name: '請輸入憑證密碼' }).fill(certPassword)

    log('🔐', '點選「憑證登入」...')

    const popupClosedPromise = new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        log('📌', '30 秒內未偵測到 popup，繼續流程...')
        resolve()
      }, 30_000)

      page.context().once('page', (popupPage) => {
        log('📌', '偵測到憑證選取視窗，等待完成...')
        popupPage.once('close', () => {
          clearTimeout(timeout)
          log('📌', '憑證選取視窗已關閉')
          resolve()
        })
      })
    })

    await page.getByRole('button', { name: '憑證登入' }).click()
    await popupClosedPromise
    log('✅', '憑證登入完成')

    // ══════════════════════════════════════════════
    //  Step 2：等待 SSO 自動跳轉到 EIP
    // ══════════════════════════════════════════════
    printSection('Step 2：等待 SSO 跳轉到 EIP')

    log('⏳', '等待 SSO 跳轉（最多 60 秒）...')
    await waitForSsoRedirect(page, 60_000)

    const currentHostname = new URL(page.url()).hostname
    if (currentHostname !== 'eip-lts.voa.fia.gov.tw') {
      log('⚠️', `未預期的頁面：${page.url()}，嘗試導航到 EIP...`)
      await page.goto(EIP_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 })
    } else {
      log('✅', `已到達 EIP 首頁`)
    }

    await page.getByRole('link', { name: '登出' }).waitFor({
      state: 'visible',
      timeout: 15_000,
    })
    log('✅', `EIP 首頁已載入：${page.url()}`)

    // ══════════════════════════════════════════════
    //  Step 3：在 EIP 首頁 article 解析電子表單待辦數
    //
    //  ⚠️ 不使用 .moddleft50 CSS 選擇器（實測不存在）
    //  改用 ARIA 快照確認的 article 元素解析文字
    // ══════════════════════════════════════════════
    printSection('Step 3：檢查電子表單待辦數')

    const eFormCount = await getEFormPendingCount(page)

    if (eFormCount) {
      log('📊', `電子表單待辦：${eFormCount.pending} 筆，代理：${eFormCount.proxy} 筆`)

      if (eFormCount.pending === 0 && eFormCount.proxy === 0) {
        log('🎉', '無表單需要簽核!')
        log('✅', `${TASK_NAME} 任務完成（EIP 首頁顯示電子表單待辦 0 筆）`)
        await page.close()
        return
      }
    } else {
      // 無法解析數字時，保守起見繼續進入 QIZ 確認
      log('⚠️', '無法解析待辦數字，將進入 QIZ 確認實際狀態')
    }

    // ══════════════════════════════════════════════
    //  Step 4：開新分頁導航到 QIZ
    //
    //  ⚠️ 不再依賴 dashboard 點擊觸發 popup
    //  （.moddleft50 CSS class 不存在，待辦=0 時也不觸發）
    //  改用 context.newPage() 直接開新分頁到 QIZ，
    //  SSO session cookie 已建立，CAS 會自動發放 ticket。
    // ══════════════════════════════════════════════
    printSection('Step 4：開啟 QIZ 電子表單系統')

    log('🌐', '開新分頁導航到 QIZ...')
    const qizPage = await page.context().newPage()
    await qizPage.goto(QIZ_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 })

    // 等待 QIZ 頁面完成載入（可能經過 CAS ticket redirect）
    await qizPage.waitForURL(/qiz\.voa\.fia\.gov\.tw/, { timeout: 30_000 })
    log('✅', `QIZ 系統已載入：${qizPage.url()}`)

    const v1 = getV1Frame(qizPage)
    await v1.getByRole('button', { name: '我的待辦事項' }).waitFor({
      state: 'visible',
      timeout: 20_000,
    })
    log('✅', '待辦事項頁面已就緒')

    // ══════════════════════════════════════════════
    //  Step 5：進入「我的批次簽核」
    // ══════════════════════════════════════════════
    printSection('Step 5：進入我的批次簽核')

    await v1.getByRole('button', { name: '我的批次簽核' }).click()
    log('📋', '已點選「我的批次簽核」')

    await v1.locator('#FUN_CD').waitFor({ state: 'visible', timeout: 10_000 })
    await qizPage.waitForTimeout(2_000)

    // ══════════════════════════════════════════════
    //  Step 6：檢查 #FUN_CD（第二層防護）
    //  必須在 waitForQueryResult 之前！
    // ══════════════════════════════════════════════
    printSection('Step 6：檢查待簽核表單')

    const funOptions = await v1.locator('#FUN_CD option').evaluateAll(
      (options: HTMLOptionElement[]) =>
        options
          .filter((opt) => opt.value && opt.value.trim() !== '')
          .map((opt) => ({
            value: opt.value,
            label: opt.textContent?.trim() ?? '',
          }))
    )

    if (funOptions.length === 0) {
      log('🎉', '無表單需要簽核!')
      log('✅', `${TASK_NAME} 任務完成（批次簽核頁面無可選功能代碼）`)
      await qizPage.close()
      await page.close()
      return
    }

    log('📑', `共有 ${funOptions.length} 個功能代碼待處理`)

    try {
      await waitForQueryResult(v1)
    } catch {
      log('⚠️', '初始查詢結果載入逾時，嘗試繼續...')
    }

    // ══════════════════════════════════════════════
    //  Step 7：逐一處理所有功能代碼
    // ══════════════════════════════════════════════
    printSection('Step 7：批次簽核處理')

    let grandTotal = 0

    for (const opt of funOptions) {
      const count = await processFunCode(qizPage, v1, opt.value, opt.label)
      grandTotal += count
      if (count > 0) {
        log('🎯', `功能 ${opt.value} 已處理 ${count} 筆`)
      }
    }

    // ══════════════════════════════════════════════
    //  Step 8：回到「我的待辦事項」確認
    // ══════════════════════════════════════════════
    printSection('Step 8：確認待辦清零')

    await v1.getByRole('button', { name: '我的待辦事項' }).click()
    await qizPage.waitForTimeout(2_000)
    await waitForQueryResult(v1)

    const finalPagination = await parsePagination(v1)
    if (finalPagination.totalRows === 0) {
      log('🎉', '確認完成：待辦事項共 0 筆，全部簽核完畢！')
    } else {
      log('⚠️', `待辦事項尚餘 ${finalPagination.totalRows} 筆（可能有無法批次處理的項目）`)
    }

    log('✅', `${TASK_NAME} 任務完成，本次共處理 ${grandTotal} 筆`)

    await qizPage.close()
    await page.close()
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
