/* tools/serve.js - 의존성 0 정적 서버(테스트용). 사용: node tools/serve.js [port] */
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = parseInt(process.argv[2] || '8123', 10);
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.xml': 'text/xml; charset=utf-8'
};

/* 프레임 저장을 위한 개발용 엔드포인트: POST /__shot?name=이름.png  body = data:image/png;base64,...
   화면 캡처가 어려운 환경(탭 미표시)에서도 게임 캔버스를 파일로 남길 수 있다. 저장 위치: docs/refs/ */
const REFS = path.join(ROOT, 'docs', 'refs');
function saveShot(req, res, name) {
  if (!/^[A-Za-z0-9_.-]+\.(png|jpg|jpeg)$/.test(name)) { res.writeHead(400); res.end('bad name'); return; }
  const chunks = [];
  let size = 0;
  req.on('data', (c) => {
    size += c.length;
    if (size > 12 * 1024 * 1024) { res.writeHead(413); res.end('too big'); req.destroy(); return; }
    chunks.push(c);
  });
  req.on('end', () => {
    const body = Buffer.concat(chunks).toString('utf8');
    const m = body.match(/base64,(.*)$/s);
    if (!m) { res.writeHead(400); res.end('no base64'); return; }
    let buf;
    try { buf = Buffer.from(m[1].replace(/\s/g, ''), 'base64'); } catch (e) { res.writeHead(400); res.end('bad base64'); return; }
    fs.mkdirSync(REFS, { recursive: true });
    const out = path.join(REFS, name);
    fs.writeFileSync(out, buf);
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('saved ' + path.relative(ROOT, out) + ' ' + buf.length + 'B');
  });
}

http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (req.method === 'POST' && p === '/__shot') {
    const q = new URLSearchParams(req.url.split('?')[1] || '');
    saveShot(req, res, q.get('name') || 'shot.png');
    return;
  }
  if (p === '/' || p === '') p = '/index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT)) { res.writeHead(403); res.end('forbidden'); return; }
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain' }); res.end('404 ' + p); return; }
    const ext = path.extname(file).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Content-Length': st.size,
      'Cache-Control': 'no-store'
    });
    fs.createReadStream(file).pipe(res);
  });
}).listen(PORT, () => console.log('serving ' + ROOT + ' on http://localhost:' + PORT));
