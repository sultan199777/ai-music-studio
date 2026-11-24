const test = require('node:test'), assert = require('node:assert');
const AT = require('../src/autotune.js');
const sr = 16000;
function sing(midi, sec) { const f = 440 * Math.pow(2, (midi - 69) / 12), n = sr * sec, x = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { ph += 2 * Math.PI * f / sr; x[i] = 0.4 * (Math.sin(ph) + 0.5 * Math.sin(2 * ph) + 0.25 * Math.sin(3 * ph)); } return x; }
test('segui gli accordi: una nota tra due gradi va sulla nota dell\'accordo', () => {
  // canta Re4 (62) + 40 cent; scala Do maggiore: senza accordi resta Re; accordo Do (0,4,7) con pull 1 → Do (60) o Mi (64): Mi è più vicino? no, Re+0.4 → 62.4: Mi a 1.6, Do a 2.4 → con pull 1 (soglia 1.5) nessuno → resta Re
  const x = sing(62.4, 1.5);
  const base = AT.correct(x, sr, { tonic: 0, mode: 'maggiore', strength: 1, retuneMs: 0 });
  const m0 = AT.measure(base.samples, sr, { mask: AT.scaleMask(0, 'maggiore') });
  assert.ok(Math.abs(m0.centerCents) < 15, 'scala ok ' + m0.centerCents);
  // canta 63.3 (tra Re# e Mi): scala minore di Do ha Re# (63); accordo Do maggiore (0,4,7) con pull → Mi (64)
  const y = sing(63.3, 1.5), chords = [{ t0: 0, t1: 5, pcs: [0, 4, 7] }];
  const a = AT.correct(y, sr, { tonic: 0, mode: 'minore', strength: 1, retuneMs: 0 });
  const b = AT.correct(y, sr, { tonic: 0, mode: 'minore', strength: 1, retuneMs: 0, chords, chordPull: 1 });
  const ma = AT.track(a.samples, sr), mb = AT.track(b.samples, sr);
  const med = r => { const v = r.frames.filter(f => f.voiced && f.f0 > 0).map(f => 69 + 12 * Math.log2(f.f0 / 440)).sort((p, q) => p - q); return v[v.length >> 1]; };
  assert.ok(Math.abs(med(ma) - 63) < 0.2, 'senza accordi: Re# ' + med(ma));
  assert.ok(Math.abs(med(mb) - 64) < 0.2, 'con accordi: Mi ' + med(mb));
});
