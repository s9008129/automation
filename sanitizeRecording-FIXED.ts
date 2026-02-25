/** 清理錄製檔中的敏感資訊（密碼等） */
private sanitizeRecording(filePath: string): void {
  let content = fs.readFileSync(filePath, 'utf-8');

  // 1) 先處理「兩個參數」的寫法，像是 fill(欄位, '原始密碼')
  //    這一步的目的是先抓最明確的型態，降低誤判機率
  content = content.replace(
    /\.fill\(\s*([^,]+?)\s*,\s*(['"])((?:\\.|[^\\])*)\2\s*\)/g,
    `.fill($1, process.env.RECORDING_PASSWORD)`
  );
  content = content.replace(
    /\.type\(\s*([^,]+?)\s*,\s*(['"])((?:\\.|[^\\])*)\2\s*\)/g,
    `.type($1, process.env.RECORDING_PASSWORD)`
  );

  // 2) 再處理「鏈式呼叫 + 單參數」寫法，並用欄位名稱判斷帳號/密碼
  //    例如：getByRole(... name: '密碼' ...).fill('...') → process.env.RECORDING_PASSWORD
  content = content.replace(
    /(\.getByRole\([^)]*name\s*:\s*['"](?:密碼|password|pwd)['"][^)]*\)\s*\.\s*(?:fill|type))\(\s*(['"])(?:\\.|[^\\])*?\2\s*\)/giu,
    `$1(process.env.RECORDING_PASSWORD)`
  );

  //    帳號欄位同理，改成環境變數，避免把帳號字串寫死在檔案中
  content = content.replace(
    /(\.getByRole\([^)]*name\s*:\s*['"](?:帳號|account|user|username)['"][^)]*\)\s*\.\s*(?:fill|type))\(\s*(['"])(?:\\.|[^\\])*?\2\s*\)/giu,
    `$1(process.env.RECORDING_USERNAME)`
  );

  // 3) 處理 locator('#password') 這類 selector 風格
  content = content.replace(
    /(\.locator\([^)]*(?:password|pwd)[^)]*\)\s*\.\s*(?:fill|type))\(\s*(['"])(?:\\.|[^\\])*?\2\s*\)/giu,
    `$1(process.env.RECORDING_PASSWORD)`
  );

  // 4) 最後才做保守 fallback：.fill('...') / .type('...') 一律改為密碼環境變數
  //    逐行處理是為了避免把註解文字也一起改壞
  const lines = content.split('\n');
  content = lines.map(line => {
    const trimmed = line.trim();
    // 註解行與空白行不處理，避免修改到說明文字
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || 
        trimmed.startsWith('/*') || trimmed === '') {
      return line;
    }
    // 只對真正程式碼行套用 fallback 規則
    return line.replace(
      /\.(?:fill|type)\(\s*(['"])(?:\\.|[^\\])*?\1\s*\)/gu,
      `.fill(process.env.RECORDING_PASSWORD)`
    );
  }).join('\n');

  // 在檔案最上方加上提醒，讓後續維護者一眼知道此檔已清理過
  const header = '// ⚠️ 此錄製檔已被敏感資訊清理，密碼欄位已替換為 process.env.RECORDING_PASSWORD\n';
  if (!content.startsWith(header)) {
    content = header + content;
  }
  fs.writeFileSync(filePath, content, 'utf-8');
  log('🔒', `  已清理錄製檔敏感資訊（使用 process.env 佔位符）: ${path.basename(filePath)}`);
}
