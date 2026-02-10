import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const args = process.argv.slice(2);

function runCommand(cmd, cmdArgs) {
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
  if (runCommand('pwsh', psArgs)) return;
  runCommand('powershell', psArgs);
} else {
  const scriptPath = path.join(rootDir, 'scripts', 'launch-chrome.sh');
  const shArgs = [scriptPath, ...args];
  runCommand('bash', shArgs);
}
