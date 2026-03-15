import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const args = process.argv.slice(2);

function parseBrowser(argv) {
  const browserIndex = argv.indexOf('--browser');
  if (browserIndex >= 0 && argv[browserIndex + 1]) {
    return argv[browserIndex + 1].toLowerCase();
  }
  return 'chrome';
}

function runCommand(cmd, cmdArgs) {
  const result = spawnSync(cmd, cmdArgs, { stdio: 'inherit' });
  if (result.error) return false;
  process.exit(result.status ?? 0);
}

const browser = parseBrowser(args);
const forwardedArgs = args.filter((arg, index) => {
  if (arg === '--browser') return false;
  if (index > 0 && args[index - 1] === '--browser') return false;
  return true;
});

if (process.platform === 'win32') {
  const scriptName = browser === 'edge' ? 'launch-edge.ps1' : 'launch-chrome.ps1';
  const scriptPath = path.join(rootDir, scriptName);
  const psArgs = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', scriptPath];
  const portIndex = forwardedArgs.indexOf('--port');
  if (portIndex >= 0 && forwardedArgs[portIndex + 1]) {
    psArgs.push('-Port', forwardedArgs[portIndex + 1]);
  }
  if (runCommand('pwsh', psArgs) === false) {
    runCommand('powershell', psArgs);
  }
} else {
  const scriptName = browser === 'edge' ? 'launch-edge.sh' : 'launch-chrome.sh';
  const scriptPath = path.join(rootDir, 'scripts', scriptName);
  runCommand('bash', [scriptPath, ...forwardedArgs]);
}
