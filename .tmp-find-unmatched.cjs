const fs = require('fs');
const s = fs.readFileSync('src/download-ncert-report.ts','utf8');
let inTemplate = false;
let lastPos = -1;
for (let i = 0; i < s.length; i++) {
  if (s.charCodeAt(i) === 96) {
    inTemplate = !inTemplate;
    if (inTemplate) lastPos = i;
    else lastPos = -1;
  }
}
console.log('inTemplate', inTemplate);
if (inTemplate) {
  const prefix = s.slice(Math.max(0,lastPos-40), lastPos);
  const suffix = s.slice(lastPos, lastPos+40);
  // compute line/col
  const pre = s.slice(0,lastPos);
  const line = pre.split(/\r?\n/).length;
  const col = pre.split(/\r?\n/).pop().length + 1;
  console.log('unmatched at index', lastPos, 'line', line, 'col', col);
  console.log('context before:', JSON.stringify(prefix));
  console.log('context after:', JSON.stringify(suffix));
}
