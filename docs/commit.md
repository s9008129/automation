Commit 與 Push 指引（專案標準）

目的：此文件規範如何為本專案建立有意義且一致的 commit 訊息，並說明本次自動化作業的 commit 流程。

基本規範
- Commit 訊息語言：繁體中文（zh-TW）
- 格式：<type>(<scope>): <簡短摘要>
  - type：feat / fix / docs / chore / refactor / security
  - scope：變更的模組或檔案（如 recording, docs, core）

範例：
  feat(recording): 自動清理錄製檔密碼並建立 pre-commit 掃描

自動化 commit 流程（步驟）
1. 確認工作樹狀態：git status --porcelain
2. 把所有已修改檔案加入暫存：git add -A
3. 檢視 staged 的差異：git diff --staged --name-only
4. 使用指定訊息 commit：git commit -m "<message>" --author="Automation Bot <automation@local>"
5. 推送到遠端：git push origin HEAD

安全與審查
- 提交前請執行 TypeScript 檢查：npx tsc --noEmit
- 若 commit 被 pre-commit hook 阻止，先檢查 scripts/pre-commit-scan.ps1 提示並修正敏感資訊，或與技術人員聯繫。

附錄：若需移除本地 hook（測試用）
  git config core.hooksPath .githooks
  # 若想停用
  git config --unset core.hooksPath

// Implemented by claude-opus-4.6 on 2026-02-10
