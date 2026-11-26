const test = require('node:test'), assert = require('node:assert'), M = require('../src/audio-midi.js'), BM = require('../src/beatlab-midi.js');
const sr = 44100, hz = m => 440 * Math.pow(2, (m - 69) / 12);
function seq(list, harm, noise) { const total = list.reduce((a, n) => a + n[1], 0); const x = new Float32Array(Math.round(total * sr)); let p = 0, seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5;
  list.forEach(([m, d]) => { const n = Math.round(d * sr); for (let i = 0; i < n; i++) { const t = i / sr, e = Math.min(1, t * 80) * Math.min(1, (d - t) * 80); let v = 0; if (m) for (let h = 1; h <= (harm || 1); h++) v += Math.sin(2 * Math.PI * hz(m) * h * t) / h; x[p + i] = 0.4 * v * e + (noise || 0) * rnd(); } p += n; }); return x; }
test('basso: riconosce note e tempi', () => {
  const x = seq([[33, 0.5], [36, 0.5], [40, 0.5], [0, 0.25], [31, 0.5]], 3, 0.01), r = M.bass(x, sr);
  assert.deepEqual(r.notes.map(n => n.midi), [33, 36, 40, 31], JSON.stringify(r.notes));
  const starts = [0, 0.5, 1.0, 1.75]; r.notes.forEach((n, i) => assert.ok(Math.abs(n.t - starts[i]) < 0.06, `inizio ${i}: ${n.t}`)); r.notes.forEach(n => assert.ok(n.d > 0.38 && n.d < 0.6, 'durata ' + n.d));
});
test('melodia: riconosce note acute con un po\' di rumore', () => {
  const x = seq([[69, 0.4], [72, 0.4], [76, 0.4], [74, 0.4]], 2, 0.02), r = M.melody(x, sr);
  assert.deepEqual(r.notes.map(n => n.midi), [69, 72, 76, 74], JSON.stringify(r.notes));
});
test('silenzio e rumore: nessuna nota inventata', () => {
  assert.equal(M.bass(new Float32Array(sr * 2), sr).notes.length, 0);
  let s = 3; const n = new Float32Array(sr * 2).map(() => ((s = (s * 16807) % 2147483647) / 2147483647 - 0.5) * 0.3); assert.ok(M.melody(n, sr).notes.length <= 3);
});
test('file MIDI valido: lo rilegge il lettore del Beat Lab', () => {
  const notes = [{ midi: 33, t: 0, d: 0.5, v: 100 }, { midi: 36, t: 0.5, d: 0.5, v: 90 }], u = M.toSMF(notes, 120, 'Basso', 33), p = BM.parse(u);
  assert.equal(p.format, 0); assert.equal(p.ppq, 480); const on = p.tracks[0].events.filter(e => e.type === 'on' || e.type === 'noteOn' || e.vel > 0 && e.note != null);
  assert.ok(on.length >= 2, JSON.stringify(p.tracks[0].events.slice(0, 6))); assert.equal(M.noteName(33), 'La1');
});
