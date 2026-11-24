const test = require('node:test'), assert = require('node:assert');
const MP = require('../src/master-pro.js'), BM = require('../src/beatlab-mix.js');
const sr = 22050;
function music(sec) { const n = sr * sec, L = new Float32Array(n), R = new Float32Array(n); let s = 5; const r = () => (s = (s * 16807) % 2147483647) / 2147483647 - 0.5;
  for (let i = 0; i < n; i++) { const t = i / sr, k = Math.sin(2 * Math.PI * 55 * t) * Math.exp(-(t % 0.5) * 8) * 0.3, v = 0.08 * Math.sin(2 * Math.PI * 440 * t) + 0.04 * r(); L[i] = k + v + 0.02 * Math.sin(2 * Math.PI * 660 * t); R[i] = k + v * 0.9; } return { L, R }; }
test('master: arriva al volume scelto (±1 LUFS) e non supera il tetto di true peak', () => {
  const { L, R } = music(6);
  for (const target of ['streaming', 'forte']) {
    const r = MP.process(L, R, sr, { target }, BM.loudness);
    assert.ok(Math.abs(r.report.lufs - MP.TARGETS[target].lufs) <= 1, target + ' lufs ' + r.report.lufs);
    assert.ok(r.report.truePeakDb <= MP.TARGETS[target].tp + 0.3, target + ' tp ' + r.report.truePeakDb);
  }
});
test('multibanda: le 3 bande sommate ridanno il segnale (stessa energia)', () => {
  const { L } = music(2), b = MP.split3(L, sr, 150, 3000); let e0 = 0, e1 = 0;
  for (let i = 2000; i < L.length; i++) { const s = b.low[i] + b.mid[i] + b.high[i]; e0 += L[i] * L[i]; e1 += s * s; }
  assert.ok(Math.abs(10 * Math.log10(e1 / e0)) < 1, 'dB ' + 10 * Math.log10(e1 / e0));
});
test('stereo: bassi in mono, correlazione e larghezza', () => {
  const { L, R } = music(3), wide = MP.process(L, R, sr, { width: 2 }, BM.loudness), narrow = MP.process(L, R, sr, { width: 0 }, BM.loudness);
  assert.ok(narrow.report.corr > 0.99, 'width 0 = mono ' + narrow.report.corr); assert.ok(wide.report.corr < narrow.report.corr);
});
test('spettro e confronto con riferimento: consigli per banda', () => {
  const { L } = music(2), a = MP.spectrum(L, sr), b = a.map((v, i) => i === 1 ? v - 6 : v);
  assert.strictEqual(a.length, 10); const c = MP.compare(a, b);
  assert.ok(c.diff[1] >= 5.9 && /togli/.test(c.tips[0]));
});
