// music_prep.js — mp3 프레임 단위 자르기 + wav 다운샘플 ( 의존성 없음 )
const fs = require('fs');
const path = require('path');

const WS = process.argv[2] || process.cwd();
const SRC = path.join(WS, 'assets', 'source');
const OUT = path.join(WS, 'assets', 'game', 'music');
fs.mkdirSync(OUT, { recursive: true });

const BR_V1L3 = [0, 112, 128, 160, 192, 224, 256, 320, 96, 64, 112, 128, 160, 192, 224, 320, 224, 128, 160, 192, 176, 112, 144, 160]; // rough
const BITRATES = {
  '11': { 3: [0, 110, 128, 160, 192, 224, 256, 320, 96, 112, 128, 160, 192, 224, 256, 320] },
  '01': { 3: [0, 120, 128, 160, 192, 224, 256, 320, 96, 112, 128, 160, 192, 224, 256, 320] },
  '00': { 3: [0, 144, 160, 176, 192, 224, 256, 320, 96, 112, 128, 160, 192, 224, 256, 320] },
};
const SR = { '11': [44100, 48000, 32000], '01': [22050, 24000, 16000], '00': [11025, 12000, 8000] };

function parseMp3Frames(buf) {
  let i = 0;
  // ID3v2 skip
  if (buf.length > 10 && buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) {
    const sz = ((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) | ((buf[8] & 0x7f) << 7) | (buf[9] & 0x7f);
    i = 10 + sz;
  }
  const frames = [];
  let prev = null;
  while (i + 4 < buf.length) {
    if (buf[i] === 0xff && (buf[i + 1] & 0xe0) === 0xe0) {
      const verBits = ((buf[i + 1] >> 3) & 3).toString(2).padStart(2, '0');
      const layerBits = ((buf[i + 1] >> 1) & 3).toString(2).padStart(2, '0');
      const brIdx = (buf[i + 2] >> 4) & 0x0f;
      const srIdx = (buf[i + 2] >> 2) & 0x03;
      const padding = (buf[i + 2] >> 1) & 1;
      if (verBits !== '00' && layerBits === '01' && brIdx > 0 && brIdx < 15 && srIdx < 3) {
        const brKey = (verBits === '11') ? '11' : (verBits === '01') ? '01' : '00';
        const bitrate = BITRATES[brKey]['3'][brIdx];           // kbps
        const rate = SR[brKey][srIdx];
        const isV1 = verBits === '11';
        const spf = isV1 ? 1152 : 576;
        const bytes = Math.floor((spf / 8) * (bitrate * 1000) / rate) + padding;
        if (bytes > 4 && i + bytes <= buf.length) {
          frames.push({ off: i, len: bytes, bitrate, rate, dur: spf / rate });
          prev = frames[frames.length - 1];
          i += bytes;
          continue;
        }
      }
    }
    i++;
  }
  return frames;
}

function probeMp3(file) {
  const buf = fs.readFileSync(file);
  const frames = parseMp3Frames(buf);
  const dur = frames.reduce((s, f) => s + f.dur, 0);
  const kb = frames.length ? frames[Math.floor(frames.length / 2)].bitrate : 0;
  return { buf, frames, dur, kb };
}

function cutMp3(file, out, startSec, lenSec) {
  const { buf, frames, dur } = probeMp3(file);
  let startFrame = 0, acc = 0;
  for (let k = 0; k < frames.length; k++) { acc += frames[k].dur; if (acc >= startSec) { startFrame = k; break; } }
  let endFrame = frames.length; acc = 0;
  for (let k = startFrame; k < frames.length; k++) { acc += frames[k].dur; if (acc >= lenSec) { endFrame = k + 1; break; } }
  const head = frames[startFrame].off;
  const tail = frames[Math.min(endFrame, frames.length) - 1].off + frames[Math.min(endFrame, frames.length) - 1].len;
  fs.writeFileSync(out, buf.slice(head, tail));
  const cutDur = frames.slice(startFrame, endFrame).reduce((s, f) => s + f.dur, 0);
  console.log(path.basename(out), 'srcDur=' + dur.toFixed(1) + 's', 'cutDur=' + cutDur.toFixed(1) + 's',
    'bitrate=' + frames[startFrame].bitrate + 'kbps', 'size=' + Math.round(fs.statSync(out).size / 1024) + 'KB');
}

function readWavHeader(b) {
  const fmtOff = b.indexOf(Buffer.from('fmt '));
  const channels = b.readUInt16LE(fmtOff + 10);
  const rate = b.readUInt32LE(fmtOff + 12);
  const bits = b.readUInt16LE(fmtOff + 22);
  const dataOff = b.indexOf(Buffer.from('data'));
  const dataLen = b.readUInt32LE(dataOff + 4);
  return { channels, rate, bits, dataStart: dataOff + 8, dataLen };
}

function wavToMonoSmaller(inFile, outFile, maxSec, targetRate) {
  const b = fs.readFileSync(inFile);
  const h = readWavHeader(b);
  if (h.bits !== 16) { console.log('SKIP (bits=' + h.bits + ')', path.basename(inFile)); return; }
  const nFrames = Math.floor(h.dataLen / (h.channels * 2));
  const limit = Math.min(nFrames, Math.floor(maxSec * h.rate));
  const rate = Math.min(targetRate, h.rate);
  const ratio = h.rate / rate;
  const outFrames = Math.floor(limit / ratio);
  const pcm = Buffer.alloc(outFrames * 2);
  for (let i = 0; i < outFrames; i++) {
    const src = Math.floor(i * ratio);
    if (src >= limit) break;
    let sum = 0;
    for (let c = 0; c < h.channels; c++) sum += b.readInt16LE(h.dataStart + (src * h.channels + c) * 2);
    let v = Math.round(sum / h.channels);
    // 2초 페이드인/아웃
    const t = i / rate;
    let gain = 1;
    if (t < 2) gain = t / 2;
    const remain = outFrames / rate - t;
    if (remain < 3) gain = Math.max(0, remain / 3);
    v = Math.round(v * gain);
    pcm.writeInt16LE(Math.max(-32768, Math.min(32767, v)), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0); header.writeUInt32LE(36 + pcm.length, 4); header.write('WAVE', 8);
  header.write('fmt ', 12); header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22); header.writeUInt32LE(rate, 24); header.writeUInt32LE(rate * 2, 28);
  header.writeUInt16LE(2, 32); header.writeUInt16LE(16, 34);
  header.write('data', 36); header.writeUInt32LE(pcm.length, 40);
  fs.writeFileSync(outFile, Buffer.concat([header, pcm]));
  console.log(path.basename(outFile), 'src=' + h.rate + 'Hz/' + h.channels + 'ch', 'out=' + rate + 'Hz mono',
    'dur=' + (outFrames / rate).toFixed(1) + 's', 'size=' + Math.round(fs.statSync(outFile).size / 1024) + 'KB');
}

const M = p => path.join(SRC, 'music', p);
console.log('--- probe ---');
for (const f of ['night_runner.mp3', 'race_loop.mp3', 'death_of_hope.mp3']) {
  try { const p = probeMp3(M(f)); console.log(f, 'dur=' + p.dur.toFixed(1) + 's', 'bitrate~' + p.kb + 'kbps', 'size=' + Math.round(fs.statSync(M(f)).size / 1024) + 'KB'); }
  catch (e) { console.log(f, 'ERR', e.message); }
}
console.log('--- cuts ---');
try { cutMp3(M('night_runner.mp3'), path.join(OUT, 'night_drive_cut.mp3'), 20, 72); } catch (e) { console.log('ERR', e.message); }
try { cutMp3(M('race_loop.mp3'), path.join(OUT, 'race_cut.mp3'), 0, 60); } catch (e) { console.log('ERR', e.message); }
try { cutMp3(M('death_of_hope.mp3'), path.join(OUT, 'menu_cut.mp3'), 5, 55); } catch (e) { console.log('ERR', e.message); }
console.log('--- wav chiptune -> mono ---');
const ch = path.join(SRC, 'music', 'chiptunes_action_5');
const map = { 'Juhani Junkala [Retro Game Music Pack] Level 1.wav': 'chip_level1.wav', 'Juhani Junkala [Retro Game Music Pack] Title Screen.wav': 'chip_title.wav' };
for (const [src, dst] of Object.entries(map)) {
  try { wavToMonoSmaller(path.join(ch, src), path.join(OUT, dst), 50, 22050); } catch (e) { console.log('ERR', src, e.message); }
}
