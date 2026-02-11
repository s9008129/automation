const fs = require('fs');
const s = fs.readFileSync('src/download-ncert-report.ts', 'utf8');
const lines = s.split(/\r?\n/);
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  for (let j = 0; j < line.length; j++) {
    const code = line.charCodeAt(j);
    if (code === 96) {
      const before = line.slice(Math.max(0, j-10), j);
      const after = line.slice(j+1, j+11);
      console.log(`line ${i+1} col ${j+1} code ${code} context "${before}[\`]${after}"`);
    }
  }
}
console.log('done');
