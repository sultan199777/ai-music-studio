const test = require('node:test'), assert = require('node:assert'), { execFileSync } = require('node:child_process'), fs = require('fs'), os = require('os'), path = require('path');
const M = require('../src/mp4audio.js');
const has = (() => { try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); return true; } catch (e) { return false; } })();
function mk(args, out) { execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args, out]); }
const fileLike = p => { const b = fs.readFileSync(p); return { size: b.length, name: path.basename(p), slice: (a, c) => ({ arrayBuffer: async () => { const s = b.subarray(a, c); return s.buffer.slice(s.byteOffset, s.byteOffset + s.length); } }) }; };
test('estrae audio AAC da un video con indice in fondo (come l\'iPhone)', { skip: !has }, async () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'mp4a-'));
  mk(['-f', 'lavfi', '-i', 'sine=frequency=440:duration=30', '-f', 'lavfi', '-i', 'testsrc=size=320x240:rate=10:duration=30', '-c:a', 'aac', '-c:v', 'mpeg4', '-shortest'], path.join(d, 'a.mp4'));
  const f = fileLike(path.join(d, 'a.mp4')), r = await M.extract(f, 10);
  assert.ok(r, 'deve riuscire'); assert.equal(r.rate, 44100);
  const secs = r.frames * 1024 / r.rate; assert.ok(secs >= 10 && secs < 10.5, 'secondi ' + secs);
  const u = new Uint8Array(r.buf); assert.equal(u[0], 0xFF); assert.equal(u[1] & 0xF0, 0xF0);
  const L = ((u[3] & 3) << 11) | (u[4] << 3) | (u[5] >> 5); assert.ok(L > 7 && L < 3000);
  /* ffmpeg legge l'ADTS prodotto: durata ~10 s */
  fs.writeFileSync(path.join(d, 'o.aac'), Buffer.from(r.buf));
  const dur = parseFloat(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path.join(d, 'o.aac')]).toString());
  assert.ok(Math.abs(dur - secs) < 0.3, 'durata ' + dur);
});
test('file non MP4 o senza AAC: null', async () => {
  const bad = { size: 100, name: 'x.mp4', slice: () => ({ arrayBuffer: async () => new ArrayBuffer(100) }) };
  assert.equal(await M.extract(bad, 10), null);
});
test('formato QuickTime .mov (esds dentro wave): estrae e legge poco', { skip: !has }, async () => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'movq-'));
  mk(['-f', 'lavfi', '-i', 'sine=frequency=330:duration=20', '-f', 'lavfi', '-i', 'testsrc=size=320x240:rate=10:duration=20', '-c:a', 'aac', '-c:v', 'mpeg4', '-shortest', '-f', 'mov'], path.join(d, 'b.mov'));
  let mx = 0; const f0 = fileLike(path.join(d, 'b.mov')), f = { size: f0.size, name: 'b.mov', slice: (a, c) => { mx = Math.max(mx, c - a); return f0.slice(a, c); } };
  const r = await M.extract(f, 8); assert.ok(r, 'deve riuscire sul .mov');
  const secs = r.frames * 1024 / r.rate; assert.ok(secs >= 8 && secs < 8.5, 'secondi ' + secs);
  assert.ok(mx <= 4194304 + 1024, 'mai letture enormi: ' + mx);
});
