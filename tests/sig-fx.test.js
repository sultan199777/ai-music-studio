const test = require('node:test'), assert = require('node:assert/strict');
const F = require('../src/sig-fx.js'), A = require('../src/arranger.js'), SB = require('../src/sultan-brain.js');
const rms = (b) => Math.sqrt(b.reduce((s, v) => s + v * v, 0) / b.length), pk = (b) => b.reduce((m, v) => Math.max(m, Math.abs(v)), 0);
test('buffer firma: non vuoti, finiti, senza clipping, deterministici', () => {
  const sr = 8000, bufs = [F.siren(sr, 2, 3), F.gunshot(sr, 3), F.machinegun(sr, 1, 3), F.choir(sr, [57, 60, 64], 2, 3)];
  bufs.forEach((b) => { assert.ok(rms(b) > 0.005, 'silenzio'); assert.ok(pk(b) <= 1.6 && b.every(Number.isFinite)); });
  assert.deepEqual(Array.from(F.gunshot(sr, 5).slice(0, 50)), Array.from(F.gunshot(sr, 5).slice(0, 50)));
});
test('mitraglia: più picchi ravvicinati di un solo sparo', () => {
  const sr = 8000, one = F.gunshot(sr, 1), mg = F.machinegun(sr, 1, 1), cnt = (b) => { let c = 0; for (let i = 80; i < b.length - 80; i += 80) { let m = 0; for (let j = 0; j < 80; j++) m = Math.max(m, Math.abs(b[i + j])); if (m > 0.2) c++; } return c; };
  assert.ok(cnt(mg) > cnt(one) * 3, cnt(mg) + ' vs ' + cnt(one));
});
test('focus: abbassa gli alti all\'inizio e li apre', () => {
  const sr = 8000, n = sr * 4, x = new Float32Array(n).map((_, i) => Math.sin(i * 1.5)), hi = (b, a, z) => rms(b.slice(a, z));
  const y = F.focus(Float32Array.from(x), sr, 0, n, 300, 7000);
  assert.ok(hi(y, 0, sr / 2) < 0.2 * hi(x, 0, sr / 2)); assert.ok(hi(y, n - sr / 2, n) > 0.5 * hi(x, n - sr / 2, n));
});
test('pick: parole nello stile le attivano; senza parole dipende dal genere', () => {
  const k = F.pick({ styleText: 'drill con sirena e spari, coro lirico', seed: 1, genre: 'drill' });
  ['sirena', 'spari', 'coro'].forEach((s) => assert.ok(k.includes(s), s));
  assert.ok(F.pick({ styleText: 'ambulanza', seed: 9, genre: 'lofi' }).includes('sirena'));
});
test('arranger con firme: base diversa da quella senza, stessa lunghezza', () => {
  const o = { sampleRate: 8000, genre: 'drill', bars: 16, tonic: 9, mode: 'minore', seed: 5 }, a = A.generate(o), b = A.generate(Object.assign({ sig: ['coro', 'sirena', 'spari', 'mitra', 'focus'] }, o));
  assert.equal(a.length, b.length); let d = 0; const fa = a.tracks.fx, fb = b.tracks.fx; for (let i = 0; i < fa.length; i += 50) if (Math.abs(fa[i] - fb[i]) > 1e-4) d++;
  assert.ok(d > 20, 'differenze ' + d);
});
test('cervello: 21 stili disponibili e "avoid" cambia lo stile', () => {
  assert.equal(SB.GENRES.length, 21);
  const t = 'Sono nato in strada con la fame addosso, ogni giorno una guerra', seen = [];
  for (let v = 0; v < 7; v++) { const p = SB.plan(t, null, { variant: v, avoid: seen.slice(-4) }); seen.push(p.genre); }
  assert.ok(new Set(seen).size >= 5, seen.join());
});
