/**
 * 🏗️ 內部網路網頁素材離線蒐集工具 v1.0.0
 *
 * 完全離線運作，不需要任何網際網路連線。
 * 連接到已開啟 CDP Debug 模式的 Chrome，自動蒐集：
 *   1. ARIA 快照（頁面語意結構 — AI 分析的核心素材）
 *   2. 截圖（視覺參考）
 *   3. Codegen 錄製（互動流程記錄）
 *   4. HTML 原始碼（可選）
 *   5. iframe 深層結構（自動遞迴）
 *
 * 使用方式：
 *   npx tsx collect-materials.ts                    # 互動模式（推薦新手）
 *   npx tsx collect-materials.ts --auto             # 自動模式（依設定檔）
 *   npx tsx collect-materials.ts --snapshot         # 只擷取當前頁面快照
 *   npx tsx collect-materials.ts --record <name>    # 啟動 codegen 錄製
 *   npx tsx collect-materials.ts --config <path>    # 使用指定設定檔
 *
 * 目標環境：Windows 11 + PowerShell 7.x（也支援 macOS / Linux）
 */

import { chromium, Browser, Page, Frame } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import { spawn } from 'child_process';

// ============================================================
// 型別定義
// ============================================================

interface CollectConfig {
  projectName: string;
  description: string;
  cdpPort: number;
  outputDir: string;
  collectOptions: {
    ariaSnapshot: boolean;
    screenshot: boolean;
    codegenRecording: boolean;
    htmlSource: boolean;
    iframeDepth: number;
  };
  pages: PageTarget[];
  interactiveFlows: InteractiveFlow[];
}

interface PageTarget {
  name: string;
  url: string;
  description: string;
  waitFor: 'load' | 'domcontentloaded' | 'networkidle' | 'commit';
  actions: PageAction[];
}

interface PageAction {
  type: 'click' | 'type' | 'wait' | 'navigate';
  selector?: string;
  text?: string;
  url?: string;
  waitMs?: number;
  description?: string;
}

interface InteractiveFlow {
  name: string;
  description: string;
  startUrl: string;
  instructions: string;
}

interface MaterialMetadata {
  projectName: string;
  collectedAt: string;
  timezone: string;
  toolVersion: string;
  platform: string;
  nodeVersion: string;
  playwrightVersion: string;
  logFile: string;
  totalPages: number;
  collectedPages: PageMetadata[];
  recordings: RecordingMetadata[];
  errors: ErrorRecord[];
}

interface PageMetadata {
  name: string;
  url: string;
  title: string;
  description: string;
  collectedAt: string;
  files: {
    ariaSnapshot?: string;
    screenshot?: string;
    htmlSource?: string;
    iframeSnapshots?: string[];
  };
  iframeCount: number;
  elementCounts: {
    buttons: number;
    links: number;
    inputs: number;
    tables: number;
    forms: number;
  };
}

interface RecordingMetadata {
  name: string;
  description: string;
  file: string;
  recordedAt: string;
}

interface ErrorRecord {
  page: string;
  error: string;
  timestamp: string;
  stack?: string;
}

// ============================================================
// 常數
// ============================================================

const TOOL_VERSION = '1.0.0';
const DEFAULT_CDP_PORT = 9222;
const DEFAULT_OUTPUT_DIR = './materials';
// 獨立包的設定檔在同一層目錄
const DEFAULT_CONFIG_PATH = path.join(process.cwd(), 'collect-materials-config.json');
const LOG_DIR = path.join(process.cwd(), 'logs');

let logFilePath: string | null = null;
const logBuffer: string[] = [];

// 台北時間
function getTaipeiTime(): string {
  return new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' });
}

function getTaipeiISO(): string {
  const now = new Date();
  const taipeiStr = now.toLocaleString('en-US', { timeZone: 'Asia/Taipei' });
  const taipeiTime = new Date(taipeiStr);
  const year = taipeiTime.getFullYear();
  const month = String(taipeiTime.getMonth() + 1).padStart(2, '0');
  const day = String(taipeiTime.getDate()).padStart(2, '0');
  const hours = String(taipeiTime.getHours()).padStart(2, '0');
  const minutes = String(taipeiTime.getMinutes()).padStart(2, '0');
  const seconds = String(taipeiTime.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}+08:00`;
}

function getTaipeiTimestampForFile(): string {
  const now = new Date();
  const taipeiStr = now.toLocaleString('en-US', { timeZone: 'Asia/Taipei' });
  const taipeiTime = new Date(taipeiStr);
  const year = taipeiTime.getFullYear();
  const month = String(taipeiTime.getMonth() + 1).padStart(2, '0');
  const day = String(taipeiTime.getDate()).padStart(2, '0');
  const hours = String(taipeiTime.getHours()).padStart(2, '0');
  const minutes = String(taipeiTime.getMinutes()).padStart(2, '0');
  const seconds = String(taipeiTime.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

// ============================================================
// 工具函數
// ============================================================

function loadDotEnv(): void {
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  content.split(/\r?\n/).forEach(line => {
    const m = line.match(/^\s*([^#=]+?)\s*=\s*(.*)\s*$/);
    if (m) {
      let key = m[1].trim();
      let val = m[2].trim();
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = val;
    }
  });
  log('ℹ️', `.env loaded (${envPath})`);
}

function writeLogLine(line: string): void {
  if (logFilePath) {
    fs.appendFileSync(logFilePath, `${line}\n`, 'utf-8');
  } else {
    logBuffer.push(line);
  }
}

function flushLogBuffer(): void {
  if (logFilePath && logBuffer.length > 0) {
    fs.appendFileSync(logFilePath, `${logBuffer.join('\n')}\n`, 'utf-8');
    logBuffer.length = 0;
  }
}

function initLogger(runId: string): void {
  ensureDirSync(LOG_DIR);
  logFilePath = path.join(LOG_DIR, `collect-materials-${runId}.log`);
  fs.writeFileSync(logFilePath, '', 'utf-8');
  flushLogBuffer();
}

function getLogFilePath(): string | null {
  return logFilePath;
}

function writeLogContext(label: string, data: unknown): void {
  writeLogLine(`[${getTaipeiISO()}][CONTEXT] ${label}`);
  try {
    writeLogLine(JSON.stringify(data, null, 2));
  } catch {
    writeLogLine(String(data));
  }
}

function formatError(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack };
  }
  return { message: String(error) };
}

function quoteCmdArg(value: string): string {
  if (value === '') return '""';
  if (!/[ \t"]/g.test(value)) return value;
  return `"${value.replace(/"/g, '\\"')}"`;
}

function buildWindowsCommand(command: string, args: string[]): string {
  return [command, ...args.map(quoteCmdArg)].join(' ');
}

function log(emoji: string, message: string, level: 'INFO' | 'WARN' | 'ERROR' = 'INFO'): void {
  const time = getTaipeiTime();
  console.log(`[${time}] ${emoji} ${message}`);
  writeLogLine(`[${getTaipeiISO()}][${level}] ${emoji} ${message}`);
}

function logError(message: string, error?: unknown): void {
  log('❌', message, 'ERROR');
  if (error) {
    const detail = formatError(error);
    if (detail.stack) {
      writeLogLine(detail.stack);
    } else {
      writeLogLine(detail.message);
    }
  }
}

function logSection(title: string): void {
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

function logSubSection(title: string): void {
  console.log(`\n  -- ${title} --\n`);
  writeLogLine(`\n  -- ${title} --\n`);
}

/** 確保目錄存在 */
function ensureDirSync(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/** 安全檔名（移除路徑穿越攻擊與特殊字元） */
function safeFileName(name: string): string {
  const cleanName = name
    .replace(/[/\\]/g, '')
    .replace(/\.\./g, '')
    .replace(/[<>:"|?*\x00-\x1f]/g, '_')
    .replace(/\s+/g, '-')
    .toLowerCase();
  const trimmed = cleanName.substring(0, 80).trim();
  if (!trimmed || trimmed.startsWith('.')) {
    return `unnamed-${Date.now()}`;
  }
  return trimmed;
}

/** 驗證 URL 安全性 */
function validateUrl(url: string): string {
  if (url === 'about:blank') return url;
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:', 'about:'].includes(parsed.protocol)) {
      throw new Error(`不允許的 protocol: ${parsed.protocol}`);
    }
    return url;
  } catch {
    throw new Error(`無效的 URL: ${url}`);
  }
}

/** 等待用戶輸入 */
function waitForInput(prompt: string): Promise<string> {
  return new Promise(resolve => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    const cleanup = () => { try { rl.close(); } catch { /* ignore */ } };
    rl.question(prompt, answer => {
      cleanup();
      resolve(answer.trim());
    });
    rl.on('error', () => {
      cleanup();
      resolve('');
    });
  });
}

/** 移除 config 中的敏感 action.text 以避免寫入日誌 — Implemented T-03 by claude-opus-4.6 on 2026-02-10 */
function redactConfigForLog(config: CollectConfig): CollectConfig {
  const clone = JSON.parse(JSON.stringify(config)) as CollectConfig;
  for (const page of clone.pages) {
    for (const action of page.actions) {
      if (action.type === 'type' && action.text) {
        action.text = '***REDACTED***';
      }
    }
  }
  return clone;
}

/** 讀取並驗證設定檔 */
function loadConfig(configPath: string): CollectConfig {
  if (!fs.existsSync(configPath)) {
    logError(`找不到設定檔: ${configPath}`);
    log('💡', '請先建立設定檔，或使用互動模式: npx tsx collect-materials.ts');
    process.exit(1);
  }

  let config: CollectConfig;
  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    config = JSON.parse(raw) as CollectConfig;
  } catch (error) {
    const detail = formatError(error);
    logError(`設定檔格式錯誤: ${detail.message}`, error);
    process.exit(1);
  }

  // 驗證必要欄位
  if (!config.projectName || typeof config.projectName !== 'string') {
    logError('設定檔缺少必要欄位: projectName');
    process.exit(1);
  }

  const defaults = {
    ariaSnapshot: true,
    screenshot: true,
    codegenRecording: true,
    htmlSource: false,
    iframeDepth: 3,
  };
  config.collectOptions = {
    ...defaults,
    ...(config.collectOptions || {}),
  };

  // 驗證 CDP 端口
  const port = Number(config.cdpPort);
  if (isNaN(port) || port < 1024 || port > 65535) {
    logError(`無效的 CDP 端口: ${config.cdpPort} (必須在 1024-65535 之間)`);
    process.exit(1);
  }
  config.cdpPort = port;

  // 限制 iframe 深度
  config.collectOptions.iframeDepth = Math.min(10, Math.max(0, Number(config.collectOptions.iframeDepth) || 3));

  config.outputDir = config.outputDir || DEFAULT_OUTPUT_DIR;
  return config;
}

/** 取得 Playwright 版本 */
function getPlaywrightVersion(): string {
  try {
    const pkgPath = path.join(process.cwd(), 'node_modules', 'playwright', 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
      return pkg.version || 'unknown';
    }
  } catch { /* ignore */ }
  return 'unknown';
}

// ============================================================
// 核心蒐集邏輯
// ============================================================

class MaterialCollector {
  private browser: Browser | null = null;
  private outputDir: string;
  private metadata: MaterialMetadata;
  private config: CollectConfig;
  private isShuttingDown = false;

  /** 請求優雅關閉，讓進行中的迴圈在下一輪迭代時停止 */
  requestShutdown(): void {
    this.isShuttingDown = true;
  }

  constructor(config: CollectConfig) {
    this.config = config;
    this.outputDir = path.resolve(config.outputDir);
    this.metadata = {
      projectName: config.projectName,
      collectedAt: getTaipeiISO(),
      timezone: 'Asia/Taipei (UTC+8)',
      toolVersion: TOOL_VERSION,
      platform: `${process.platform}-${process.arch}`,
      nodeVersion: process.version,
      playwrightVersion: getPlaywrightVersion(),
      logFile: getLogFilePath() || '',
      totalPages: config.pages.length,
      collectedPages: [],
      recordings: [],
      errors: [],
    };

    // 保留對已停用 helper 的引用，避免 TypeScript 報 unused 私有方法 (TS6133)
    if (false) {
      // @ts-ignore
      this.extractUrlsFromRecording('');
      // @ts-ignore
      this.captureSnapshotsForUrls([], '');
    }
  }

  /** 初始化輸出目錄 */
  private initOutputDirs(): void {
    ensureDirSync(this.outputDir);
    ensureDirSync(path.join(this.outputDir, 'aria-snapshots'));
    ensureDirSync(path.join(this.outputDir, 'screenshots'));
    if (this.config.collectOptions.htmlSource) {
      ensureDirSync(path.join(this.outputDir, 'html-sources'));
    }
    ensureDirSync(path.join(this.outputDir, 'recordings'));
    log('📁', `輸出目錄已建立: ${this.outputDir}`);
  }

  /** 連接到 Chrome CDP */
  async connect(): Promise<void> {
    const endpoint = `http://localhost:${this.config.cdpPort}`;
    log('🔌', `正在連接到 Chrome CDP (${endpoint})...`);

    try {
      this.browser = await chromium.connectOverCDP(endpoint);
      log('✅', '已成功連接到 Chrome');

      // 記錄所有已開啟頁面的詳細資訊（方便 debug）
      const contexts = this.browser.contexts();
      writeLogLine(`[${getTaipeiISO()}][INFO] 瀏覽器上下文數量: ${contexts.length}`);
      for (let ci = 0; ci < contexts.length; ci++) {
        const pages = contexts[ci].pages();
        writeLogLine(`[${getTaipeiISO()}][INFO] context[${ci}] 頁面數量: ${pages.length}`);
        for (let pi = 0; pi < pages.length; pi++) {
          const p = pages[pi];
          const realUrl = await this.resolvePageUrl(p);
          const isUser = this.isUserPageByUrl(realUrl);
          writeLogLine(`[${getTaipeiISO()}][INFO]   page[${pi}]: syncUrl=${p.url()} realUrl=${realUrl} isUserPage=${isUser}`);
        }
      }
    } catch (error) {
      logError('無法連接到 Chrome Debug 模式', error);
      const guidance = [
        '',
        '   請確認 Chrome 正在以 Debug 模式運行。',
        '',
      ];
      if (process.platform === 'win32') {
        guidance.push(
          '   Windows 啟動方法（PowerShell）:',
          '   請執行專案中的 launch-chrome.ps1：',
          '   .\\launch-chrome.ps1',
          '',
          '   或手動啟動：',
          '   & "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" `',
          `     --remote-debugging-port=${this.config.cdpPort} \``,
          '     --user-data-dir=".\\chrome-debug-profile"',
          ''
        );
      } else if (process.platform === 'darwin') {
        guidance.push(
          '   macOS 啟動方法（Terminal）:',
          '   請執行專案中的 scripts/launch-chrome.sh：',
          '   ./scripts/launch-chrome.sh',
          '',
          '   或手動啟動：',
          '   "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \\',
          `     --remote-debugging-port=${this.config.cdpPort} \\`,
          '     --user-data-dir="./chrome-debug-profile"',
          ''
        );
      } else {
        guidance.push(
          '   Linux 啟動方法（Terminal）:',
          '   請執行專案中的 scripts/launch-chrome.sh：',
          '   ./scripts/launch-chrome.sh',
          '',
          '   或手動啟動：',
          '   google-chrome \\',
          `     --remote-debugging-port=${this.config.cdpPort} \\`,
          '     --user-data-dir="./chrome-debug-profile"',
          ''
        );
      }
      guidance.forEach(line => {
        console.log(line);
        writeLogLine(line);
      });
      process.exit(1);
    }
  }

  /** 斷開連接（不關閉瀏覽器 — CDP 重要原則） */
  async disconnect(): Promise<void> {
    if (this.browser) {
      // 重要：使用 CDP connectOverCDP 時，NEVER 呼叫 browser.close()
      // 只斷開連接，不關閉使用者的 Chrome
      this.browser = null;
      log('🔌', '已斷開 Chrome 連接（Chrome 保持運行）');
    }
  }

  /** 取得頁面的真實 URL（解決 CDP connectOverCDP 後 page.url() 返回空字串的問題） */
  private async resolvePageUrl(page: Page): Promise<string> {
    const syncUrl = page.url();
    // 如果 page.url() 已經有值且不是空的，直接使用
    if (syncUrl && syncUrl !== '') {
      return syncUrl;
    }
    // CDP connectOverCDP 連接已存在的頁面時，page.url() 可能返回空字串
    // page.evaluate() 也可能 hang，但 CDPSession.send('Runtime.evaluate') 可以正常工作
    try {
      const context = page.context();
      const session = await context.newCDPSession(page);
      try {
        const { result } = await session.send('Runtime.evaluate', {
          expression: 'location.href',
          returnByValue: true,
        });
        return (result.value as string) || syncUrl;
      } finally {
        await session.detach().catch(() => {});
      }
    } catch {
      return syncUrl;
    }
  }

  /** 取得頁面的真實標題（解決 CDP 頁面 page.title() hang 的問題） */
  private async resolvePageTitle(page: Page): Promise<string> {
    // 先嘗試 page.title()（對正常頁面效率最高）
    try {
      const title = await Promise.race([
        page.title(),
        new Promise<string>((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000)),
      ]);
      return title;
    } catch {
      // page.title() 超時，使用 CDP session
    }
    try {
      const context = page.context();
      const session = await context.newCDPSession(page);
      try {
        const { result } = await session.send('Runtime.evaluate', {
          expression: 'document.title',
          returnByValue: true,
        });
        return (result.value as string) || '';
      } finally {
        await session.detach().catch(() => {});
      }
    } catch {
      return '';
    }
  }

  /** 判斷是否為使用者可見頁面（排除 Chrome 內部頁面） */
  private isUserPageByUrl(url: string): boolean {
    if (!url || url === '') return false;
    if (url.startsWith('chrome://')) return false;
    if (url.startsWith('chrome-extension://')) return false;
    if (url.startsWith('chrome-untrusted://')) return false;
    if (url.startsWith('devtools://')) return false;
    if (url === 'about:blank') return false;
    return true;
  }

  /** 取得當前活動頁面（優先選擇使用者可見的 http/https 頁面） */
  private async getActivePage(): Promise<Page> {
    if (!this.browser) {
      throw new Error('尚未連接到 Chrome');
    }
    const contexts = this.browser.contexts();
    if (contexts.length === 0) {
      throw new Error('沒有找到瀏覽器上下文');
    }

    // 搜尋所有 context 的所有頁面
    const allPages: Page[] = [];
    for (const ctx of contexts) {
      allPages.push(...ctx.pages());
    }

    if (allPages.length === 0) {
      throw new Error('沒有找到任何頁面');
    }

    // 解析每個頁面的真實 URL，找出使用者可見的頁面
    const pageInfos: { page: Page; url: string; isUser: boolean }[] = [];
    for (const p of allPages) {
      const url = await this.resolvePageUrl(p);
      const isUser = this.isUserPageByUrl(url);
      pageInfos.push({ page: p, url, isUser });
    }

    writeLogLine(`[${getTaipeiISO()}][INFO] getActivePage: 共 ${pageInfos.length} 個頁面`);
    pageInfos.forEach((info, i) => {
      writeLogLine(`[${getTaipeiISO()}][INFO]   page[${i}]: url=${info.url} isUserPage=${info.isUser}`);
    });

    const userPages = pageInfos.filter(info => info.isUser);

    if (userPages.length > 0) {
      const selected = userPages[userPages.length - 1];
      log('📄', `已選擇頁面: ${selected.url}`);

      // 檢查 Page 對象是否可用（CDP 預存頁面的 page.url() 為空 → 不可用）
      if (selected.page.url() === '' || selected.page.url() === 'about:blank') {
        log('🔄', `頁面需要重新附加（CDP 預存頁面），正在開啟新分頁...`);
        writeLogLine(`[${getTaipeiISO()}][INFO] 偵測到 CDP 預存頁面 (page.url()="${selected.page.url()}")，使用 newPage + goto 重新附加`);
        try {
          const context = this.browser!.contexts()[0];
          const newPage = await context.newPage();
          await newPage.goto(selected.url, { waitUntil: 'domcontentloaded', timeout: 30000 });
          log('✅', `已重新附加到: ${newPage.url()}`);
          return newPage;
        } catch (error) {
          const detail = formatError(error);
          logError(`重新附加失敗: ${detail.message}`, error);
          return selected.page;
        }
      }

      return selected.page;
    }

    // 全部都是內部頁面
    log('⚠️', `所有 ${allPages.length} 個頁面都是 Chrome 內部頁面，請先在 Chrome 中打開你的目標網站`, 'WARN');
    return allPages[allPages.length - 1];
  }

  // ── ARIA 快照蒐集 ──

  /** 擷取頁面的 ARIA 快照（含 iframe 遞迴） */
  async captureAriaSnapshot(page: Page, pageName: string, description: string): Promise<string> {
    log('📸', `擷取 ARIA 快照: ${description}`);
    const url = await this.resolvePageUrl(page);
    const title = await this.resolvePageTitle(page);

    const sections: string[] = [
      `# ARIA 快照: ${description}`,
      `# 擷取時間: ${getTaipeiISO()}`,
      `# 頁面 URL: ${url}`,
      `# 頁面標題: ${title}`,
      `# 專案: ${this.config.projectName}`,
      '',
      '## 主頁面',
    ];

    // 主頁面 ARIA 快照
    try {
      const mainSnapshot = await page.locator('body').ariaSnapshot({ timeout: 15000 });
      sections.push(mainSnapshot);
    } catch {
      log('⚠️', '  主頁面 ARIA 快照失敗，使用 HTML 結構分析替代...');
      sections.push('(主頁面 ARIA 快照失敗，使用 HTML 分析)');
      const htmlStructure = await this.extractHTMLStructure(page);
      sections.push(htmlStructure);
    }

    // iframe 遞迴蒐集
    const maxDepth = this.config.collectOptions.iframeDepth;
    const iframeSnapshots = await this.captureIframeSnapshots(page, maxDepth, 0);
    if (iframeSnapshots.length > 0) {
      sections.push('');
      sections.push('## Iframe 結構');
      sections.push(`# 共發現 ${iframeSnapshots.length} 個 iframe`);
      sections.push('');
      sections.push(...iframeSnapshots);
    }

    const content = sections.join('\n');

    // 儲存
    const fileName = `${safeFileName(pageName)}.txt`;
    const filePath = path.join(this.outputDir, 'aria-snapshots', fileName);
    fs.writeFileSync(filePath, content, 'utf-8');

    log('✅', `  已儲存: ${fileName} (${fs.statSync(filePath).size} bytes)`);
    return fileName;
  }

  /** 遞迴擷取 iframe 的 ARIA 快照 */
  private async captureIframeSnapshots(
    pageOrFrame: Page | Frame,
    maxDepth: number,
    currentDepth: number
  ): Promise<string[]> {
    if (currentDepth >= maxDepth) return [];

    const results: string[] = [];
    let frames: Frame[];

    try {
      if ('mainFrame' in pageOrFrame) {
        frames = (pageOrFrame as Page).frames();
      } else {
        frames = (pageOrFrame as Frame).childFrames();
      }
    } catch {
      return results;
    }

    for (const frame of frames) {
      if ('mainFrame' in pageOrFrame && frame === (pageOrFrame as Page).mainFrame()) continue;

      const frameUrl = frame.url();
      if (!frameUrl || frameUrl === 'about:blank' || frameUrl === 'about:srcdoc') continue;

      const frameName = frame.name() || 'unnamed';
      const indent = '  '.repeat(currentDepth);

      results.push(`${indent}## Frame: ${frameName}`);
      results.push(`${indent}URL: ${frameUrl}`);

      try {
        const frameSnapshot = await frame.locator('body').ariaSnapshot({ timeout: 8000 });
        const indentedSnapshot = frameSnapshot
          .split('\n')
          .map(line => `${indent}${line}`)
          .join('\n');
        results.push(indentedSnapshot);
      } catch {
        results.push(`${indent}(此 frame 無法擷取 ARIA 快照)`);
      }

      results.push('');

      const childResults = await this.captureIframeSnapshots(frame, maxDepth, currentDepth + 1);
      results.push(...childResults);
    }

    return results;
  }

  /** 從 HTML 提取結構（ARIA 快照失敗時的備援方案） */
  private async extractHTMLStructure(page: Page): Promise<string> {
    let html = await page.content();
    const MAX_HTML_SIZE = 5 * 1024 * 1024;
    if (html.length > MAX_HTML_SIZE) {
      log('⚠️', `  HTML 過大 (${(html.length / 1024 / 1024).toFixed(1)}MB)，僅分析前 5MB`);
      html = html.substring(0, MAX_HTML_SIZE);
    }
    const lines: string[] = [];

    for (const match of Array.from(html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gi))) {
      lines.push('- table');
      for (const row of Array.from(match[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi))) {
        const cellTexts: string[] = [];
        for (const cell of Array.from(row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi))) {
          const text = cell[1].replace(/<[^>]+>/g, '').trim().substring(0, 60);
          if (text) cellTexts.push(text);
        }
        if (cellTexts.length) {
          lines.push(`  - row: ${cellTexts.join(' | ')}`);
        }
      }
    }

    for (const match of Array.from(html.matchAll(/<button[^>]*>([\s\S]*?)<\/button>/gi))) {
      const text = match[1].replace(/<[^>]+>/g, '').trim();
      if (text) lines.push(`- button "${text}"`);
    }

    for (const match of Array.from(html.matchAll(/<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi))) {
      const text = match[2].replace(/<[^>]+>/g, '').trim().substring(0, 60);
      if (text) lines.push(`- link "${text}" [href="${match[1].substring(0, 80)}"]`);
    }

    for (const match of Array.from(html.matchAll(/<input[^>]*type="([^"]*)"[^>]*>/gi))) {
      const nameMatch = match[0].match(/name="([^"]*)"/);
      const name = nameMatch ? nameMatch[1] : '';
      lines.push(`- input [type="${match[1]}"] [name="${name}"]`);
    }

    for (const match of Array.from(html.matchAll(/<select[^>]*name="([^"]*)"[^>]*>([\s\S]*?)<\/select>/gi))) {
      const optTexts: string[] = [];
      for (const opt of Array.from(match[2].matchAll(/<option[^>]*>([\s\S]*?)<\/option>/gi))) {
        const text = opt[1].replace(/<[^>]+>/g, '').trim();
        if (text) optTexts.push(text);
      }
      lines.push(`- select [name="${match[1]}"] options: [${optTexts.join(', ')}]`);
    }

    for (const match of Array.from(html.matchAll(/<textarea[^>]*name="([^"]*)"[^>]*>/gi))) {
      lines.push(`- textarea [name="${match[1]}"]`);
    }

    return lines.join('\n') || '(無法提取 HTML 結構，頁面可能為空或使用動態渲染)';
  }

  // ── 截圖蒐集 ──

  async captureScreenshot(page: Page, pageName: string, description: string): Promise<string> {
    log('📷', `擷取截圖: ${description}`);

    const fileName = `${safeFileName(pageName)}.png`;
    const filePath = path.join(this.outputDir, 'screenshots', fileName);

    try {
      await page.screenshot({
        path: filePath,
        fullPage: true,
        type: 'png',
      });
      log('✅', `  已儲存: ${fileName} (${fs.statSync(filePath).size} bytes)`);
    } catch (error) {
      const detail = formatError(error);
      log('⚠️', '  全頁截圖失敗，改用視窗截圖...', 'WARN');
      if (detail.stack) {
        writeLogLine(detail.stack);
      }
      try {
        await page.screenshot({
          path: filePath,
          fullPage: false,
          type: 'png',
        });
        log('✅', `  已儲存（viewport）: ${fileName}`);
      } catch (innerError) {
        const innerDetail = formatError(innerError);
        logError(`  截圖失敗: ${innerDetail.message}`, innerError);
        return '';
      }
    }

    return fileName;
  }

  // ── HTML 原始碼蒐集 ──

  async captureHTML(page: Page, pageName: string, description: string): Promise<string> {
    log('📝', `擷取 HTML: ${description}`);

    const fileName = `${safeFileName(pageName)}.html`;
    const filePath = path.join(this.outputDir, 'html-sources', fileName);

    try {
      const html = await page.content();
      fs.writeFileSync(filePath, html, 'utf-8');
      log('✅', `  已儲存: ${fileName} (${fs.statSync(filePath).size} bytes)`);
    } catch (error) {
      const detail = formatError(error);
      logError(`  HTML 擷取失敗: ${detail.message}`, error);
      return '';
    }

    return fileName;
  }

  // ── 元素統計 ──

  async countElements(page: Page): Promise<PageMetadata['elementCounts']> {
    try {
      return await page.evaluate(() => {
        return {
          buttons: document.querySelectorAll('button, input[type="button"], input[type="submit"]').length,
          links: document.querySelectorAll('a[href]').length,
          inputs: document.querySelectorAll('input, textarea, select').length,
          tables: document.querySelectorAll('table').length,
          forms: document.querySelectorAll('form').length,
        };
      });
    } catch (error) {
      log('⚠️', '元素統計失敗，已使用預設值', 'WARN');
      const detail = formatError(error);
      if (detail.stack) {
        writeLogLine(detail.stack);
      }
      return { buttons: 0, links: 0, inputs: 0, tables: 0, forms: 0 };
    }
  }

  countIframes(page: Page): number {
    try {
      return page.frames().length - 1;
    } catch (error) {
      log('⚠️', 'iframe 統計失敗，已使用預設值', 'WARN');
      const detail = formatError(error);
      if (detail.stack) {
        writeLogLine(detail.stack);
      }
      return 0;
    }
  }

  // ── 頁面動作執行 ──

  async executeActions(page: Page, actions: PageAction[]): Promise<void> {
    for (const action of actions) {
      try {
        switch (action.type) {
          case 'click':
            if (action.selector) {
              log('🖱️', `  點擊: ${action.description || action.selector}`);
              await page.click(action.selector, { timeout: 10000 });
              await page.waitForTimeout(1000);
            }
            break;
          case 'type':
            if (action.selector && action.text) {
              log('⌨️', `  輸入: ${action.description || action.selector}`);
              await page.fill(action.selector, action.text);
            }
            break;
          case 'wait':
            if (action.waitMs) {
              log('⏳', `  等待 ${action.waitMs}ms`);
              await page.waitForTimeout(action.waitMs);
            }
            break;
          case 'navigate':
            if (action.url) {
              log('🔗', `  導航到: ${action.url}`);
              await page.goto(action.url, { waitUntil: 'networkidle', timeout: 30000 });
            }
            break;
        }
      } catch (error) {
        const detail = formatError(error);
        log('⚠️', `  動作失敗 (${action.type}): ${detail.message}`, 'WARN');
        if (detail.stack) {
          writeLogLine(detail.stack);
        }
      }
    }
  }

  // ── 單頁蒐集 ──

  async collectPage(page: Page, target: PageTarget): Promise<PageMetadata> {
    logSubSection(`蒐集頁面: ${target.description} (${target.name})`);

    const pageMeta: PageMetadata = {
      name: target.name,
      url: await this.resolvePageUrl(page),
      title: await this.resolvePageTitle(page),
      description: target.description,
      collectedAt: getTaipeiISO(),
      files: {},
      iframeCount: this.countIframes(page),
      elementCounts: await this.countElements(page),
    };

    // 1. ARIA 快照
    if (this.config.collectOptions.ariaSnapshot) {
      try {
        pageMeta.files.ariaSnapshot = await this.captureAriaSnapshot(
          page, target.name, target.description
        );
      } catch (error) {
        const detail = formatError(error);
        logError(`  ARIA 快照失敗: ${detail.message}`, error);
        this.metadata.errors.push({
          page: target.name,
          error: `ARIA snapshot failed: ${detail.message}`,
          timestamp: getTaipeiISO(),
          stack: detail.stack,
        });
      }
    }

    // 2. 截圖
    if (this.config.collectOptions.screenshot) {
      try {
        pageMeta.files.screenshot = await this.captureScreenshot(
          page, target.name, target.description
        );
      } catch (error) {
        const detail = formatError(error);
        logError(`  截圖失敗: ${detail.message}`, error);
        this.metadata.errors.push({
          page: target.name,
          error: `Screenshot failed: ${detail.message}`,
          timestamp: getTaipeiISO(),
          stack: detail.stack,
        });
      }
    }

    // 3. HTML 原始碼（可選）
    if (this.config.collectOptions.htmlSource) {
      try {
        pageMeta.files.htmlSource = await this.captureHTML(
          page, target.name, target.description
        );
      } catch (error) {
        const detail = formatError(error);
        logError(`  HTML 擷取失敗: ${detail.message}`, error);
        this.metadata.errors.push({
          page: target.name,
          error: `HTML capture failed: ${detail.message}`,
          timestamp: getTaipeiISO(),
          stack: detail.stack,
        });
      }
    }

    // 輸出摘要
    log('📊', `  頁面統計: ${pageMeta.iframeCount} iframe, ` +
      `${pageMeta.elementCounts.buttons} 按鈕, ` +
      `${pageMeta.elementCounts.links} 連結, ` +
      `${pageMeta.elementCounts.inputs} 輸入框, ` +
      `${pageMeta.elementCounts.tables} 表格, ` +
      `${pageMeta.elementCounts.forms} 表單`
    );

    return pageMeta;
  }

  // ── 錄製後處理 — Implemented T-01, T-02 by claude-opus-4.6 on 2026-02-10 ──

  /** 從錄製檔中提取 page.goto('url') 的 URL 列表 */
  private extractUrlsFromRecording(filePath: string): string[] {
    const content = fs.readFileSync(filePath, 'utf-8');
    const urls: string[] = [];
    const regex = /page\.goto\(['"]([^'"]+)['"]\)/g;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(content)) !== null) {
      urls.push(m[1]);
    }
    return [...new Set(urls)];
  }

  /** 為錄製檔中提取的 URL 自動擷取 ARIA 快照 */
  private async captureSnapshotsForUrls(urls: string[], flowName: string): Promise<void> {
    if (!this.browser || urls.length === 0) return;
    const ctx = this.browser.contexts()[0];
    if (!ctx) return;
    const page = await ctx.newPage();
    try {
      for (let i = 0; i < urls.length; i++) {
        try {
          await page.goto(urls[i], { waitUntil: 'domcontentloaded', timeout: 20000 });
          const snapName = `${safeFileName(flowName)}-url${i + 1}`;
          await this.captureAriaSnapshot(page, snapName, `${flowName} URL#${i + 1}: ${urls[i]}`);
        } catch (err) {
          logError(`  快照 URL 失敗: ${urls[i]}`, err);
        }
      }
    } finally {
      await page.close().catch(() => {});
    }
  }

  /** 清理錄製檔中的敏感資訊（密碼等） */
  private sanitizeRecording(filePath: string): void {
    let content = fs.readFileSync(filePath, 'utf-8');

    // 為避免誤修改註解或 block comment，採行逐行處理並保留 block comments
    const lines = content.split(/\r?\n/);
    let inBlock = false;
    const outLines: string[] = [];

    for (let rawLine of lines) {
      let line = rawLine;

      // 處理 block comment 範圍（不在此段進行替換）
      if (inBlock) {
        outLines.push(line);
        if (line.includes('*/')) inBlock = false;
        continue;
      }
      if (line.includes('/*')) {
        inBlock = true;
        outLines.push(line);
        continue;
      }

      // 若為單行註解也跳過
      if (line.trim().startsWith('//')) {
        outLines.push(line);
        continue;
      }

      // 依序進行安全的替換（從較具體到較泛的 pattern）
      // 1) 有 selector 的形式：.fill(selector, 'secret') 或 .type(selector, 'secret')
      line = line.replace(/\.fill\(\s*([^,]+?)\s*,\s*(['"])((?:\\.|[^\\])*)\2\s*\)/g, `.fill($1, process.env.RECORDING_PASSWORD)`);
      line = line.replace(/\.type\(\s*([^,]+?)\s*,\s*(['"])((?:\\.|[^\\])*)\2\s*\)/g, `.type($1, process.env.RECORDING_PASSWORD)`);

      // 2) chained getByRole 單參形式，依 name 判斷帳號/密碼
      line = line.replace(/(\.getByRole\([^)]*name\s*:\s*['"](?:密碼|password|pwd)['"][^)]*\)\s*\.\s*(?:fill|type))\(\s*(['"])(?:\\.|[^\\])*?\2\s*\)/giu, `$1(process.env.RECORDING_PASSWORD)`);
      line = line.replace(/(\.getByRole\([^)]*name\s*:\s*['"](?:帳號|account|user|username)['"][^)]*\)\s*\.\s*(?:fill|type))\(\s*(['"])(?:\\.|[^\\])*?\2\s*\)/giu, `$1(process.env.NCERT_USERNAME)`);

      // 3) locator('#password') 類型的 selector
      line = line.replace(/(\.locator\([^)]*(?:password|pwd)[^)]*\)\s*\.\s*(?:fill|type))\(\s*(['"])(?:\\.|[^\\])*?\2\s*\)/giu, `$1(process.env.RECORDING_PASSWORD)`);

      // 4) 最後降級處理：單參的 .fill('...') /.type('...') 轉為 RECORDING_PASSWORD
      line = line.replace(/\.(?:fill|type)\(\s*(['"])(?:\\.|[^\\])*?\1\s*\)/gu, `.fill(process.env.RECORDING_PASSWORD)`);

      outLines.push(line);
    }

    content = outLines.join('\n');

    const header = '// ⚠️ 此錄製檔已被敏感資訊清理，密碼欄位已替換為 process.env.RECORDING_PASSWORD\n';
    if (!content.startsWith(header)) {
      content = header + content;
    }
    fs.writeFileSync(filePath, content, 'utf-8');
    log('🔒', `  已清理錄製檔敏感資訊（使用 process.env 佔位符）: ${path.basename(filePath)}`);
  }

  // ── Codegen 錄製 ──

  async startCodegenRecording(flowName: string, startUrl: string, instructions: string): Promise<string> {
    logSubSection(`Codegen 錄製: ${flowName}`);
    log('🎬', `準備錄製互動流程: ${flowName}`);
    console.log('');
    console.log(`   📋 操作說明: ${instructions}`);
    console.log(`   🌐 起始 URL: ${startUrl}`);
    console.log('');

    const outputFile = path.join(this.outputDir, 'recordings', `${safeFileName(flowName)}.ts`);

    console.log('   錄製將會開啟一個新的瀏覽器視窗。');
    console.log('   在新視窗中操作你要錄製的流程。');
    console.log('   完成後，關閉瀏覽器視窗即可結束錄製。');
    console.log(`   錄製結果將儲存到: ${outputFile}`);
    console.log('');

    const answer = await waitForInput('   按 Enter 開始錄製（輸入 skip 跳過）: ');
    if (answer.toLowerCase() === 'skip') {
      log('⏭️', '已跳過此錄製');
      return '';
    }

    try {
      log('🎬', '正在啟動 Playwright Codegen...');

      let validatedUrl: string;
      try {
        validatedUrl = validateUrl(startUrl);
      } catch (error) {
        logError((error as Error).message, error);
        this.metadata.errors.push({
          page: `codegen:${flowName}`,
          error: `Invalid URL: ${(error as Error).message}`,
          timestamp: getTaipeiISO(),
          stack: (error as Error).stack,
        });
        return '';
      }

      const codegenArgs = [
        'playwright', 'codegen',
        '--target', 'javascript',
        '--output', outputFile,
        validatedUrl,
      ];

      const spawnOptions = { stdio: 'inherit' as const };
      let codegenProcess: ReturnType<typeof spawn>;
      if (process.platform === 'win32') {
        const cmd = process.env.ComSpec || 'cmd.exe';
        const commandLine = buildWindowsCommand('npx', codegenArgs);
        writeLogContext('codegenCommand', { command: cmd, args: ['/d', '/s', '/c', commandLine], commandLine });
        codegenProcess = spawn(cmd, ['/d', '/s', '/c', commandLine], {
          ...spawnOptions,
          windowsVerbatimArguments: true,
        });
      } else {
        writeLogContext('codegenCommand', { command: 'npx', args: codegenArgs });
        codegenProcess = spawn('npx', codegenArgs, spawnOptions);
      }

      await new Promise<void>((resolve, reject) => {
        codegenProcess.on('close', (code: number | null) => {
          if (code && code !== 0) {
            reject(new Error(`Playwright Codegen 結束碼: ${code}`));
          } else {
            resolve();
          }
        });
        codegenProcess.on('error', reject);
      });

      if (fs.existsSync(outputFile)) {
        // Implemented T-02, T-01, T-06 by claude-opus-4.6 on 2026-02-10
        this.sanitizeRecording(outputFile);
        // T-03 disabled per user directive: do not auto-parse recording for URLs; prefer pre-record ARIA capture in interactive mode
        // if (this.config.collectOptions.ariaSnapshot) {
        //   const urls = this.extractUrlsFromRecording(outputFile);
        //   if (urls.length > 0) {
        //     log('📸', `  從錄製檔提取到 ${urls.length} 個 URL，自動擷取快照...`);
        //     await this.captureSnapshotsForUrls(urls, flowName);
        //   }
        // }
        const fSize = fs.statSync(outputFile).size;
        log('✅', `錄製完成: ${outputFile} (${fSize} bytes)`);
        console.log('');
        console.log('  ┌──────────────────────────────────────────┐');
        console.log('  │  🎬 錄製完成！                            │');
        console.log(`  │  📄 ${path.basename(outputFile).padEnd(37)}│`);
        console.log(`  │  📦 ${String(fSize).padEnd(31)} bytes │`);
        console.log('  │  🔒 敏感資訊已自動清理                    │');
        console.log('  └──────────────────────────────────────────┘');
        console.log('');
        return path.basename(outputFile);
      } else {
        log('⚠️', '錄製完成但未產生檔案（可能操作中途關閉）');
        return '';
      }
    } catch (error) {
      const detail = formatError(error);
      logError(`錄製失敗: ${detail.message}`, error);
      this.metadata.errors.push({
        page: `codegen:${flowName}`,
        error: `Codegen failed: ${detail.message}`,
        timestamp: getTaipeiISO(),
        stack: detail.stack,
      });
      return '';
    }
  }

  // ── 完整蒐集流程 ──

  async collectAll(): Promise<void> {
    logSection('📦 開始自動蒐集素材');
    this.initOutputDirs();
    await this.connect();

    try {
      for (let i = 0; i < this.config.pages.length && !this.isShuttingDown; i++) {
        const target = this.config.pages[i];
        // Implemented T-04 by claude-opus-4.6 on 2026-02-10 — progress bar
        const total = this.config.pages.length;
        const filled = Math.round(((i + 1) / total) * 20);
        const bar = '█'.repeat(filled) + '░'.repeat(20 - filled);
        log('📄', `[${i + 1}/${total}] [${bar}] 處理頁面: ${target.description}`);

        const page = await this.getActivePage();

        try {
          await page.goto(target.url, {
            waitUntil: target.waitFor || 'networkidle',
            timeout: 30000,
          });
          await page.waitForTimeout(2000);
        } catch (error) {
          const detail = formatError(error);
          log('⚠️', `  導航失敗: ${detail.message}，請手動導航到目標頁面後按 Enter 繼續`, 'WARN');
          if (detail.stack) {
            writeLogLine(detail.stack);
          }
          await waitForInput('  按 Enter 繼續...');
        }

        if (target.actions && target.actions.length > 0) {
          await this.executeActions(page, target.actions);
        }

        const pageMeta = await this.collectPage(page, target);
        this.metadata.collectedPages.push(pageMeta);
      }

      if (this.config.collectOptions.codegenRecording && this.config.interactiveFlows.length > 0) {
        logSection('🎬 互動流程錄製');
        for (const flow of this.config.interactiveFlows) {
          const file = await this.startCodegenRecording(flow.name, flow.startUrl, flow.instructions);
          if (file) {
            this.metadata.recordings.push({
              name: flow.name,
              description: flow.description,
              file,
              recordedAt: getTaipeiISO(),
            });
          }
        }
      }
    } finally {
      this.saveMetadata();
      this.generateSummaryReport();
      await this.disconnect();
    }
  }

  async collectInteractive(): Promise<void> {
    logSection('🎯 互動式素材蒐集');
    console.log('這個模式會一步一步引導你蒐集素材。');
    console.log('你只需要在 Chrome 中操作，然後按 Enter 擷取。\n');

    this.initOutputDirs();
    await this.connect();

    try {
      let pageIndex = 1;
      let continueCollecting = true;
      const MAX_PAGES = 100;

      while (continueCollecting && pageIndex <= MAX_PAGES && !this.isShuttingDown) {
        console.log('');
        console.log(`  +---------------------------------------+`);
        console.log(`  |  第 ${pageIndex} 個頁面                          |`);
        console.log(`  +---------------------------------------+`);
        console.log('');

        const page = await this.getActivePage();
        const currentUrl = await this.resolvePageUrl(page);
        const currentTitle = await this.resolvePageTitle(page);

        log('📄', `當前頁面: ${currentTitle}`);
        log('🔗', `URL: ${currentUrl}`);

        const pageName = await waitForInput('\n  請輸入頁面名稱（例如: 01-login-page）: ');
        if (!pageName) {
          log('⚠️', '名稱不能為空，請重新輸入');
          continue;
        }

        const description = await waitForInput('  請輸入頁面描述（例如: 系統登入頁面）: ');

        const target: PageTarget = {
          name: pageName,
          url: currentUrl,
          description: description || pageName,
          waitFor: 'networkidle',
          actions: [],
        };

        const pageMeta = await this.collectPage(page, target);
        this.metadata.collectedPages.push(pageMeta);

        pageIndex++;

        console.log('');
        const nextAction = await waitForInput(
          '  接下來要做什麼？\n' +
          '    [Enter] 繼續蒐集下一個頁面\n' +
          '    [r]     錄製互動流程 (codegen)\n' +
          '    [q]     結束蒐集\n' +
          '  你的選擇: '
        );

        if (nextAction.toLowerCase() === 'q') {
          continueCollecting = false;
        } else if (nextAction.toLowerCase() === 'r') {
          const flowName = await waitForInput('  錄製名稱: ');
          const flowUrl = await waitForInput('  起始 URL（Enter 使用當前頁面）: ');
          const flowInstructions = await waitForInput('  操作說明: ');

          const file = await this.startCodegenRecording(
            flowName || `recording-${pageIndex}`,
            flowUrl || currentUrl,
            flowInstructions || '請在瀏覽器中操作'
          );
          if (file) {
            this.metadata.recordings.push({
              name: flowName || `recording-${pageIndex}`,
              description: flowInstructions || '',
              file,
              recordedAt: getTaipeiISO(),
            });

            // 錄製完成後立即詢問使用者接下來要做什麼（改善 UX）
            console.log('');
            const post = await waitForInput(
              '  錄製已完成並已產生錄製檔案。請確認你已關閉 Codegen 的瀏覽器視窗。\n' +
              '  接下來要做什麼？\n' +
              '    [Enter] 繼續蒐集下一個頁面\n' +
              '    [r]     重新錄製此流程\n' +
              '    [a]     擷取目前頁面 ARIA 快照\n' +
              '    [q]     結束蒐集\n' +
              '  你的選擇: '
            );

            if (post.toLowerCase() === 'q') {
              continueCollecting = false;
            } else if (post.toLowerCase() === 'r') {
              const reFile = await this.startCodegenRecording(
                flowName || `recording-${pageIndex}`,
                flowUrl || currentUrl,
                flowInstructions || '請在瀏覽器中操作'
              );
              if (reFile) {
                this.metadata.recordings.push({
                  name: flowName || `recording-${pageIndex}`,
                  description: flowInstructions || '',
                  file: reFile,
                  recordedAt: getTaipeiISO(),
                });
              }
            } else if (post.toLowerCase() === 'a') {
              try {
                const pageForAria = await this.getActivePage();
                if (this.config.collectOptions.ariaSnapshot) {
                  const snapName = `${safeFileName(flowName)}-post-aria`;
                  await this.captureAriaSnapshot(pageForAria, snapName, `Post-record ARIA: ${flowName}`);
                } else {
                  log('⚠️', 'ARIA 擷取功能未啟用於這次執行設定');
                }
              } catch (err) {
                logError('Post-record ARIA 失敗', err);
              }
            }
          }
        }
      }
    } finally {
      this.saveMetadata();
      this.generateSummaryReport();
      await this.disconnect();
    }
  }

  async collectSnapshot(): Promise<void> {
    logSection('📸 快速快照模式');
    this.initOutputDirs();
    await this.connect();

    try {
      const page = await this.getActivePage();
      const currentUrl = await this.resolvePageUrl(page);
      const currentTitle = await this.resolvePageTitle(page);

      log('📄', `當前頁面: ${currentTitle}`);
      log('🔗', `URL: ${currentUrl}`);

      const pageName = await waitForInput('\n  頁面名稱（Enter 使用自動名稱）: ');
      const autoName = `snapshot-${Date.now()}`;
      const name = pageName || autoName;
      const description = currentTitle || name;

      const target: PageTarget = {
        name,
        url: currentUrl,
        description,
        waitFor: 'networkidle',
        actions: [],
      };

      const pageMeta = await this.collectPage(page, target);
      this.metadata.collectedPages.push(pageMeta);
    } finally {
      this.saveMetadata();
      this.generateSummaryReport();
      await this.disconnect();
    }
  }

  // ── Metadata 與報告 ──

  private saveMetadata(): void {
    this.metadata.collectedAt = getTaipeiISO();
    const metaPath = path.join(this.outputDir, 'metadata.json');
    fs.writeFileSync(metaPath, JSON.stringify(this.metadata, null, 2), 'utf-8');
    log('📋', `Metadata 已儲存: ${metaPath}`);
  }

  private generateSummaryReport(): void {
    const report: string[] = [
      `# 📦 素材蒐集摘要報告`,
      ``,
      `> 專案: ${this.metadata.projectName}`,
      `> 蒐集時間: ${getTaipeiTime()}`,
      `> 工具版本: ${TOOL_VERSION}`,
      ``,
      `## 蒐集結果`,
      ``,
      `| 項目 | 數量 |`,
      `|------|------|`,
      `| 頁面 | ${this.metadata.collectedPages.length} |`,
      `| ARIA 快照 | ${this.metadata.collectedPages.filter(p => p.files.ariaSnapshot).length} |`,
      `| 截圖 | ${this.metadata.collectedPages.filter(p => p.files.screenshot).length} |`,
      `| HTML 原始碼 | ${this.metadata.collectedPages.filter(p => p.files.htmlSource).length} |`,
      `| 錄製檔 | ${this.metadata.recordings.length} |`,
      `| 錯誤 | ${this.metadata.errors.length} |`,
      ``,
      `## 頁面詳情`,
      ``,
      `| # | 頁面名稱 | 描述 | iframe | 按鈕 | 連結 | 輸入框 |`,
      `|---|---------|------|--------|------|------|--------|`,
    ];

    this.metadata.collectedPages.forEach((p, i) => {
      report.push(
        `| ${i + 1} | ${p.name} | ${p.description} | ${p.iframeCount} | ` +
        `${p.elementCounts.buttons} | ${p.elementCounts.links} | ${p.elementCounts.inputs} |`
      );
    });

    if (this.metadata.recordings.length > 0) {
      report.push('');
      report.push('## 錄製檔');
      report.push('');
      report.push('| 名稱 | 描述 | 檔案 |');
      report.push('|------|------|------|');
      this.metadata.recordings.forEach(r => {
        report.push(`| ${r.name} | ${r.description} | ${r.file} |`);
      });
    }

    if (this.metadata.errors.length > 0) {
      report.push('');
      report.push('## ⚠️ 錯誤記錄');
      report.push('');
      this.metadata.errors.forEach(e => {
        report.push(`- **${e.page}**: ${e.error} (${e.timestamp})`);
      });
    }

    report.push('');
    report.push('## 📁 檔案結構');
    report.push('');
    report.push('```');
    report.push(`${path.basename(this.outputDir)}/`);
    report.push('├── aria-snapshots/     # ARIA 快照（最重要 - AI 分析的核心素材）');
    report.push('├── screenshots/        # 截圖（視覺參考）');
    if (this.config.collectOptions.htmlSource) {
      report.push('├── html-sources/       # HTML 原始碼（可選）');
    }
    report.push('├── recordings/         # Codegen 錄製（互動流程）');
    report.push('├── metadata.json       # 蒐集記錄');
    report.push('└── summary-report.md   # 本摘要報告');
    report.push('```');

    report.push('');
    report.push('## 🧾 執行日誌');
    report.push('');
    if (this.metadata.logFile) {
      report.push(`- ${this.metadata.logFile}`);
    } else {
      report.push('- logs/collect-materials-*.log');
    }
    report.push('');
    report.push('## 🚀 下一步');
    report.push('');
    report.push('1. 將 `aria-snapshots/` 和 `recordings/` 目錄帶到有網路的環境');
    report.push('2. 將素材貼給雲端 AI（如 ChatGPT、Claude），搭配「使用指南.md」中的提示詞');
    report.push('3. AI 會根據素材生成 TypeScript 自動化腳本');
    report.push('4. 將生成的腳本帶回內網測試');

    const reportPath = path.join(this.outputDir, 'summary-report.md');
    fs.writeFileSync(reportPath, report.join('\n'), 'utf-8');
    log('📊', `摘要報告已儲存: ${reportPath}`);

    logSection('🎉 蒐集完成！');
    console.log(`   📁 素材目錄: ${this.outputDir}`);
    console.log(`   📄 蒐集頁面: ${this.metadata.collectedPages.length} 個`);
    console.log(`   🎬 錄製檔案: ${this.metadata.recordings.length} 個`);
    if (this.metadata.errors.length > 0) {
      console.log(`   ⚠️  錯誤數量: ${this.metadata.errors.length} 個`);
    }
    console.log('');
    console.log('   下一步: 帶著 materials/ 資料夾到有網路的環境，');
    console.log('   參考「使用指南.md」的提示詞讓 AI 生成程式碼！');
    console.log('');
  }
}

// ============================================================
// CLI 入口
// ============================================================

// 模組層級的 collector 參考，供 signal handler 使用
let activeCollector: MaterialCollector | null = null;

process.on('SIGINT', () => {
  if (activeCollector) {
    log('⚠️', '收到中斷信號 (Ctrl+C)，正在優雅關閉…將儲存 metadata 並斷開連線', 'WARN');
    activeCollector.requestShutdown();
  } else {
    log('⚠️', '收到中斷信號 (Ctrl+C)，正在安全退出...', 'WARN');
    process.exit(0);
  }
});
process.on('SIGTERM', () => {
  if (activeCollector) {
    log('⚠️', '收到終止信號，正在優雅關閉…將儲存 metadata 並斷開連線', 'WARN');
    activeCollector.requestShutdown();
  } else {
    log('⚠️', '收到終止信號，正在安全退出...', 'WARN');
    process.exit(0);
  }
});

async function main(): Promise<void> {
  // 入口流程：初始化日誌與環境，判斷使用者選擇的模式，再交給對應流程執行
  const args = process.argv.slice(2);
  const runId = getTaipeiTimestampForFile();
  initLogger(runId);
  // 載入 .env（若有）以供 sanitize 與其他自動化流程使用
  loadDotEnv();
  writeLogContext('environment', {
    toolVersion: TOOL_VERSION,
    nodeVersion: process.version,
    platform: `${process.platform}-${process.arch}`,
    cwd: process.cwd(),
  });
  writeLogContext('args', args);

  console.log('');
  console.log('+==============================================================+');
  console.log('|  🏗️  內部網路網頁素材離線蒐集工具 v' + TOOL_VERSION + '                      |');
  console.log('|  完全離線運作 • 不需要網際網路 • 基於 Playwright            |');
  console.log('+==============================================================+');
  console.log('');
  log('🧾', `日誌檔案: ${getLogFilePath() || 'logs/collect-materials-*.log'}`);

  const configPath = args.includes('--config')
    ? args[args.indexOf('--config') + 1]
    : DEFAULT_CONFIG_PATH;
  writeLogContext('configPath', configPath);

  const cdpPortArg = args.includes('--port')
    ? parseInt(args[args.indexOf('--port') + 1], 10)
    : undefined;

  if (args.includes('--auto')) {
    // 自動模式：完全依設定檔跑完整批次，適合固定流程
    const config = loadConfig(configPath);
    writeLogContext('mode', { mode: 'auto' });
    writeLogContext('config', redactConfigForLog(config));
    if (cdpPortArg) config.cdpPort = cdpPortArg;
    const collector = new MaterialCollector(config);
    activeCollector = collector;
    await collector.collectAll();

  } else if (args.includes('--snapshot')) {
    // 快照模式：只抓當前頁面，快速取得素材
    const config: CollectConfig = {
      projectName: 'quick-snapshot',
      description: '快速快照',
      cdpPort: cdpPortArg || DEFAULT_CDP_PORT,
      outputDir: DEFAULT_OUTPUT_DIR,
      collectOptions: {
        ariaSnapshot: true,
        screenshot: true,
        codegenRecording: false,
        htmlSource: false,
        iframeDepth: 3,
      },
      pages: [],
      interactiveFlows: [],
    };
    writeLogContext('mode', { mode: 'snapshot' });
    writeLogContext('config', redactConfigForLog(config));
    const collector = new MaterialCollector(config);
    activeCollector = collector;
    await collector.collectSnapshot();

  } else if (args.includes('--record')) {
    // 錄製模式：只啟動 codegen，方便先把互動流程錄下來
    const recordName = args[args.indexOf('--record') + 1] || 'recording';
    const startUrl = args.includes('--url')
      ? args[args.indexOf('--url') + 1]
      : 'about:blank';

    const config: CollectConfig = {
      projectName: 'codegen-recording',
      description: `錄製: ${recordName}`,
      cdpPort: cdpPortArg || DEFAULT_CDP_PORT,
      outputDir: DEFAULT_OUTPUT_DIR,
      collectOptions: {
        ariaSnapshot: false,
        screenshot: false,
        codegenRecording: true,
        htmlSource: false,
        iframeDepth: 0,
      },
      pages: [],
      interactiveFlows: [{
        name: recordName,
        description: `互動流程: ${recordName}`,
        startUrl,
        instructions: '請在瀏覽器中操作要錄製的流程',
      }],
    };
    writeLogContext('mode', { mode: 'record' });
    writeLogContext('config', redactConfigForLog(config));
    const collector = new MaterialCollector(config);
    activeCollector = collector;
    await collector.collectAll();

  } else {
    // 互動選單模式：提供給第一次使用的人，照提示一步一步操作
    console.log('  請選擇蒐集模式：\n');
    console.log('  [1] 📸 互動模式（推薦新手）- 一步一步引導你蒐集');
    console.log('  [2] 🤖 自動模式 - 依設定檔自動蒐集所有頁面');
    console.log('  [3] ⚡ 快照模式 - 快速擷取當前頁面');
    console.log('  [4] 🎬 錄製模式 - 啟動 Codegen 錄製互動流程');
    console.log('');

    const choice = await waitForInput('  請選擇 (1/2/3/4): ');

    switch (choice) {
      case '1': {
        const config: CollectConfig = {
          projectName: await waitForInput('  專案名稱: ') || 'my-project',
          description: '互動模式蒐集',
          cdpPort: cdpPortArg || DEFAULT_CDP_PORT,
          outputDir: await waitForInput(`  輸出目錄 (Enter=${DEFAULT_OUTPUT_DIR}): `) || DEFAULT_OUTPUT_DIR,
          collectOptions: {
            ariaSnapshot: true,
            screenshot: true,
            codegenRecording: true,
            htmlSource: false,
            iframeDepth: 3,
          },
          pages: [],
          interactiveFlows: [],
        };
        writeLogContext('mode', { mode: 'interactive' });
        writeLogContext('config', redactConfigForLog(config));
        const collector = new MaterialCollector(config);
        activeCollector = collector;
        await collector.collectInteractive();
        break;
      }
      case '2': {
        const config = loadConfig(configPath);
        writeLogContext('mode', { mode: 'auto' });
        writeLogContext('config', redactConfigForLog(config));
        if (cdpPortArg) config.cdpPort = cdpPortArg;
        const collector = new MaterialCollector(config);
        activeCollector = collector;
        await collector.collectAll();
        break;
      }
      case '3': {
        const config: CollectConfig = {
          projectName: 'quick-snapshot',
          description: '快速快照',
          cdpPort: cdpPortArg || DEFAULT_CDP_PORT,
          outputDir: DEFAULT_OUTPUT_DIR,
          collectOptions: {
            ariaSnapshot: true,
            screenshot: true,
            codegenRecording: false,
            htmlSource: false,
            iframeDepth: 3,
          },
          pages: [],
          interactiveFlows: [],
        };
        writeLogContext('mode', { mode: 'snapshot' });
        writeLogContext('config', redactConfigForLog(config));
        const collector = new MaterialCollector(config);
        activeCollector = collector;
        await collector.collectSnapshot();
        break;
      }
      case '4': {
        const recordName = await waitForInput('  錄製名稱: ') || 'recording';
        const startUrl = await waitForInput('  起始 URL: ') || 'about:blank';
        const config: CollectConfig = {
          projectName: 'codegen-recording',
          description: `錄製: ${recordName}`,
          cdpPort: cdpPortArg || DEFAULT_CDP_PORT,
          outputDir: DEFAULT_OUTPUT_DIR,
          collectOptions: {
            ariaSnapshot: false,
            screenshot: false,
            codegenRecording: true,
            htmlSource: false,
            iframeDepth: 0,
          },
          pages: [],
          interactiveFlows: [{
            name: recordName,
            description: `互動流程: ${recordName}`,
            startUrl,
            instructions: '請在瀏覽器中操作要錄製的流程',
          }],
        };
        writeLogContext('mode', { mode: 'record' });
        writeLogContext('config', redactConfigForLog(config));
        const collector = new MaterialCollector(config);
        activeCollector = collector;
        await collector.collectAll();
        break;
      }
      default:
        console.log('  無效的選擇，請重新執行。');
        process.exit(1);
    }
  }
}

main().catch(error => {
  // 最外層保護：任何未預期錯誤都在這裡統一提示，避免靜默失敗
  const detail = formatError(error);
  logError(`未預期的錯誤: ${detail.message}`, error);
  log('💡', '疑難排解：', 'WARN');
  log('💡', '  1. 確認 Chrome 已以 Debug 模式啟動（Windows: launch-chrome.ps1 / macOS: scripts/launch-chrome.sh）', 'WARN');
  log('💡', '  2. 確認 CDP 端口（預設 9222）沒有被佔用', 'WARN');
  log('💡', '  3. 確認已執行 npm install 安裝依賴', 'WARN');
  process.exit(1);
});
