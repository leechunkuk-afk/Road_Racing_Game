/* tools/check_text.js - 한국어 문서/소스에 외자·모지·이상 공백이 들어갔는지 검사한다.
   사용: node tools/check_text.js <파일...>   (기본: src/*.js, src/shell.html, docs/*.md) */
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
let files = process.argv.slice(2);
if (!files.length) {
  files = fs.readdirSync(path.join(ROOT, 'src')).filter((f) => /\.(js|html)$/.test(f))
    .map((f) => 'src/' + f)
    .concat(fs.readdirSync(path.join(ROOT, 'docs')).filter((f) => f.endsWith('.md')).map((f) => 'docs/' + f));
}
const foreign = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uff66-\uff9f]/;
const bad = [
  { re: /\uFFFD/, why: '치환 문자(모지)' },
  { re: foreign, why: '일본어·중국어 문자 섞임' }
];
let issues = 0;
for (const f of files) {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) { console.log('SKIP(missing) ' + f); continue; }
  fs.readFileSync(p, 'utf8').split(/\r?\n/).forEach((L, i) => {
    for (const b of bad) {
      if (b.re.test(L)) { issues++; console.log('BAD ' + f + ':' + (i + 1) + ' [' + b.why + '] ' + L.trim().slice(0, 100)); }
    }
  });
}
console.log('files=' + files.length + ' issues=' + issues);
