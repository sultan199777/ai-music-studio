const test = require('node:test');
const assert = require('node:assert/strict');
const SC = require('../src/style-card.js');
const A = require('../src/arranger.js');
const B = require('../src/backing.js');

const SR = 22050;
// segnale di prova: colpi regolari a un dato BPM, con tono grave o acuto
function clicks(bpm, sec, freq, noiseLevel) {
  const n = Math.round(sec * SR), x = new Float32Array(n), step = Math.round(60 / bpm * SR);
  let seed = 1; const r = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296 * 2 - 1; };
  for (let s = 0; s < n; s += step) for (let i = 0; i < 0.12 * SR && s + i < n; i++) { const t = i / SR; x[s + i] += (Math.sin(2 * Math.PI * freq * t) + (noiseLevel || 0) * r()) * Math.exp(-t * 25); }
  return x;
}

test('scheda: bpm e peso del basso (grave contro acuto)', () => {
  const low = SC.measure(clicks(120, 30, 55, 0), SR), high = SC.measure(clicks(120, 30, 4000, 0), SR);
  assert.ok(Math.abs(SC.normBpm(low.bpm) - 120) <= 4 || Math.abs(SC.normBpm(low.bpm) - 60 * 2) <= 4, 'bpm ' + low.bpm);
  assert.ok(low.bassShare > high.bassShare + 0.3, `basso ${low.bassShare} vs ${high.bassShare}`);
  assert.ok(high.bright > low.bright + 0.2, `luminosità ${high.bright} vs ${low.bright}`);
  assert.equal(low.kind, 'misurato');
});

test('scheda: più colpi per battuta = densità maggiore', () => {
  const sparse = SC.measure(clicks(100, 30, 100, 0), SR);
  const x = clicks(100, 30, 100, 0), y = clicks(200, 30, 3000, 0.3), mix = new Float32Array(x.length);
  for (let i = 0; i < mix.length; i++) mix[i] = x[i] + y[i];
  const dense = SC.measure(mix, SR);
  assert.ok(dense.onsetsPerBeat > sparse.onsetsPerBeat, `${dense.onsetsPerBeat} vs ${sparse.onsetsPerBeat}`);
});

test('scheda: la crescita di energia si misura (parte piano, poi forte)', () => {
  const x = clicks(110, 40, 80, 0.1); for (let i = 0; i < x.length; i++) x[i] *= i < x.length / 2 ? 0.15 : 1;
  const flat = SC.measure(clicks(110, 40, 80, 0.1), SR), stepUp = SC.measure(x, SR);
  assert.ok(stepUp.lift > flat.lift * 1.5, `${stepUp.lift} vs ${flat.lift}`);
});

test('scheda: silenzio e segnale corto non rompono nulla', () => {
  const c = SC.measure(new Float32Array(SR), SR);
  assert.ok(c.bpm == null || isFinite(c.bpm));
  const p = SC.toParams(c);
  assert.ok(A.STYLES[p.genre] && p.tune.hat >= 0.3 && p.tune.hat <= 1);
});

test('mescola: i pesi spostano il risultato e i valori mancanti vengono ignorati', () => {
  const a = { name: 'A', bpm: 140, bassShare: 0.8, bright: 0.2, onsetsPerBeat: 3, lift: 2, dynamics: 0.4, mode: 'minore' };
  const b = { name: 'B', bpm: 80, bassShare: 0.3, bright: 0.5, onsetsPerBeat: null, lift: 1, dynamics: 0.1, mode: 'maggiore' };
  const m1 = SC.blend([a, b], [0.8, 0.2]), m2 = SC.blend([a, b], [0.2, 0.8]);
  assert.ok(m1.bassShare > m2.bassShare && m1.bpm > m2.bpm);
  assert.ok(Math.abs(m1.onsetsPerBeat - 3) < 1e-9);
  assert.equal(m1.mode, 'minore'); assert.equal(m2.mode, 'maggiore');
  assert.deepEqual(m1.parts, ['A', 'B']);
});

test('parametri: stile scelto in modo sensato e dentro i limiti', () => {
  const trap = SC.toParams({ bpm: 142, onsetsPerBeat: 2, bright: 0.3, lift: 1.5, bassShare: 0.7, mode: 'minore' });
  assert.ok(['trap', 'drill'].includes(trap.genre));
  const epic = SC.toParams({ bpm: 84, onsetsPerBeat: 1, bright: 0.2, lift: 2.6, bassShare: 0.5 });
  assert.equal(epic.genre, 'epico');
  for (const p of [trap, epic]) {
    assert.ok(p.tune.hat >= 0.3 && p.tune.hat <= 1 && p.tune.bass >= 0.6 && p.tune.bass <= 1.3 && p.tune.lift >= 0.8 && p.tune.lift <= 1.4);
    assert.ok(p.why.length >= 2);
  }
});

test('arrangiatore: i parametri di stile cambiano davvero la base (hi-hat, basso, cassa)', () => {
  const e = (x) => { let s = 0; for (const v of x) s += v * v; return s; };
  const base = A.generate({ sampleRate: 16000, genre: 'trap', bars: 16, seed: 4 });
  const dense = A.generate({ sampleRate: 16000, genre: 'trap', bars: 16, seed: 4, tune: { hat: 1, bass: 1.3, kickVar: 1.6, lift: 1.4 } });
  const sparse = A.generate({ sampleRate: 16000, genre: 'trap', bars: 16, seed: 4, tune: { hat: 0.3, bass: 0.6, kickVar: 0.5, lift: 0.8 } });
  assert.ok(e(sparse.tracks.hat) < e(base.tracks.hat) * 0.85, 'hat');
  assert.ok(e(dense.tracks.bass) > e(sparse.tracks.bass) * 1.5, 'basso');
  assert.ok(e(dense.tracks.kick) >= e(sparse.tracks.kick), 'cassa');
  assert.equal(base.length, dense.length);
  for (const t of Object.values(dense.tracks)) for (let i = 0; i < t.length; i += 97) assert.ok(Number.isFinite(t[i]));
  assert.ok(B.mix(dense, {}).length === dense.length);
});

test('a partire da una base generata, la scheda ritrova uno stile coerente', () => {
  const b = A.generate({ sampleRate: SR, genre: 'trap', bars: 16, seed: 2 });
  const card = SC.measure(B.mix(b, {}), SR, { name: 'prova' });
  const p = SC.toParams(card);
  assert.ok(card.bassShare > 0.2);
  assert.ok(A.STYLES[p.genre]);
});
