const fs = require('fs');
const s = fs.readFileSync('src/download-ncert-report.ts', 'utf8');
const lines = s.split(/\r?\n/);
for (let i = 0; i < lines.length; i++) {
  const matches = lines[i].match(/`/g);
  if (matches && matches.length > 0) {
    console.log(i + 1, matches.length, lines[i]);
  }
}
console.log('total backticks', (s.match(/`/g) || []).length);
