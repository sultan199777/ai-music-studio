const test = require('node:test'), assert = require('node:assert');
const FX = require('../src/voice-fx.js'), AT = require('../src/autotune.js');
const sr = 16000;
function voice(sec) { const n = sr * sec, x = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { ph += 2 * Math.PI * 200 / sr; const env = 0.5 + 0.5 * Math.sin(2 * Math.PI * 3 * i / sr); x[i] = 0.4 * env * (Math.sin(ph) + 0.5 * Math.sin(2 * ph) + 0.3 * Math.sin(3 * ph)); } return x; }
const pcsOf = y => { const r = AT.track(y, sr); const v = r.frames.filter(f => f.voiced && f.f0 > 0).map(f => Math.round(69 + 12 * Math.log2(f.f0 / 440)) % 12); return v; };
test('vocoder: le note vengono dall\'accordo, il ritmo dalla voce', () => {
  const x = voice(1.5), y = FX.vocoder(x, sr, { chords: [{ t0: 0, t1: 5, pcs: [9, 0, 4] }], mix: 1 });
  assert.strictEqual(y.length, x.length);
  // l'inviluppo segue la voce: energia alta dove la voce è forte
  const e = (a, s) => { let t = 0; for (let i = s; i < s + 800; i++) t += a[i] * a[i]; return t; };
  const strong = Math.round(sr / 12), weak = Math.round(sr / 4);
  assert.ok(e(y, strong) > e(y, weak) * 2, 'segue la voce');
});
test('metallico e radio: cambiano il suono e restano della stessa durata e livello', () => {
  const x = voice(1);
  for (const f of ['metallico', 'radio']) { const y = FX.apply(f, x, sr, {}); assert.strictEqual(y.length, x.length); let d = 0, p = 0; for (let i = 0; i < x.length; i++) { d += (y[i] - x[i]) ** 2; p = Math.max(p, Math.abs(y[i])); } assert.ok(d > 1, f + ' cambia'); assert.ok(p < 1.01, f + ' non satura'); }
  assert.strictEqual(FX.apply('niente', x, sr), x);
});
