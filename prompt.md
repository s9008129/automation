請使用子代理 (subagents)，透過 claude-opus-4.6
  (high)，它一個最上階的總指揮官，負責使用第一性原理及COT深度分析理解我的需求 痛點 情境 問題後，並且負責進行任務規畫及
  大任務的切割與子任務的再分派(透過worktree方式)，MUST依照適當的情況及任務複雜度再次使用子代理
  (subagents)，呼叫自己claude-opus-4.6
  (high)當做下一階的子代理，並且依照子任務的相依性適當地做出併行處理，這些處理子任務的下層子代理，完成自己的任務後，必
  須向最上階的總指揮官回報，再由總指揮官彙整最終的結果，提升整個工作效率來完成以下任務:
  1.先取得前5次的commit紀錄，深度理解，我之前有給你網頁素材並要求你實作一個網頁自動化TS腳本，但你卻給我一個
  @src\materialsCollector.ts
  ，這顯然不符合我的需求目標，我現在要再次釐清[MUST深度分析我給你的以下素材，實作一個網頁自動化TS腳本]:
  @materials\ 資料夾下所有檔案，MUST使用這兩個提示詞: @docs\System_Prompt.md  @docs\user_prompt.md
  2.完成後，MUST再另外使用一個子代理 (subagents)，透過gpt-5.2-codex
  (xhigh)深度且詳細完整的分析這個網頁自動化TS腳本，並找出程式邏輯錯誤 盲點 疏漏 衝突 等缺失並提出優化及改善建議報告
  3.接著，MUST再另外使用一個子代理 (subagents)，透過 claude-opus-4.6
    (high)依據改善建議報告實作全面性的改善措施
  4.接著，MUST再另外使用一個子代理 (subagents)，透過 claude-opus-4.6
      (high)去驗證及測試這個最終完成的網頁自動化TS腳本，驗收標準是[可以成功執行自動化作業，且沒有任何錯誤與異常]，在整
  個測試過程中，MUST透過gpt-5.2-codex (xhigh)，當作一個獨立的監督者與稽核者，MUST全程監督整個測試流程是否有精準確實符
  合驗收條件，若有發現任何缺失應立即出面提供改善建議並要求這個測試專用的子代理 (subagents)， claude-opus-4.6
      (high)立即實施矯正，以此類推，直到所有任務都完成為止
  5.接著，請由子代理 (subagents)，claude-opus-4.6
  (high)，深度梳理上下文後，寫一個詳細的[docs\commit.md]，輸出語言請使用正體中文 (zh-TW)。
  6.最後，由你執行add,commit(依照docs/commit.md),push with detailed zh-tw log
