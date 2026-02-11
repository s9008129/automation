const fs = require('fs');
const s = fs.readFileSync('src/download-ncert-report.ts', 'utf8');
const lines = s.split(/\r?\n/);
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  for (let j = 0; j < line.length; j++) {
    const code = line.charCodeAt(j);
    if (code > 127) {
      console.log(`line ${i+1} col ${j+1} code ${code} char ${line[j]}`);
      break;
    }
  }
}
