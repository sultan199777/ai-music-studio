const test = require('node:test'), assert = require('node:assert');
const T = require('../src/timing.js');
function clicks(sr, bpm, delayMs, n) {
  const x = new Float32Array(sr * 8), g = 60 / bpm / 4;
  for (let k = 2; k < n; k += 2) { const s = Math.round((k * g + delayMs / 1000) * sr); for (let i = 0; i < 1500 && s + i < x.length; i++) x[s + i] = Math.sin(i * 0.3) * Math.exp(-i / 400) * 0.8; }
  return x;
}
test('misura ritardo', () => {
  const sr = 16000, m = T.measure(clicks(sr, 120, 40, 28), sr, 120);
  assert.ok(m.reliable); assert.ok(Math.abs(m.offsetMs - 40) <= 8, 'offset ' + m.offsetMs);
});
test('correzione porta a ~0', () => {
  const sr = 16000, x = clicks(sr, 120, 40, 28), y = T.shift(x, sr, 40), m = T.measure(y, sr, 120);
  assert.ok(Math.abs(m.offsetMs) <= 8, 'offset ' + m.offsetMs);
});
test('poche sillabe: non affidabile', () => {
  const sr = 16000; assert.equal(T.measure(new Float32Array(sr), sr, 120).reliable, false);
});
