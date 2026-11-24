const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../src/master.js');
const A = require('../src/arranger.js');
const B = require('../src/backing.js');

const SR = 16000;
const sig = () => { const b = A.generate({ sampleRate: SR, genre: 'trap', bars: 8, seed: 3 }); return B.mix(b, {}); };

test('master: il picco non supera mai il tetto e tutti i valori sono finiti', () => {
  for (const p of Object.keys(M.PRESETS)) {
    const r = M.process(sig(), SR, p);
    assert.ok(r.report.peakDb <= M.PRESETS[p].ceil + 0.05, `${p} picco ${r.report.peakDb}`);
    for (let i = 0; i < r.samples.length; i += 13) assert.ok(Number.isFinite(r.samples[i]));
    assert.equal(r.samples.length, sig().length);
  }
});

test('master: il volume medio si avvicina al bersaglio e i preset sono ordinati', () => {
  const x = sig();
  const rs = Object.fromEntries(Object.keys(M.PRESETS).map((p) => [p, M.process(x, SR, p).report]));
  assert.ok(rs.forte.rmsDb > rs.standard.rmsDb && rs.standard.rmsDb > rs.morbido.rmsDb);
  for (const p of Object.keys(M.PRESETS)) assert.ok(Math.abs(rs[p].rmsDb - M.PRESETS[p].rms) <= 3.5, `${p}: ${rs[p].rmsDb}`);
});

test('master: un segnale troppo piano viene alzato, uno troppo forte viene contenuto', () => {
  const x = sig(), quiet = x.map((v) => v * 0.02), hot = x.map((v) => v * 6);
  const q = M.process(quiet, SR, 'standard').report, h = M.process(hot, SR, 'standard').report;
  assert.ok(q.rmsDb > q.inRmsDb + 10);
  assert.ok(h.peakDb <= -0.9);
});

test('master: silenzio e segnale vuoto non rompono nulla', () => {
  assert.equal(M.process(new Float32Array(1000), SR, 'standard').samples.length, 1000);
  assert.equal(M.process(new Float32Array(0), SR, 'forte').samples.length, 0);
});

test('master: non toglie il ritmo (energia nel tempo resta correlata)', () => {
  const x = sig(), y = M.process(x, SR, 'standard').samples, w = 800, ex = [], ey = [];
  for (let i = 0; i + w < x.length; i += w) { let a = 0, b = 0; for (let j = 0; j < w; j++) { a += x[i + j] ** 2; b += y[i + j] ** 2; } ex.push(a); ey.push(b); }
  const mx = ex.reduce((a, b) => a + b) / ex.length, my = ey.reduce((a, b) => a + b) / ey.length;
  let c = 0, sx = 0, sy = 0; for (let i = 0; i < ex.length; i++) { c += (ex[i] - mx) * (ey[i] - my); sx += (ex[i] - mx) ** 2; sy += (ey[i] - my) ** 2; }
  assert.ok(c / Math.sqrt(sx * sy) > 0.6, 'correlazione ' + c / Math.sqrt(sx * sy));
});

test('master: prestazioni su 60 secondi', () => {
  const x = new Float32Array(SR * 60); for (let i = 0; i < x.length; i++) x[i] = 0.3 * Math.sin(i * 0.05) * Math.sin(i * 0.0003);
  const t0 = Date.now(); M.process(x, SR, 'forte'); assert.ok(Date.now() - t0 < 4000);
});
