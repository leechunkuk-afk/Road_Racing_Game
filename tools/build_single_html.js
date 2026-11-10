/* ==========================================================================
   build_single_html.js - src/shell.html + src/*.js -> index.html (단일 파일)
   사용: node tools/build_single_html.js
   의존성: node 표준 모듈만 사용(fs/path). 외부 패키지 없음.
   ========================================================================== */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'index.html');
const MARK = '<!--@@SCRIPTS@@-->';

function read(p) { return fs.readFileSync(p, 'utf8'); }

function collect() {
  const files = fs.readdirSync(SRC)
    .filter((f) => /^\d\d_.*\.js$/.test(f))
    .sort();
  if (!files.length) throw new Error('src/*.js 없음');
  return files;
}

function build() {
  const shellPath = path.join(SRC, 'shell.html');
  let shell = read(shellPath);
  if (shell.indexOf(MARK) < 0) throw new Error('shell.html 에 ' + MARK + ' 마커가 없습니다');

  const files = collect();
  const parts = [];
  const lines = [];
  let total = 0;

  for (const f of files) {
    const code = read(path.join(SRC, f));
    if (code.indexOf('</script') >= 0) throw new Error(f + ' 안에 </script> 문자열이 있습니다');
    total += Buffer.byteLength(code, 'utf8');
    lines.push({ name: f, bytes: Buffer.byteLength(code, 'utf8') });
    parts.push('/* ===== ' + f + ' ===== */\n' + code.replace(/^/, ''));
  }

  const stamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const block =
    '<script>\n' +
    '"use strict";\n' +
    '/* 자동 생성: index.html - ' + stamp + ' UTC\n' +
    '   원본: src/shell.html + ' + files.join(', ') + '\n' +
    '   재생성: node tools/build_single_html.js\n' +
    '   라이브러리 의존성 0 / assets/game 없어도 절차적 폴백으로 동작 */\n' +
    parts.join('\n') +
    '\n</script>\n';

  shell = shell.replace(MARK, block);
  fs.writeFileSync(OUT, shell, 'utf8');

  const kb = (n) => (n / 1024).toFixed(1) + ' KB';
  console.log('index.html 생성 완료');
  for (const l of lines) console.log('  ' + l.name.padEnd(16) + kb(l.bytes));
  console.log('  총 소스: ' + kb(total) + '  /  index.html: ' + kb(Buffer.byteLength(shell, 'utf8')));
}

try {
  build();
} catch (e) {
  console.error('빌드 실패: ' + e.message);
  process.exit(1);
}
