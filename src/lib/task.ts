
import * as os from 'os'
import * as path from 'path'
import { fileURLToPath } from 'url'
import { loadDotEnv } from './env.js'
import {
  getLogFilePath,
  getTaipeiTaskTimestamp,
  initLogger,
  log,
  logContext,
  logError,
  printHeader,
} from './logger.js'
import { safeFileName } from './security.js'

export interface TaskRunContext {
  taskName: string
  runId: string
  projectRoot: string
  scriptPath: string
  scriptDir: string
  logDir: string
  envPath: string | null
  taskArgs: string[]
}

export interface RunTaskEntryOptions {
  taskName: string
  scriptUrl: string
  taskArgs?: string[]
  additionalContext?: Record<string, unknown>
}

function createTaskRunContext(options: RunTaskEntryOptions): TaskRunContext {
  const scriptPath = fileURLToPath(options.scriptUrl)
  const scriptDir = path.dirname(scriptPath)
  const projectRoot = path.resolve(scriptDir, '..')
  const logDir = path.join(projectRoot, 'logs')
  const envPath = loadDotEnv()
  const safeTaskName = safeFileName(options.taskName)
  const runId = `${safeTaskName}-${getTaipeiTaskTimestamp()}`

  return {
    taskName: options.taskName,
    runId,
    projectRoot,
    scriptPath,
    scriptDir,
    logDir,
    envPath,
    taskArgs: options.taskArgs ?? process.argv.slice(2),
  }
}

function toProjectRelativePath(projectRoot: string, targetPath: string | null): string | null {
  if (!targetPath) {
    return null
  }
  return path.relative(projectRoot, targetPath)
}

export async function runTaskEntry(
  options: RunTaskEntryOptions,
  run: (context: TaskRunContext) => Promise<void>
): Promise<number> {
  const context = createTaskRunContext(options)
  initLogger(context.logDir, context.runId)

  // ── 安全網：攔截未預期的 uncaughtException / unhandledRejection ──
  const onFatalError = (label: string) => (error: unknown) => {
    logError(`[${label}] 未預期錯誤（任務：${context.taskName}）`, error)
    const logPath = getLogFilePath()
    if (logPath) {
      console.error(`📄 完整日誌：${logPath}`)
    }
  }
  const onUncaughtException = onFatalError('uncaughtException')
  const onUnhandledRejection = onFatalError('unhandledRejection')
  process.on('uncaughtException', onUncaughtException)
  process.on('unhandledRejection', onUnhandledRejection)

  printHeader(`🤖 RPA 任務：${context.taskName}`)

  const scriptDisplayPath =
    toProjectRelativePath(context.projectRoot, context.scriptPath) ?? context.scriptPath
  log('⚙️', `任務腳本：${scriptDisplayPath}`)

  if (context.envPath) {
    const envDisplayPath =
      toProjectRelativePath(context.projectRoot, context.envPath) ?? context.envPath
    log('⚙️', `已載入環境設定：${envDisplayPath}`)
  } else {
    log('⚠️', '未找到 .env 檔案，將沿用環境變數或預設值', 'WARN')
  }

  logContext('task.runContext', {
    taskName: context.taskName,
    runId: context.runId,
    projectRoot: context.projectRoot,
    scriptPath: context.scriptPath,
    scriptDir: context.scriptDir,
    logDir: context.logDir,
    envPath: context.envPath,
    taskArgs: context.taskArgs,
  })

  logContext('task.environment', {
    nodeVersion: process.version,
    platform: process.platform,
    release: os.release(),
    arch: os.arch(),
    cwd: process.cwd(),
    execPath: process.execPath,
    playwrightBrowsersPath: process.env.PLAYWRIGHT_BROWSERS_PATH ?? null,
  })

  if (options.additionalContext) {
    logContext('task.additionalContext', options.additionalContext)
  }

  const startTime = Date.now()
  let exitCode: number

  try {
    await run(context)
    const durationSec = ((Date.now() - startTime) / 1000).toFixed(1)
    const logPath = getLogFilePath()
    log('🎉', `任務「${context.taskName}」執行完成（耗時 ${durationSec} 秒）`)
    logContext('task.result', {
      status: 'success',
      durationSeconds: parseFloat(durationSec),
      logFile: logPath,
    })
    if (logPath) {
      log('📄', `日誌檔：${logPath}`)
    }
    exitCode = 0
  } catch (error) {
    const durationSec = ((Date.now() - startTime) / 1000).toFixed(1)
    const logPath = getLogFilePath()
    logError(`任務「${context.taskName}」執行失敗（耗時 ${durationSec} 秒）`, error)
    logContext('task.result', {
      status: 'failure',
      durationSeconds: parseFloat(durationSec),
      errorSummary: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
      logFile: logPath,
    })
    if (logPath) {
      console.error(`📄 完整日誌：${logPath}`)
    }
    exitCode = 1
  } finally {
    process.removeListener('uncaughtException', onUncaughtException)
    process.removeListener('unhandledRejection', onUnhandledRejection)
  }

  return exitCode
}
