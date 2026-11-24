const test = require('node:test'), assert = require('node:assert');
const C = require('../src/clips.js');
const sr = 8000, tone = (sec, f) => Float32Array.from({ length: sec * sr }, (_, i) => 0.5 * Math.sin(2 * Math.PI * f * i / sr));
const T = { a: { id: 'a', mono: tone(4, 220), sr }, b: { id: 'b', mono: tone(4, 330), sr } };
const takes = { a: { x: T.a.mono, sr }, b: { x: T.b.mono, sr } };

test('whole: una clip con il ritardo di registrazione tolto', () => {
  const c = C.whole(T.a, 0.1); assert.strictEqual(c.start, 0); assert.ok(Math.abs(c.offset - 0.1) < 1e-9); assert.ok(Math.abs(c.len - 3.9) < 1e-9);
});
test('split: due clip contigue, il render è identico all\'originale tranne i 15 ms di giunzione', () => {
  const c = C.clip({ take: 'a', start: 0, offset: 0, len: 4 }), [l, r] = C.split(c, 2);
  assert.ok(Math.abs(l.len + r.len - 4) < 1e-9 && Math.abs(r.offset - 2) < 1e-9);
  const y1 = C.render([c], takes, sr, 4), y2 = C.render([l, r], takes, sr, 4);
  let d = 0; for (let i = 0; i < y1.length; i++) if (Math.abs(i - 2 * sr) > 0.016 * sr && i > 0.02 * sr && i < 3.98 * sr) d = Math.max(d, Math.abs(y1[i] - y2[i]));
  assert.ok(d < 1e-6, 'diff ' + d);
  assert.strictEqual(C.split(c, 5), null);
});
test('render: niente click ai bordi (dissolvenze)', () => {
  const y = C.render([C.clip({ take: 'a', start: 1, offset: 0.37, len: 1 })], takes, sr, 3);
  let jump = 0; for (let i = 1; i < y.length; i++) jump = Math.max(jump, Math.abs(y[i] - y[i - 1]));
  assert.ok(jump < 0.2, 'salto max ' + jump); // un seno a 220 Hz salta al massimo ~0.09 per campione
});
test('compByLines: ogni riga dalla prova scelta', () => {
  const lines = [{ start: 0.5, end: 1.5 }, { start: 2, end: 3 }];
  const cl = C.compByLines(lines, ['a', 'b'], [T.a, T.b]);
  assert.deepStrictEqual(cl.map(c => c.take), ['a', 'b']);
  const y = C.render(cl, takes, sr, 4);
  const zc = (s, e) => { let z = 0; for (let i = s * sr + 1; i < e * sr; i++) if (y[i - 1] < 0 && y[i] >= 0) z++; return z / (e - s); };
  assert.ok(Math.abs(zc(0.8, 1.3) - 220) < 5); assert.ok(Math.abs(zc(2.2, 2.8) - 330) < 5);
  assert.ok(Math.abs(y[Math.round(1.8 * sr)]) < 1e-9, 'silenzio tra le righe');
});
