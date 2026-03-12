import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// 這支檔案是跨平台「轉接器」：
// 依作業系統自動呼叫對應的啟動腳本，避免使用者記太多指令細節。
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const args = process.argv.slice(2);

function runCommand(cmd, cmdArgs) {
  // 直接沿用父程序輸出，讓使用者能即時看到腳本訊息
  const result = spawnSync(cmd, cmdArgs, { stdio: 'inherit' });
  if (result.error) return false;
  process.exit(result.status ?? 0);
}

if (process.platform === 'win32') {
  const scriptPath = path.join(rootDir, 'launch-chrome.ps1');
  const psArgs = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath];
  const portIndex = args.indexOf('--port');
  if (portIndex >= 0 && args[portIndex + 1]) {
    psArgs.push('-Port', args[portIndex + 1]);
  }
  // 先試新版 pwsh；若環境沒有，再退回內建 powershell
  if (runCommand('pwsh', psArgs) === false) {
    runCommand('powershell', psArgs);
  }
} else {
  // macOS / Linux 走 shell 腳本
  const scriptPath = path.join(rootDir, 'scripts', 'launch-chrome.sh');
  const shArgs = [scriptPath, ...args];
  runCommand('bash', shArgs);
}
