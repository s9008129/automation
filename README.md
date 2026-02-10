# 🏗️ 內部網路網頁素材離線蒐集工具

[![Node.js](https://img.shields.io/badge/Node.js-v20%2B-green)](https://nodejs.org/)
[![Playwright](https://img.shields.io/badge/Playwright-1.52-blue)](https://playwright.dev/)
[![Platform](https://img.shields.io/badge/Platform-Windows%2011-lightgrey)](https://www.microsoft.com/windows)
[![License](https://img.shields.io/badge/License-Private-red)]()

> 完全離線運作的網頁素材蒐集工具。在無外部網路的內部網路環境中，透過 Chrome Debug 模式蒐集 ARIA 快照、截圖、Codegen 錄製，供外部 AI 分析生成自動化腳本。

## 📋 目錄

- [快速開始](#-快速開始)
- [使用場景](#-使用場景)
- [功能特色](#-功能特色)
- [專案結構](#-專案結構)
- [操作指南](#-操作指南)
- [常見問題](#-常見問題)

## 🚀 快速開始

### 前置需求

- Windows 11 + PowerShell 7.x（主要目標環境）
- macOS / Linux（相容）
- Node.js v20+
- Google Chrome

### 安裝

```powershell
# 1. 一鍵安裝所有依賴（跨平台）
npm run setup
```

```powershell
# Windows（PowerShell）
.\setup.ps1
```

```bash
# macOS / Linux
./scripts/setup.sh
```

> 離線環境請使用 `npm run setup:offline`，並預先準備 `node_modules/` 與 Playwright 瀏覽器（建議放在 `.playwright-browsers/` 並設定 `PLAYWRIGHT_BROWSERS_PATH`）。

### 使用

```powershell
# 2. 啟動 Chrome Debug 模式（獨立 profile，不影響日常使用）
npm run start:chrome
```

```powershell
# Windows（PowerShell）
.\launch-chrome.ps1
```

```bash
# macOS / Linux
./scripts/launch-chrome.sh

# 3. 在 Chrome 中登入你的內部網站

# 4. 開啟另一個 PowerShell 視窗，開始蒐集
npm run collect
```

## 🌐 使用場景

```
內部網路（無 AI）                         外部環境（有 AI）
┌──────────────────────┐              ┌──────────────────────┐
│ 1. .\launch-chrome.ps1│              │ 5. 把素材丟給 AI       │
│ 2. 登入內部網站        │  ──帶出──▶  │ 6. AI 生成自動化腳本    │
│ 3. npm run collect    │              │ 7. 帶回內網測試        │
│ 4. 帶走 materials/    │  ◀──帶入──  │                       │
└──────────────────────┘              └──────────────────────┘
```

## ✨ 功能特色

| 功能 | 說明 |
|------|------|
| 📸 ARIA 快照 | 擷取頁面語意結構（AI 分析的核心素材） |
| 📷 截圖 | 全頁截圖 + 自動降級為視窗截圖 |
| 🎬 Codegen 錄製 | 錄製使用者互動流程，生成 TypeScript 腳本 |
| 🔐 錄製檔密碼清理 | 自動偵測並替換錄製檔中的明文密碼為環境變數 |
| 📸 錄製後自動快照 | 錄製結束後自動解析 URL 並擷取各頁面 ARIA 快照 |
| 📄 HTML 原始碼 | 擷取頁面 HTML（可選） |
| 🔄 iframe 遞迴 | 自動深入多層 iframe 擷取結構 |
| 📊 摘要報告 | 自動產生 summary-report.md |
| 🧾 結構化日誌 | 日誌可直接交給 AI 診斷問題 |

## 📁 專案結構

```
automation/
├── .github/
│   └── copilot-instructions.md   # AI 開發準則
├── .githooks/
│   └── pre-commit                # 敏感資訊掃描 hook
├── scripts/
│   ├── pre-commit-scan.ps1       # 掃描錄製檔敏感模式（PowerShell）
│   ├── pre-commit-scan.sh        # 掃描錄製檔敏感模式（bash）
│   ├── launch-chrome.sh          # macOS/Linux Chrome Debug 啟動
│   ├── setup.sh                  # macOS/Linux 安裝腳本
│   └── acceptance-macos.sh       # macOS 驗收腳本（含離線 mock）
├── docs/
│   ├── spec.md                   # 功能規格（SDD）
│   └── 使用指南.md                # 完整使用教學
├── logs/                         # 執行日誌（自動產生）
├── materials/                    # 蒐集的素材（自動產生）
│   ├── aria-snapshots/           # ARIA 快照
│   ├── screenshots/              # 截圖
│   ├── recordings/               # Codegen 錄製
│   ├── metadata.json             # 蒐集記錄
│   └── summary-report.md         # 摘要報告
├── collect-materials.ts          # 核心蒐集引擎
├── collect-materials-config.json # 自動模式設定檔
├── launch-chrome.ps1             # Chrome Debug 啟動腳本
├── setup.ps1                     # 一鍵安裝腳本
├── package.json                  # 專案設定
└── tsconfig.json                 # TypeScript 設定
```

## 📖 操作指南

### 蒐集模式

| 命令 | 說明 |
|------|------|
| `npm run collect` | 互動模式（推薦新手）|
| `npm run collect:auto` | 自動模式（依設定檔）|
| `npm run collect:snapshot` | 快照模式（擷取當前頁面）|
| `npm run collect:record` | 錄製模式（啟動 Codegen）|

### 詳細使用教學

請參閱 [📖 使用指南](docs/使用指南.md)

## ❓ 常見問題

| 問題 | 解決方式 |
|------|---------|
| Chrome Debug 模式未啟動 | 執行 `.\launch-chrome.ps1` |
| 端口 9222 被佔用 | 關閉所有 Chrome 後重新執行腳本 |
| 找不到頁面（選到 chrome:// 內部頁面） | 已自動過濾，確保 Chrome 中有開啟目標網站 |
| Codegen spawn EINVAL | 已修復（Windows 使用 cmd.exe 包裝） |
| 全頁截圖失敗 | 自動降級為視窗截圖 |

---

## 🔒 安全防護（Pre-commit Hook）

<!-- Implemented T-04, T-05 by claude-opus-4.6 on 2026-02-10 -->

錄製檔可能包含密碼等敏感資訊。本專案提供**雙重防護**：

### 1. 錄製檔自動清理（`sanitizeRecording`）

錄製結束後，工具會自動掃描 `.fill()` 呼叫中的密碼欄位，將明文密碼替換為環境變數 `process.env.RECORDING_PASSWORD`。

如需設定替換值，請在執行前設定環境變數：

```powershell
# PowerShell（當次有效）
$env:RECORDING_PASSWORD = "your-password"

# 或建立 .env 檔案（已被 .gitignore 排除）
# RECORDING_PASSWORD=your-password
```

### 2. Pre-commit Hook 掃描

```powershell
# 啟用 git hook（一次性設定）
git config core.hooksPath .githooks
```

Hook 會在 commit 前掃描 `materials/recordings/*.ts`，若偵測到疑似密碼（`.fill(selector, 'password')`）、token 或 secret，將阻止 commit 並提示修正。

> 💡 **建議**：先執行 `git config core.hooksPath .githooks` 啟用防護，再開始使用工具。

---

## 📝 授權

本專案為私人專案，僅供內部使用。

## 📞 技術支援

遇到問題時：
1. 查看 `logs/` 目錄下的日誌檔案
2. 將日誌檔案交給 AI 分析（日誌包含完整的環境、參數、錯誤堆疊資訊）
3. 參閱 [使用指南 - 問題排除](docs/使用指南.md)
