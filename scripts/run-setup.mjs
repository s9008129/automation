import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const offline = args.includes('--offline');

function runCommand(cmd, cmdArgs) {
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
  if (runCommand('pwsh', psArgs)) return;
  runCommand('powershell', psArgs);
} else {
  const scriptPath = path.join(rootDir, 'scripts', 'setup.sh');
  const shArgs = [scriptPath];
  if (offline) shArgs.push('--offline');
  runCommand('bash', shArgs);
}
