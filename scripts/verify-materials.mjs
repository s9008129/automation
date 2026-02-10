import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
let materialsDir = path.join(process.cwd(), 'materials');
let checkAria = false;
let checkRecord = '';
let since = 0;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  if (arg === '--materials' && args[i + 1]) {
    materialsDir = args[i + 1];
    i++;
  } else if (arg === '--aria') {
    checkAria = true;
  } else if (arg === '--record' && args[i + 1]) {
    checkRecord = args[i + 1];
    i++;
  } else if (arg === '--since' && args[i + 1]) {
    since = Number(args[i + 1]);
    i++;
  }
}

let ok = true;

if (checkAria) {
  const ariaDir = path.join(materialsDir, 'aria-snapshots');
  if (!fs.existsSync(ariaDir)) {
    console.error(`❌ 找不到 ARIA 目錄: ${ariaDir}`);
    ok = false;
  } else {
    const files = fs.readdirSync(ariaDir).filter(f => f.endsWith('.txt'));
    const recent = files.filter(f => {
      const stat = fs.statSync(path.join(ariaDir, f));
      return since ? stat.mtimeMs >= since : true;
    });
    if (recent.length === 0) {
      console.error('❌ 未找到新的 ARIA 快照檔案');
      ok = false;
    } else {
      console.log(`✅ ARIA 快照數量: ${recent.length}`);
    }
  }
}

if (checkRecord) {
  const recPath = path.join(materialsDir, 'recordings', `${checkRecord}.ts`);
  if (!fs.existsSync(recPath)) {
    console.error(`❌ 找不到錄製檔案: ${recPath}`);
    ok = false;
  } else {
    const content = fs.readFileSync(recPath, 'utf-8');
    if (!content.startsWith('// ⚠️')) {
      console.error('❌ 錄製檔未包含 sanitize header');
      ok = false;
    } else {
      console.log('✅ 錄製檔已產生且已清理');
    }
  }
}

process.exit(ok ? 0 : 1);
