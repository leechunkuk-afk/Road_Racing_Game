/* tools/grep_build.js - 빌드된 index.html 에 특정 코드 조각이 들어있는지 확인한다(진단용).
   사용: node tools/grep_build.js "문자열" ["문자열2" ...] */
const fs = require('fs');
const t = fs.readFileSync(require('path').join(__dirname, '..', 'index.html'), 'utf8');
const pats = process.argv.slice(2);
if (!pats.length) { console.log('usage: node tools/grep_build.js <needle> ...'); process.exit(1); }
for (const p of pats) console.log((t.indexOf(p) >= 0 ? 'HIT  ' : 'MISS ') + p);
if (pats.length === 1) {
  const i = t.indexOf(pats[0]);
  if (i >= 0) console.log('---- context ----\n' + t.slice(Math.max(0, i - 500), i + 500));
}
