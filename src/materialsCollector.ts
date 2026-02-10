/**
 * 🏗️ 素材處理器 — Materials Collector & Processor
 *
 * 讀取 materials/ 目錄中的 ARIA 快照、錄製檔、截圖，
 * 產出結構化的處理結果至 materials/processed/<timestamp>/ 目錄。
 *
 * 執行方式：
 *   npx tsx src/materialsCollector.ts
 *   npx tsx src/materialsCollector.ts --cdp          # 同時連接 CDP 擷取即時頁面
 *   npx tsx src/materialsCollector.ts --materials-dir ./materials
 *
 * 離線運作，不依賴任何外部網路。
 */

import { chromium, type Browser, type Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

// ============================================================
// 常數
// ============================================================

const TOOL_VERSION = '1.0.0';
const DEFAULT_CDP_PORT = 9222;
const DEFAULT_MATERIALS_DIR = 'materials';
const TAIPEI_TZ = 'Asia/Taipei';

/** Chrome 內部頁面 URL scheme 前綴 — 必須過濾 */
const INTERNAL_URL_PREFIXES = [
  'chrome://',
  'chrome-extension://',
  'devtools://',
  'edge://',
  'about:blank',
  'about:srcdoc',
] as const;

// ============================================================
// 介面定義
// ============================================================

/** ARIA 快照中解析出的頁面語意元素 */
export interface AriaElement {
  role: string;
  name?: string;
  url?: string;
  text?: string;
  children?: AriaElement[];
  properties?: Record<string, string>;
}

/** 解析後的 ARIA 快照結構 */
export interface ParsedAriaSnapshot {
  /** 原始檔案名稱 */
  sourceFile: string;
  /** 快照標題 */
  title: string;
  /** 頁面 URL */
  pageUrl: string;
  /** 頁面標題 */
  pageTitle: string;
  /** 專案名稱 */
  project: string;
  /** 擷取時間 (Asia/Taipei ISO) */
  capturedAt: string;
  /** 語意元素樹 */
  elements: AriaElement[];
  /** 連結列表 */
  links: Array<{ text: string; url: string }>;
  /** 表格資料 */
  tables: Array<{ headers: string[]; rows: string[][] }>;
  /** 表單欄位 */
  formFields: Array<{ role: string; name: string; value?: string }>;
}

/** 錄製檔轉換後的結構 */
export interface ConvertedRecording {
  sourceFile: string;
  outputFile: string;
  description: string;
  convertedAt: string;
}

/** 處理結果摘要 */
export interface ProcessingResult {
  processedAt: string;
  timezone: string;
  toolVersion: string;
  platform: string;
  nodeVersion: string;
  outputDir: string;
  ariaSnapshots: ParsedAriaSnapshot[];
  recordings: ConvertedRecording[];
  screenshots: string[];
  errors: ErrorEntry[];
}

/** 結構化錯誤記錄 */
export interface ErrorEntry {
  page: string;
  error: string;
  timestamp: string;
  stack?: string;
}

/** 結構化日誌行 */
interface LogLine {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  metadata?: Record<string, unknown>;
}

/** CLI 選項 */
interface CliOptions {
  materialsDir: string;
  cdp: boolean;
  cdpPort: number;
}

// ============================================================
// 工具函式
// ============================================================

/**
 * 取得 Asia/Taipei 時區的 ISO 時間字串（含 +08:00）
 */
export function getTaipeiISO(): string {
  const now = new Date();
  const taipeiStr = now.toLocaleString('sv-SE', { timeZone: TAIPEI_TZ });
  const [datePart, timePart] = taipeiStr.split(' ');
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  return `${datePart}T${timePart}.${ms}+08:00`;
}

/**
 * 取得適用於檔名的 Asia/Taipei 時間戳記 (yyyyMMdd-HHmmss)
 */
function getTaipeiFileTimestamp(): string {
  const now = new Date();
  const taipeiStr = now.toLocaleString('sv-SE', { timeZone: TAIPEI_TZ });
  return taipeiStr.replace(/[-: ]/g, '').replace(/(\d{8})(\d{6})/, '$1-$2');
}

/**
 * 將檔案名稱清理為安全格式，防止路徑穿越攻擊。
 * 僅保留英數字、中文、連字號、底線、點。
 * @param name - 原始檔名
 * @returns 安全檔名
 */
export function safeFileName(name: string): string {
  // 移除路徑分隔符號、..、和不安全字元
  let safe = path.basename(name);
  // 移除路徑穿越
  safe = safe.replace(/\.\./g, '_');
  // 只保留安全字元：英數字、中日韓字元、連字號、底線、點
  safe = safe.replace(/[^\w\u4e00-\u9fff\u3040-\u30ff\-. ]/g, '_');
  // 移除前導/尾隨空白與點
  safe = safe.replace(/^[\s.]+|[\s.]+$/g, '');
  // 空字串保護
  if (!safe) {
    safe = 'unnamed';
  }
  return safe;
}

/**
 * 驗證 URL 是否為允許的 scheme（http / https / about）。
 * 明確拒絕 chrome://、chrome-extension://、devtools:// 等內部 scheme。
 * @param url - 待驗證的 URL
 * @returns true 若 URL 為合法 scheme
 */
export function validateUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();

  // 明確拒絕內部 scheme
  for (const prefix of INTERNAL_URL_PREFIXES) {
    if (trimmed.startsWith(prefix)) return false;
  }
  // 也拒絕 javascript: 等
  if (trimmed.startsWith('javascript:')) return false;
  if (trimmed.startsWith('data:')) return false;

  // 只允許 http / https / about
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('about:')
  ) {
    return true;
  }

  return false;
}

/**
 * 判斷頁面是否為使用者可見頁面（排除 Chrome 內部頁面）
 */
function isUserPage(page: Page): boolean {
  const url = page.url();
  for (const prefix of INTERNAL_URL_PREFIXES) {
    if (url.startsWith(prefix)) return false;
  }
  return true;
}

/**
 * 格式化錯誤為安全的字串（不洩漏機敏資訊）
 */
function formatError(error: unknown): { message: string; stack?: string } {
  if (error instanceof Error) {
    return { message: error.message, stack: error.stack };
  }
  return { message: String(error) };
}

// ============================================================
// 日誌系統
// ============================================================

class StructuredLogger {
  private logFilePath: string;
  private stream: fs.WriteStream;

  constructor(logDir: string) {
    const ts = getTaipeiFileTimestamp();
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    this.logFilePath = path.join(logDir, `materials-collector-${ts}.log`);
    this.stream = fs.createWriteStream(this.logFilePath, { flags: 'a' });
  }

  get filePath(): string {
    return this.logFilePath;
  }

  /** 寫入結構化日誌行 */
  private write(level: LogLine['level'], message: string, metadata?: Record<string, unknown>): void {
    const line: LogLine = {
      timestamp: getTaipeiISO(),
      level,
      message,
      ...(metadata ? { metadata } : {}),
    };
    const json = JSON.stringify(line);
    this.stream.write(json + '\n');
    // 同步輸出到 console（方便除錯）
    if (level === 'error') {
      console.error(`[${level.toUpperCase()}] ${message}`);
    } else {
      console.log(`[${level.toUpperCase()}] ${message}`);
    }
  }

  info(message: string, metadata?: Record<string, unknown>): void {
    this.write('info', message, metadata);
  }
  warn(message: string, metadata?: Record<string, unknown>): void {
    this.write('warn', message, metadata);
  }
  error(message: string, metadata?: Record<string, unknown>): void {
    this.write('error', message, metadata);
  }
  debug(message: string, metadata?: Record<string, unknown>): void {
    this.write('debug', message, metadata);
  }

  close(): void {
    this.stream.end();
  }
}

// ============================================================
// ARIA 快照解析器
// ============================================================

/**
 * 解析 ARIA 快照 .txt 檔案的標頭區塊
 */
function parseAriaHeader(content: string): { title: string; pageUrl: string; pageTitle: string; project: string; capturedAt: string } {
  const lines = content.split('\n');
  let title = '';
  let pageUrl = '';
  let pageTitle = '';
  let project = '';
  let capturedAt = '';

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('# ARIA 快照:')) {
      title = trimmed.replace('# ARIA 快照:', '').trim();
    } else if (trimmed.startsWith('# 擷取時間:')) {
      capturedAt = trimmed.replace('# 擷取時間:', '').trim();
    } else if (trimmed.startsWith('# 頁面 URL:')) {
      pageUrl = trimmed.replace('# 頁面 URL:', '').trim();
    } else if (trimmed.startsWith('# 頁面標題:')) {
      pageTitle = trimmed.replace('# 頁面標題:', '').trim();
    } else if (trimmed.startsWith('# 專案:')) {
      project = trimmed.replace('# 專案:', '').trim();
    }
    // 標頭結束後停止
    if (!trimmed.startsWith('#') && trimmed.length > 0) break;
  }

  return { title, pageUrl, pageTitle, project, capturedAt };
}

/**
 * 從 ARIA 快照文字中提取連結列表
 */
function extractLinks(content: string): Array<{ text: string; url: string }> {
  const links: Array<{ text: string; url: string }> = [];
  const linkRegex = /- link "([^"]*)":/g;
  const urlRegex = /- \/url:\s*(.+)/;

  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const linkMatch = linkRegex.exec(lines[i]);
    if (linkMatch) {
      const text = linkMatch[1];
      // 找下一行中的 URL
      if (i + 1 < lines.length) {
        const urlMatch = urlRegex.exec(lines[i + 1]);
        if (urlMatch) {
          let raw = urlMatch[1].trim();
          // Remove surrounding quotes if present
          if ((raw.startsWith('"') && raw.endsWith('"')) || (raw.startsWith("'") && raw.endsWith("'"))) {
            raw = raw.slice(1, -1).trim();
          }
          links.push({ text, url: raw });
        }
      }
    }
    linkRegex.lastIndex = 0; // reset global regex
  }
  return links;
}

/**
 * 從 ARIA 快照文字中提取表單欄位
 */
function extractFormFields(content: string): Array<{ role: string; name: string; value?: string }> {
  const fields: Array<{ role: string; name: string; value?: string }> = [];

  // textbox
  const textboxRegex = /- textbox(?:\s+"([^"]*)")?(?::\s*(.+))?/g;
  let match: RegExpExecArray | null;
  while ((match = textboxRegex.exec(content)) !== null) {
    const rawName = match[1] || '';
    let value: string | undefined = undefined;
    if (match[2]) {
      value = match[2].trim();
      // strip surrounding quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
    }

    const entry: { role: string; name: string; value?: string } = {
      role: 'textbox',
      name: rawName,
    };
    if (value !== undefined) entry.value = value;
    fields.push(entry);
  }

  // combobox
  const comboboxRegex = /- combobox:/g;
  while (comboboxRegex.exec(content) !== null) {
    fields.push({ role: 'combobox', name: '' });
  }

  // button
  const buttonRegex = /- button "([^"]*)"/g;
  while ((match = buttonRegex.exec(content)) !== null) {
    fields.push({ role: 'button', name: match[1] });
  }

  return fields;
}

/**
 * 從 ARIA 快照文字中提取表格標頭
 */
function extractTables(content: string): Array<{ headers: string[]; rows: string[][] }> {
  const tables: Array<{ headers: string[]; rows: string[][] }> = [];
  const headerRegex = /- columnheader "([^"]*)"/g;
  const cellRegex = /- cell "([^"]*)"/g;

  const sections = content.split('- table:');
  for (let i = 1; i < sections.length; i++) {
    const section = sections[i];
    const headers: string[] = [];
    const rows: string[][] = [];

    let hMatch: RegExpExecArray | null;
    while ((hMatch = headerRegex.exec(section)) !== null) {
      headers.push(hMatch[1]);
    }
    headerRegex.lastIndex = 0;

    // 提取 row 區塊
    const rowSections = section.split('- row "');
    for (let r = 1; r < rowSections.length; r++) {
      const cells: string[] = [];
      let cMatch: RegExpExecArray | null;
      while ((cMatch = cellRegex.exec(rowSections[r])) !== null) {
        cells.push(cMatch[1]);
      }
      cellRegex.lastIndex = 0;
      if (cells.length > 0) {
        rows.push(cells);
      }
    }

    if (headers.length > 0) {
      tables.push({ headers, rows });
    }
  }

  return tables;
}

/**
 * 從 ARIA 快照文字中提取頂層語意元素
 */
function extractTopLevelElements(content: string): AriaElement[] {
  const elements: AriaElement[] = [];
  const bodyStart = content.indexOf('## 主頁面');
  if (bodyStart === -1) return elements;

  const body = content.substring(bodyStart);
  const topLevelRegex = /^- (\w+):/gm;
  let match: RegExpExecArray | null;
  while ((match = topLevelRegex.exec(body)) !== null) {
    elements.push({ role: match[1] });
  }

  return elements;
}

/**
 * 解析單一 ARIA 快照檔案為結構化資料
 * @param filePath - .txt 檔案的完整路徑
 */
export function parseAriaSnapshot(filePath: string): ParsedAriaSnapshot {
  const content = fs.readFileSync(filePath, 'utf-8');
  const header = parseAriaHeader(content);
  const links = extractLinks(content);
  const formFields = extractFormFields(content);
  const tables = extractTables(content);
  const elements = extractTopLevelElements(content);

  return {
    sourceFile: path.basename(filePath),
    title: header.title,
    pageUrl: header.pageUrl,
    pageTitle: header.pageTitle,
    project: header.project,
    capturedAt: header.capturedAt,
    elements,
    links,
    tables,
    formFields,
  };
}

// ============================================================
// 錄製檔轉換器
// ============================================================

/**
 * 將 codegen 錄製的 CommonJS 腳本轉換為可重用的 Playwright TypeScript 模組。
 * - 移除 chromium.launch()，改為 connectOverCDP
 * - 移除 browser.close()
 * - 使用 process.env 取代硬編碼的機敏資訊
 * - 改為 ESM 匯入格式
 */
export function convertRecording(sourceContent: string, recordingName: string): string {
  let output = sourceContent;

  // 移除 require 形式的匯入
  output = output.replace(/const\s*\{[^}]*\}\s*=\s*require\(['"]playwright['"]\);?\s*/g, '');
  // 移除舊的 import 如果有的話
  output = output.replace(/import\s*\{[^}]*\}\s*from\s*['"]playwright['"];?\s*/g, '');

  // 移除 IIFE 包裝
  output = output.replace(/^\s*\(async\s*\(\)\s*=>\s*\{\s*/m, '');
  output = output.replace(/\}\)\(\)\s*;?\s*$/m, '');

  // 移除 chromium.launch
  output = output.replace(/const\s+browser\s*=\s*await\s+chromium\.launch\([^)]*\);?\s*/g, '');
  // 移除 browser.newContext / context.newPage（我們會提供自己的）
  output = output.replace(/const\s+context\s*=\s*await\s+browser\.newContext\([^)]*\);?\s*/g, '');
  output = output.replace(/const\s+page\s*=\s*await\s+context\.newPage\([^)]*\);?\s*/g, '');

  // 移除 browser.close / context.close
  output = output.replace(/await\s+context\.close\(\)\s*;?\s*/g, '');
  output = output.replace(/await\s+browser\.close\(\)\s*;?\s*/g, '');

  // 移除分隔線註解
  output = output.replace(/\/\/\s*-{5,}\s*/g, '');

  // 移除清理警告標頭（會重新加）
  output = output.replace(/\/\/\s*⚠️[^\n]*/g, '');

  // 將硬編碼密碼欄位的 .fill('...') 替換為 process.env 佔位符
  // 匹配 .fill('密碼', '任意值') 或 name: '密碼' 後接 .fill('值')
  output = output.replace(
    /(\.getByRole\(\s*['"]textbox['"]\s*,\s*\{\s*name:\s*['"]密碼['"]\s*\}\s*\)\.fill\()(['"])(?!process\.env\.)([^'"]*)\2\)/g,
    '$1process.env.RECORDING_PASSWORD ?? \'\')',
  );
  // 也處理英文 password 欄位
  output = output.replace(
    /(\.getByRole\(\s*['"]textbox['"]\s*,\s*\{\s*name:\s*['"][Pp]assword['"]\s*\}\s*\)\.fill\()(['"])(?!process\.env\.)([^'"]*)\2\)/g,
    '$1process.env.RECORDING_PASSWORD ?? \'\')',
  );
  // 處理 getByLabel 形式的密碼欄位
  output = output.replace(
    /(\.getByLabel\(\s*['"](?:密碼|[Pp]assword)['"]\s*\)\.fill\()(['"])(?!process\.env\.)([^'"]*)\2\)/g,
    '$1process.env.RECORDING_PASSWORD ?? \'\')',
  );

  // 整理空白行
  output = output.replace(/\n{3,}/g, '\n\n');
  output = output.trim();

  // 縮排整理（去掉一層）
  const lines = output.split('\n').map(line => {
    if (line.startsWith('  ')) return line.substring(2);
    return line;
  });
  output = lines.join('\n');

  const template = `/**
 * 可重用的 Playwright 自動化腳本（轉換自 codegen 錄製）
 * 錄製名稱: ${recordingName}
 * 轉換時間: ${getTaipeiISO()}
 *
 * 使用方式：
 *   import { run } from './${safeFileName(recordingName)}';
 *   await run(page);
 *
 * ⚠️ 密碼欄位已替換為 process.env 佔位符
 */

import type { Page } from 'playwright';

/**
 * 執行錄製的自動化流程
 * @param page - 已連接的 Playwright Page 實例
 */
export async function run(page: Page): Promise<void> {
${output.split('\n').map(l => '  ' + l).join('\n')}
}
`;

  return template;
}

// ============================================================
// 主要處理邏輯
// ============================================================

/**
 * 主處理函式：讀取 materials/ 目錄，產出結構化處理結果。
 * @param options - CLI 選項
 */
export async function main(options?: Partial<CliOptions>): Promise<ProcessingResult> {
  const materialsDir = path.resolve(options?.materialsDir ?? DEFAULT_MATERIALS_DIR);
  const cdp = options?.cdp ?? false;
  const cdpPort = options?.cdpPort ?? (Number(process.env.CDP_PORT) || DEFAULT_CDP_PORT);

  const logDir = path.resolve('logs');
  const logger = new StructuredLogger(logDir);

  const errors: ErrorEntry[] = [];
  const timestamp = getTaipeiFileTimestamp();
  const outputDir = path.join(materialsDir, 'processed', timestamp);

  logger.info('素材處理器啟動', {
    version: TOOL_VERSION,
    platform: process.platform + '-' + process.arch,
    nodeVersion: process.version,
    materialsDir,
    cdp,
    cdpPort,
  });

  // 建立輸出目錄
  const ariaOutputDir = path.join(outputDir, 'aria');
  const recordingsOutputDir = path.join(outputDir, 'recordings');
  const screenshotsOutputDir = path.join(outputDir, 'screenshots');

  for (const dir of [ariaOutputDir, recordingsOutputDir, screenshotsOutputDir]) {
    fs.mkdirSync(dir, { recursive: true });
  }
  logger.info('輸出目錄已建立', { outputDir });

  // ----------------------------------------------------------
  // 1. 處理 ARIA 快照
  // ----------------------------------------------------------
  const ariaDir = path.join(materialsDir, 'aria-snapshots');
  const ariaSnapshots: ParsedAriaSnapshot[] = [];

  if (fs.existsSync(ariaDir)) {
    const ariaFiles = fs.readdirSync(ariaDir).filter(f => f.endsWith('.txt'));
    logger.info(`找到 ${ariaFiles.length} 個 ARIA 快照檔案`);

    for (const file of ariaFiles) {
      try {
        const filePath = path.join(ariaDir, file);
        const parsed = parseAriaSnapshot(filePath);
        ariaSnapshots.push(parsed);
        logger.info(`已解析 ARIA 快照: ${file}`, {
          title: parsed.title,
          pageUrl: parsed.pageUrl,
          links: parsed.links.length,
          tables: parsed.tables.length,
          formFields: parsed.formFields.length,
        });
      } catch (error) {
        const detail = formatError(error);
        logger.error(`解析 ARIA 快照失敗: ${file}`, { error: detail.message, stack: detail.stack });
        errors.push({
          page: file,
          error: detail.message,
          timestamp: getTaipeiISO(),
          stack: detail.stack,
        });
      }
    }

    // 儲存解析結果
    const ariaOutputPath = path.join(ariaOutputDir, 'aria.json');
    fs.writeFileSync(ariaOutputPath, JSON.stringify(ariaSnapshots, null, 2), 'utf-8');
    logger.info(`ARIA 解析結果已儲存至 ${ariaOutputPath}`);
  } else {
    logger.warn('未找到 aria-snapshots 目錄');
  }

  // ----------------------------------------------------------
  // 2. 處理錄製檔
  // ----------------------------------------------------------
  const recordingsDir = path.join(materialsDir, 'recordings');
  const convertedRecordings: ConvertedRecording[] = [];

  if (fs.existsSync(recordingsDir)) {
    const recordingFiles = fs.readdirSync(recordingsDir).filter(f => f.endsWith('.ts') || f.endsWith('.js'));
    logger.info(`找到 ${recordingFiles.length} 個錄製檔`);

    for (const file of recordingFiles) {
      try {
        const filePath = path.join(recordingsDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const baseName = path.parse(file).name;
        const converted = convertRecording(content, baseName);

        const outputFileName = safeFileName(baseName) + '.ts';
        const outputPath = path.join(recordingsOutputDir, outputFileName);
        fs.writeFileSync(outputPath, converted, 'utf-8');

        convertedRecordings.push({
          sourceFile: file,
          outputFile: outputFileName,
          description: `轉換自 codegen 錄製: ${baseName}`,
          convertedAt: getTaipeiISO(),
        });
        logger.info(`已轉換錄製檔: ${file} → ${outputFileName}`);
      } catch (error) {
        const detail = formatError(error);
        logger.error(`轉換錄製檔失敗: ${file}`, { error: detail.message, stack: detail.stack });
        errors.push({
          page: file,
          error: detail.message,
          timestamp: getTaipeiISO(),
          stack: detail.stack,
        });
      }
    }
  } else {
    logger.warn('未找到 recordings 目錄');
  }

  // ----------------------------------------------------------
  // 3. 處理截圖
  // ----------------------------------------------------------
  const screenshotsDir = path.join(materialsDir, 'screenshots');
  const processedScreenshots: string[] = [];

  if (fs.existsSync(screenshotsDir)) {
    const screenshotFiles = fs.readdirSync(screenshotsDir).filter(f =>
      /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(f),
    );
    logger.info(`找到 ${screenshotFiles.length} 個截圖檔案`);

    for (const file of screenshotFiles) {
      try {
        const srcPath = path.join(screenshotsDir, file);
        const safeName = safeFileName(file);
        const destPath = path.join(screenshotsOutputDir, safeName);
        fs.copyFileSync(srcPath, destPath);
        processedScreenshots.push(safeName);
        logger.info(`已複製截圖: ${file} → ${safeName}`);
      } catch (error) {
        const detail = formatError(error);
        logger.error(`複製截圖失敗: ${file}`, { error: detail.message, stack: detail.stack });
        errors.push({
          page: file,
          error: detail.message,
          timestamp: getTaipeiISO(),
          stack: detail.stack,
        });
      }
    }
  } else {
    logger.warn('未找到 screenshots 目錄');
  }

  // ----------------------------------------------------------
  // 4. (可選) CDP 即時擷取
  // ----------------------------------------------------------
  if (cdp) {
    let browser: Browser | null = null;
    try {
      logger.info(`嘗試連接 CDP: http://localhost:${cdpPort}`);
      browser = await chromium.connectOverCDP(`http://localhost:${cdpPort}`);
      logger.info('CDP 連接成功');

      const contexts = browser.contexts();
      const allPages = contexts.flatMap(ctx => ctx.pages());
      const userPages = allPages.filter(isUserPage);

      logger.info(`找到 ${allPages.length} 個頁面，其中 ${userPages.length} 個為使用者頁面`);

      for (const page of userPages) {
        try {
          const pageUrl = page.url();
          if (!validateUrl(pageUrl)) {
            logger.warn(`跳過非法 URL 頁面: ${pageUrl}`);
            continue;
          }
          const pageTitle = await page.title();
          const safeName = safeFileName(pageTitle || 'untitled');

          // 擷取截圖
          const screenshotPath = path.join(screenshotsOutputDir, `cdp-${safeName}.png`);
          await page.screenshot({ path: screenshotPath, fullPage: true });
          processedScreenshots.push(`cdp-${safeName}.png`);
          logger.info(`CDP 截圖已儲存: ${safeName}`);
        } catch (error) {
          const detail = formatError(error);
          logger.error(`CDP 頁面處理失敗`, { error: detail.message, stack: detail.stack });
          errors.push({
            page: page.url(),
            error: detail.message,
            timestamp: getTaipeiISO(),
            stack: detail.stack,
          });
        }
      }
    } catch (error) {
      const detail = formatError(error);
      logger.error('CDP 連接失敗', { error: detail.message, stack: detail.stack });
      errors.push({
        page: 'CDP',
        error: detail.message,
        timestamp: getTaipeiISO(),
        stack: detail.stack,
      });
    } finally {
      // connectOverCDP: 嘗試斷開 Playwright 連線，但不關閉使用者 Chrome
      if (browser) {
        // Do not close external user Chrome; just release the reference to the Playwright Browser.
        browser = null;
      }
    }
  }

  // ----------------------------------------------------------
  // 5. 複製 metadata.json（如存在）
  // ----------------------------------------------------------
  const metadataPath = path.join(materialsDir, 'metadata.json');
  if (fs.existsSync(metadataPath)) {
    try {
      fs.copyFileSync(metadataPath, path.join(outputDir, 'metadata.json'));
      logger.info('已複製 metadata.json');
    } catch (error) {
      const detail = formatError(error);
      logger.error('複製 metadata.json 失敗', { error: detail.message, stack: detail.stack });
      errors.push({
        page: 'metadata.json',
        error: detail.message,
        timestamp: getTaipeiISO(),
        stack: detail.stack,
      });
    }
  }

  // ----------------------------------------------------------
  // 6. 產出處理結果摘要
  // ----------------------------------------------------------
  const result: ProcessingResult = {
    processedAt: getTaipeiISO(),
    timezone: `${TAIPEI_TZ} (UTC+8)`,
    toolVersion: TOOL_VERSION,
    platform: `${process.platform}-${process.arch}`,
    nodeVersion: process.version,
    outputDir,
    ariaSnapshots,
    recordings: convertedRecordings,
    screenshots: processedScreenshots,
    errors,
  };

  const resultPath = path.join(outputDir, 'processing-result.json');
  fs.writeFileSync(resultPath, JSON.stringify(result, null, 2), 'utf-8');
  logger.info('處理結果摘要已儲存', { resultPath, errorCount: errors.length });

  logger.info('素材處理完成', {
    ariaSnapshots: ariaSnapshots.length,
    recordings: convertedRecordings.length,
    screenshots: processedScreenshots.length,
    errors: errors.length,
    outputDir,
    logFile: logger.filePath,
  });

  logger.close();
  return result;
}

// ============================================================
// CLI 包裝
// ============================================================

/** 解析命令列參數 */
function parseCliArgs(argv: string[]): Partial<CliOptions> {
  const opts: Partial<CliOptions> = {};
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--materials-dir':
        opts.materialsDir = argv[++i];
        break;
      case '--cdp':
        opts.cdp = true;
        break;
      case '--cdp-port': {
        const port = Number(argv[++i]);
        if (Number.isFinite(port) && port > 0) {
          opts.cdpPort = port;
        }
        break;
      }
    }
  }
  return opts;
}

/** CLI 入口點 */
export async function cli(): Promise<void> {
  const opts = parseCliArgs(process.argv.slice(2));
  try {
    const result = await main(opts);

    console.log('\n✅ 素材處理完成');
    console.log(`   ARIA 快照: ${result.ariaSnapshots.length}`);
    console.log(`   錄製檔:    ${result.recordings.length}`);
    console.log(`   截圖:      ${result.screenshots.length}`);
    console.log(`   錯誤:      ${result.errors.length}`);
    console.log(`   輸出目錄:  ${result.outputDir}`);

    if (result.errors.length > 0) {
      process.exitCode = 1;
    }
  } catch (error) {
    console.error('❌ 素材處理失敗:', error);
    process.exitCode = 1;
  }
}

// 直接執行時作為 CLI
const isMain = process.argv[1] && (
  process.argv[1].endsWith('materialsCollector.ts') ||
  process.argv[1].endsWith('materialsCollector.js')
);
if (isMain) {
  cli();
}
