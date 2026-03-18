# 📚 分析文檔索引

## 📄 生成的文檔

本專案已生成 **3 份詳細分析文檔**，幫助你快速掌握「生成腳本」、「提示工程」、「除錯」與「AI 協作」的所有細節。

### 1️⃣ **QUICK_REFERENCE.md** ⭐ 首先看這個
**文件大小**：13 KB | **行數**：380 行
**適合**：快速查找、實際操作、常見問題解答

**包含內容**：
- ✅ 3 步核心流程（Chrome / Edge）
- ✅ AI 協作的 2 個完整 Prompt 樣板（生成 + 除錯）
- ✅ 最常犯的 5 個錯誤 + 解決方法
- ✅ 蒐集完成後的輸出結構
- ✅ 安全清單（上傳前檢查）
- ✅ 10 個常見 Q&A
- ✅ 工作流程示意圖
- ✅ 檔案位置速查表

**何時使用**：
- 準備第一次蒐集時
- 要準備 Prompt 給 AI 時
- 遇到問題需要快速查找時

---

### 2️⃣ **COMPREHENSIVE_ANALYSIS.md** 📖 深入了解
**文件大小**：51 KB | **行數**：1377 行
**適合**：完整理解、技術細節、架構設計

**包含內容**：

#### 📄 第一部分：docs/使用指南.md 完整拆解
- ✅ 8 大章節完整內容（含行號）
- ✅ 為何選 Playwright 的詳細說明
- ✅ 3 步 SOP 說明
- ✅ 開始前必看的 4 件事
- ✅ 蒐集完成後的結果結構
- ✅ **生成腳本範本 — 空白版**（L418-455）
- ✅ **生成腳本範本 — 已填好範例**（L457-492）
- ✅ **除錯範本 — 空白版**（L494-537）
- ✅ **除錯範本 — 已填好範例**（L539-580）
- ✅ 安全提醒與最常見的 3 個問題

#### 📄 第二部分：docs/使用指南-Edge.md 完整拆解
- ✅ 與 Chrome 版的完整對應說明
- ✅ Edge 特有的 4 件事
- ✅ **Edge 版生成腳本範本 — 空白版**（L379-416）
- ✅ **Edge 版生成腳本範本 — 已填好範例**（L418-452）
- ✅ **Edge 版除錯範本 — 空白版**（L455-498）
- ✅ **Edge 版除錯範本 — 已填好範例**（L500-539）
- ✅ Edge 特有的安全提醒

#### 📄 第三部分：docs/spec.md 技術規格（關鍵部分）
- ✅ 專案定位與用白話說（L32-48）
- ✅ 核心 4 大功能（L50-57）
- ✅ 技術棧說明（L59-66）
- ✅ **ARIA-first 工作流設計決策**（L105-131）— 為何禁用「錄製後自動補抓」
- ✅ **錄製檔 Sanitize 原則**（L133-153）— 敏感資訊清理機制
- ✅ **.env 使用指引**（L155-190）— 環境變數的正確用法
- ✅ 核心 46 個功能需求（FR-001 到 FR-050）
- ✅ Pre-commit Hook 掃描機制（L296-311）
- ✅ 5 個完整 User Story + 驗收情境
- ✅ 10 個成功標準
- ✅ 第一性原理分析

#### 📄 第四部分：其他文件
- ✅ README.md 關鍵內容
- ✅ collect-materials.ts 主程式結構與入口點
- ✅ package.json 完整內容
- ✅ tsconfig.json 完整內容
- ✅ collect-materials-config.json 完整內容

#### 📄 第五部分：核心設計原則
- ✅ ARIA-First 工作流圖示
- ✅ 離線套件組成結構
- ✅ Prompt 工程核心原則
- ✅ 敏感資訊保護機制
- ✅ 對一般使用者的 3 點建議
- ✅ 對技術人員的 4 點建議
- ✅ 關鍵術語對照表

**何時使用**：
- 想深入理解工具的設計理念時
- 遇到 Prompt 工程的複雜問題時
- 需要完整的功能規格參考時
- 想了解 ARIA-first 工作流為何這樣設計時

---

### 3️⃣ **ANALYSIS_INDEX.md** 🗂️ 你現在在看這個
**文件大小**：當前文檔
**用途**：索引和導引

---

## 🎯 根據你的需求快速定位

### 場景 1：「我是第一次用，不知道怎麼開始」
👉 **看這個**：
1. QUICK_REFERENCE.md § 核心流程（3 步）
2. QUICK_REFERENCE.md § 蒐集完成後的輸出結構
3. QUICK_REFERENCE.md § 常見 Q&A § Q1-Q3

### 場景 2：「我要請 AI 幫我生成腳本」
👉 **看這個**：
1. QUICK_REFERENCE.md § 要請 AI 幫忙時的步驟
2. QUICK_REFERENCE.md § 第二步：打開 Prompt 樣板 § 🎯 生成腳本
3. QUICK_REFERENCE.md § 最常犯的 5 個錯誤

進階參考：
- COMPREHENSIVE_ANALYSIS.md § 第一部分 § 第 6 章 § 生成腳本範本

### 場景 3：「我的腳本執行失敗，需要 AI 除錯」
👉 **看這個**：
1. QUICK_REFERENCE.md § 要請 AI 幫忙時的步驟 § 第一步：準備附件 § 除錯既有腳本時再加上
2. QUICK_REFERENCE.md § 第二步：打開 Prompt 樣板 § 🐛 除錯既有腳本
3. QUICK_REFERENCE.md § 最常犯的 5 個錯誤

進階參考：
- COMPREHENSIVE_ANALYSIS.md § 第一部分 § 第 6 章 § 除錯範本

### 場景 4：「我想用 Edge 而不是 Chrome」
👉 **看這個**：
1. QUICK_REFERENCE.md § 常見 Q&A § Q3
2. COMPREHENSIVE_ANALYSIS.md § 第二部分（完整 Edge 使用指南）

### 場景 5：「我想了解工具的設計原理」
👉 **看這個**：
1. COMPREHENSIVE_ANALYSIS.md § 第三部分 § ARIA-first 工作流設計決策
2. COMPREHENSIVE_ANALYSIS.md § 第三部分 § 錄製檔 Sanitize 原則
3. COMPREHENSIVE_ANALYSIS.md § 第五部分 § 核心設計原則

### 場景 6：「我是技術人員，要準備離線包」
👉 **看這個**：
1. COMPREHENSIVE_ANALYSIS.md § 第四部分 § README.md 關鍵內容
2. COMPREHENSIVE_ANALYSIS.md § 第五部分 § 離線套件組成結構
3. COMPREHENSIVE_ANALYSIS.md § 第五部分 § 對技術人員的 4 點建議

### 場景 7：「我想檢查安全性」
👉 **看這個**：
1. QUICK_REFERENCE.md § 🔐 安全清單
2. COMPREHENSIVE_ANALYSIS.md § 第三部分 § 錄製檔 Sanitize 原則
3. COMPREHENSIVE_ANALYSIS.md § 第三部分 § .env 使用指引

---

## 📊 文檔內容對應表

### Prompt 樣板位置

| 用途 | QUICK_REFERENCE | COMPREHENSIVE_ANALYSIS |
|------|---------|---------|
| 生成腳本 — 空白版 | § 3.1 | § I § L418-455 |
| 生成腳本 — 範例 | § 3.1 | § I § L457-492 |
| 除錯腳本 — 空白版 | § 3.1 | § I § L494-537 |
| 除錯腳本 — 範例 | § 3.1 | § I § L539-580 |
| **Edge 版** 生成 — 空白 | N/A | § II § L379-416 |
| **Edge 版** 生成 — 範例 | N/A | § II § L418-452 |
| **Edge 版** 除錯 — 空白 | N/A | § II § L455-498 |
| **Edge 版** 除錯 — 範例 | N/A | § II § L500-539 |

### 設定與檔案結構

| 主題 | QUICK_REFERENCE | COMPREHENSIVE_ANALYSIS |
|------|---------|---------|
| 核心 3 步流程 | § 核心流程 | § VI § main() |
| 輸出結構 | § 📂 蒐集完成後 | § I § 第 5 章 |
| package.json | N/A | § VI |
| tsconfig.json | N/A | § VII |
| collect-materials-config.json | N/A | § VIII |
| Chrome 特定設定 | § Q3 之外的內容 | § I 全篇 |
| Edge 特定設定 | § Q3 | § II 全篇 |

### 安全與最佳實踐

| 主題 | QUICK_REFERENCE | COMPREHENSIVE_ANALYSIS |
|------|---------|---------|
| 安全清單 | § 🔐 安全清單 | § I § 第 6 章 § 安全提醒 |
| 敏感資訊保護 | § Q8 | § III § 2.4 § L133-153 |
| .env 使用 | N/A | § III § 2.5 § L155-190 |
| Pre-commit Hook | N/A | § III § 4.2 § L296-311 |
| 最常犯錯誤 | § 最常犯的 5 個錯誤 | § I § 第 6 章 § 先看一眼 |

### 故障排查

| 問題 | QUICK_REFERENCE | COMPREHENSIVE_ANALYSIS |
|------|---------|---------|
| 常見 Q&A | § 常見 Q&A (10 題) | § I § 第 7 章 |
| 除錯流程 | § 常見 Q&A § Q4-Q5 | § 第 7 章 § 最常見的 3 個問題 |
| 系統要求 | N/A | § III § 1.4 + § VI |

---

## 🔑 關鍵概念速查

### 我找不到「____」的說明

| 概念 | 查詢位置 |
|------|---------|
| ARIA 快照是什麼 | COMPREHENSIVE_ANALYSIS § I § 第 1 章 / § III § 1.2 |
| 為何選 Playwright | COMPREHENSIVE_ANALYSIS § I § 第 1 章 |
| ARIA-first 工作流 | COMPREHENSIVE_ANALYSIS § III § 2.3 § L105-131 |
| CDP 是什麼 | COMPREHENSIVE_ANALYSIS § III § 1.3 + § 2.2 |
| Sanitize 機制 | COMPREHENSIVE_ANALYSIS § III § 2.4 § L133-153 |
| 互動模式 vs 自動模式 | COMPREHENSIVE_ANALYSIS § III § 2.6 § L192-197 |
| 時間戳格式 | COMPREHENSIVE_ANALYSIS § III § 3.1-3.2 § L245-256 |
| metadata.json 包含什麼 | COMPREHENSIVE_ANALYSIS § III § 3.4 § L279-282 |
| 錄製檔為何要清理 | COMPREHENSIVE_ANALYSIS § III § 2.4 |
| 為何不自動補抓 URL | COMPREHENSIVE_ANALYSIS § III § 2.3 § L107-115 |

---

## 📞 還是找不到？

### 搜尋技巧

**在 QUICK_REFERENCE.md 中搜尋**（最快）：
```
Ctrl+F "keyword"
常用關鍵字：Q&A, 錯誤, Edge, 密碼, 安全, log, 3 步
```

**在 COMPREHENSIVE_ANALYSIS.md 中搜尋**（最完整）：
```
Ctrl+F "keyword"
常用關鍵字：ARIA, CDP, sanitize, metadata, User Story, 行號 (L數字)
```

### 如果兩份文檔都沒有説明

這些情況超出本分析範圍，需要查閱原始文件：
- **源代碼實現細節** → 查看 collect-materials.ts
- **PowerShell 腳本邏輯** → 查看 scripts/ 下的 .ps1 文件
- **Playwright API 使用** → 查看 Playwright 官方文檔
- **Node.js 版本相容性問題** → 查看 package.json 與 Node.js 官方文檔

---

## 📝 使用建議

1. **第一次使用**：先讀 QUICK_REFERENCE.md 的「核心流程」和「常見 Q&A」
2. **準備 Prompt**：複製 QUICK_REFERENCE.md 的 Prompt 樣板，只改 3 個地方
3. **遇到問題**：先看 QUICK_REFERENCE.md 的「常見 Q&A」，再看「最常犯的 5 個錯誤」
4. **深入理解**：讀 COMPREHENSIVE_ANALYSIS.md 的相應章節
5. **備份這些文檔**：印出或保存到雲端，方便日後查閱

---

## 📅 文檔版本

- **生成日期**：2025 年 3 月 18 日
- **基於版本**：spec.md v1.5.0（2026-03-15 規格）
- **涵蓋檔案**：
  - docs/使用指南.md (621 行)
  - docs/使用指南-Edge.md (581 行)
  - docs/spec.md (685 行)
  - README.md (224 行)
  - collect-materials.ts (2531 行摘要)
  - package.json
  - tsconfig.json
  - collect-materials-config.json

---

**祝你使用愉快！如有任何問題，請參考上方索引。** 🚀
