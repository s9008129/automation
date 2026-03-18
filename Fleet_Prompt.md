---
title: RPA-Cowork Fleet Prompt
language: zh-TW
scope: repository-local
applies_to:
  - GitHub Copilot CLI fleet mode
  - multi-file repository optimization
  - docs / framework / offline bundle alignment
last_updated: 2026-03-18
---

# Fleet Prompt

## Executive summary

這份 `Fleet_Prompt.md` 不是通用型 fleet prompt，而是專門給 **RPA-Cowork：內部網路自動化協作流程** 使用的 repo-local orchestration 準則。

它的目標只有一件事：

> **讓 AI 在不破壞離線包、Edge 協作、安全與框架一致性的前提下，協助非技術使用者建立、修正、驗證、交付可執行的內網自動化任務腳本。**

---

## 1. 永遠先記住的產品定位

RPA-Cowork 不只是素材蒐集工具，而是三段式流程：

1. **內網蒐集素材**：`install.ps1`、`launch-chrome.ps1` / `launch-edge.ps1`、`collect.ps1`
2. **與 AI 協作**：把同一次任務的 `materials\` 附件交給 AI
3. **回到專案框架執行**：`new-task.ps1` 建骨架、`run-task.ps1` 執行 `src\` 任務腳本

所有 repo-level 變更都要服務這條主線，而不是只把某個局部功能修到能動就算了。

---

## 2. Non-Negotiable

1. **AI 生成腳本必須整合本專案框架**
   - 腳本放在 `src\`
   - 由 `run-task.ps1` 執行
   - 優先重用 `src/lib/*`

2. **Edge 是主要 AI 協作情境**
   - 使用者導向的生成 / 除錯 Prompt 以 `docs/使用指南.md` 為唯一正式入口
   - 但不得破壞 repo 既有的 Chrome 標準蒐集流程與 Edge 替代入口規則

3. **Prompt 單一來源**
   - 一般使用者要貼給 AI 的 Prompt，單一來源是 `docs/使用指南.md`
   - Prompt 必須用「短提示 + 精準附件 + 固定輸出契約」製造上下文，不可預設 AI 已看過 repo，也不可要求使用者貼一大串固定規則

4. **離線包完整性不可退讓**
   - `runtime\node\`
   - `node_modules\`
   - `.playwright-browsers\`
   - `.env.example`
   - 使用者入口腳本與必要設定

5. **精準 log / context**
   - 任務腳本要有足夠上下文，讓 AI 能直接用 log 判讀問題
   - 不可只剩零散 console 訊息

6. **不要把責任丟給一般使用者**
   - 不要預設他會 `npm install` / `npx`
   - 不要把 Node 版本問題丟給他自己排查
   - 若缺件，本質上是離線包 / 框架整合問題

7. **保護 dirty tree**
   - 只 stage 本次任務相關檔案
   - 不覆蓋、不同步、也不清理使用者未說明的其他修改

---

## 3. 推薦的 fleet 工作順序

### Phase A — Context

- 先做 context map
- 找出 README、使用指南、spec、entrypoints、shared libs、template、example task
- 如果是多檔改動，再做 refactor plan

### Phase B — Plan

- 先寫 session plan
- 先定義目前狀態 / 目標狀態 / 風險 / 驗證方式
- 明確區分：一般使用者、技術準備者、專案維護者

### Phase C — Implementation

優先順序通常是：

1. shared lib / task bootstrap
2. template / example / script entrypoints
3. user-facing docs
4. spec / README / fleet prompt

### Phase D — Validation loop

每一輪都要跑：

- `npx tsc --noEmit`
- `node ./test-sanitization-validation.cjs`
- `sh ./scripts/pre-commit-scan.sh`
- `sh ./verify-credential-security.sh`
- 若改到 PowerShell，再加 `Parser::ParseFile`

### Phase E — Git handoff

- `git add` 只加本次任務相關檔案
- commit 訊息用繁體中文，說清楚 **為什麼改 / 改了什麼 / 如何驗證**
- commit 需帶 `Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>`
- 若使用者要求 push，就嘗試 push；若環境限制失敗，明確回報原因

---

## 4. Skill / agent 選擇原則

若環境有 plugin / skill：

- **`context-map`**：多檔修改前先用
- **`refactor-plan`**：需要跨文件 / 跨 codebase 重新對齊時使用
- **`what-context-needed`**：分析卡住、不確定還缺哪些檔案時使用
- **`context7-mcp`**：只有在外部函式庫 / API 參考真的需要時才用

如果 runtime **沒有** `task` / `sql` 之類 fleet orchestration 工具：

- 不要假裝有
- 改用「可用的 skill + 平行 bash / 搜尋 / 驗證」完成同樣目標
- 在 plan 與最終交付中，清楚說明是如何用現有工具達成近似 fleet orchestration

---

## 5. 文件同步矩陣

只要改到下面任一項，就必須檢查文件是否同步：

| 變更面向 | 必查文件 |
|----------|----------|
| 使用者入口 | README.md、docs/使用指南.md、docs/spec.md |
| AI 協作 Prompt | docs/使用指南.md、prompt.md、README.md |
| 任務框架 / src/lib | docs/使用指南.md、README.md、docs/spec.md |
| 離線包組成 | README.md、docs/使用指南.md、docs/spec.md |
| 驗證規則 | docs/spec.md、README.md、必要時 Fleet_Prompt.md |

---

## 6. 什麼叫「完成」

只有同時滿足以下條件，才算真正完成：

- 需求已落地，不是只有分析
- AI / 使用者 Prompt 已經與框架一致
- 沒有再維護第二份 prompt 模板
- 新腳本可以沿用 shared lib 與 run-task/new-task 主線
- 文件和 spec 同步
- 驗證命令已實跑
- git worktree 只包含預期變更

---

## 7. 一句話版指揮原則

**先做深度理解，再把 AI 生成腳本牢牢鎖回本專案框架；任何會讓一般使用者多學一套、看多一份、裝多一樣東西的設計，都先視為可疑。**

---

## 2026-03-18 定位更新摘要

本次 repo-local fleet 準則已對齊以下方向：

- 專案定位升級為 **RPA-Cowork：內部網路自動化協作流程**
- 一般使用者的生成 / 除錯 Prompt 單一來源收斂到 `docs/使用指南.md`
- `src/lib/task.ts` 成為任務 bootstrap 的共用模組
- `new-task.ps1 -> docs/使用指南.md -> run-task.ps1` 成為最低認知負荷的 AI 協作主線
