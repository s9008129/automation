import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptPath = path.join(__dirname, 'run-launch-browser.mjs');
const args = ['--browser', 'edge', ...process.argv.slice(2)];
const result = spawnSync(process.execPath, [scriptPath, ...args], { stdio: 'inherit' });
if (result.error) {
  throw result.error;
}
process.exit(result.status ?? 0);
