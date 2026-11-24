const test = require('node:test'), assert = require('node:assert');
const Mixer = require('../src/mixer.js');

test('channel: limiti e valori di partenza', () => {
  const c = Mixer.channel({ low: 40, pan: -3, rev: 'x', comp: 0.5 });
  assert.strictEqual(c.low, 12); assert.strictEqual(c.pan, -1); assert.strictEqual(c.rev, 0); assert.strictEqual(c.comp, 0.5); assert.strictEqual(c.midHz, 1200);
});
test('preset: lo stile cambia la base (trap: 808 più distorto e sidechain)', () => {
  const p = Mixer.preset('trap', ['bass', 'voice', 'x']);
  assert.strictEqual(p.bass.sat, 0.2); assert.strictEqual(p.bass.duck, 0.45); assert.ok(p.voice.hp >= 80);
  assert.ok(p.voice.comp > 0 && p.voice.high > 0);
  assert.deepStrictEqual(p.x, Mixer.channel({}));
});
test('satCurve: 0 = lineare, più quantità = più compressa, sempre crescente', () => {
  const a = Mixer.satCurve(0, 101), b = Mixer.satCurve(1, 101);
  assert.ok(Math.abs(a[75] - 0.5) < 1e-6);
  assert.ok(b[75] > a[75]); assert.ok(Math.abs(b[100] - 1) < 1e-6);
  for (let i = 1; i < 101; i++) assert.ok(b[i] >= b[i - 1]);
});
test('duckCurve: si abbassa sui colpi di cassa e risale', () => {
  const sr = 8000, x = new Float32Array(sr * 2);
  for (const t of [0.25, 1.25]) for (let i = 0; i < 400; i++) x[Math.round(t * sr) + i] = Math.sin(i / 3) * Math.exp(-i / 200);
  const c = Mixer.duckCurve(x, sr, 1, 200);
  assert.ok(c[Math.round(0.26 * 200)] < 0.3, 'giù sul colpo ' + c[52]);
  assert.ok(c[Math.round(0.9 * 200)] > 0.95, 'su tra i colpi ' + c[180]);
  assert.ok(Mixer.duckCurve(x, sr, 0, 200).every(v => v === 1));
});
test('impulse: stereo, si spegne', () => {
  const [L, R] = Mixer.impulse(8000, 1, 3);
  const e = (a, s, n) => { let t = 0; for (let i = s; i < s + n; i++) t += a[i] * a[i]; return t; };
  assert.ok(e(L, 0, 800) > e(L, 7000, 800) * 20); assert.notStrictEqual(L[10], R[10]);
});
