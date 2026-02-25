import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// 這支檔案是 setup 的跨平台入口：
// 使用者只要跑這一個指令，就能自動轉呼叫對應 OS 的安裝腳本。
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const offline = args.includes('--offline');

function runCommand(cmd, cmdArgs) {
  // 讓子程序輸出直接顯示在終端機，方便排除安裝問題
  const result = spawnSync(cmd, cmdArgs, { stdio: 'inherit' });
  if (result.error) return false;
  process.exit(result.status ?? 0);
}

if (process.platform === 'win32') {
  const scriptPath = path.join(rootDir, 'setup.ps1');
  const psArgs = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath];
  if (offline) {
    psArgs.push('-Offline');
  }
  // 先試 pwsh（PowerShell 7+）；如果沒有會繼續嘗試舊版 powershell
  runCommand('pwsh', psArgs);
  runCommand('powershell', psArgs);
} else {
  // macOS / Linux 交給 setup.sh
  const scriptPath = path.join(rootDir, 'scripts', 'setup.sh');
  const shArgs = [scriptPath];
  if (offline) shArgs.push('--offline');
  runCommand('bash', shArgs);
}
