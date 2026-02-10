/** 清理錄製檔中的敏感資訊（密碼等） */
private sanitizeRecording(filePath: string): void {
  let content = fs.readFileSync(filePath, 'utf-8');

  // 1) 處理有 selector 的形式：.fill(selector, 'secret') 或 .type(selector, 'secret')
  content = content.replace(
    /\.fill\(\s*([^,]+?)\s*,\s*(['"])((?:\\.|[^\\])*)\2\s*\)/g,
    `.fill($1, process.env.RECORDING_PASSWORD)`
  );
  content = content.replace(
    /\.type\(\s*([^,]+?)\s*,\s*(['"])((?:\\.|[^\\])*)\2\s*\)/g,
    `.type($1, process.env.RECORDING_PASSWORD)`
  );

  // 2) 處理 chained locator 的單參形式，且根據 name 判斷帳號/密碼：
  //    getByRole(... name: '密碼' ...).fill('...') => process.env.RECORDING_PASSWORD
  content = content.replace(
    /(\.getByRole\([^)]*name\s*:\s*['"](?:密碼|password|pwd)['"][^)]*\)\s*\.\s*(?:fill|type))\(\s*(['"])(?:\\.|[^\\])*?\2\s*\)/giu,
    `$1(process.env.RECORDING_PASSWORD)`
  );

  //    getByRole(... name: '帳號' ...).fill('...') => process.env.RECORDING_USERNAME
  content = content.replace(
    /(\.getByRole\([^)]*name\s*:\s*['"](?:帳號|account|user|username)['"][^)]*\)\s*\.\s*(?:fill|type))\(\s*(['"])(?:\\.|[^\\])*?\2\s*\)/giu,
    `$1(process.env.RECORDING_USERNAME)`
  );

  // 3) 處理 locator('#password') 類型的 selector
  content = content.replace(
    /(\.locator\([^)]*(?:password|pwd)[^)]*\)\s*\.\s*(?:fill|type))\(\s*(['"])(?:\\.|[^\\])*?\2\s*\)/giu,
    `$1(process.env.RECORDING_PASSWORD)`
  );

  // 4) 最後降級處理：單參的 .fill('...')/.type('...') 轉為 RECORDING_PASSWORD
  //    Process line-by-line to avoid sanitizing comments
  const lines = content.split('\n');
  content = lines.map(line => {
    const trimmed = line.trim();
    // Skip comment lines and empty lines
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || 
        trimmed.startsWith('/*') || trimmed === '') {
      return line;
    }
    // Apply fallback pattern only to code lines
    return line.replace(
      /\.(?:fill|type)\(\s*(['"])(?:\\.|[^\\])*?\1\s*\)/gu,
      `.fill(process.env.RECORDING_PASSWORD)`
    );
  }).join('\n');

  const header = '// ⚠️ 此錄製檔已被敏感資訊清理，密碼欄位已替換為 process.env.RECORDING_PASSWORD\n';
  if (!content.startsWith(header)) {
    content = header + content;
  }
  fs.writeFileSync(filePath, content, 'utf-8');
  log('🔒', `  已清理錄製檔敏感資訊（使用 process.env 佔位符）: ${path.basename(filePath)}`);
}
