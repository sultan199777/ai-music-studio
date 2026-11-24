const test = require('node:test'), assert = require('node:assert');
const BL = require('../src/beat-learn.js'), Arranger = require('../src/arranger.js');

function rms(a, s, e) { s = Math.round(s); e = Math.round(e); let t = 0; for (let i = s; i < e; i++) t += a[i] * a[i]; return Math.sqrt(t / (e - s)); }
// base finta: cassa (sub) sui passi 0 e 10, rullante sul 8, hi-hat su tutti i sedicesimi, a 140 BPM
function fakeBeat(sr, bpm, bars, kick, snare) {
  const st = 240 / bpm / 16, n = Math.round(bars * 240 / bpm * sr), L = new Float32Array(n), R = new Float32Array(n);
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647 - 0.5;
  for (let b = 0; b < bars; b++) for (let s = 0; s < 16; s++) {
    const t0 = Math.round((b * 16 + s) * st * sr);
    if (kick.includes(s)) for (let i = 0; i < sr * 0.25 && t0 + i < n; i++) { const v = Math.sin(2 * Math.PI * 50 * i / sr) * Math.exp(-i / (sr * 0.08)) * 0.8; L[t0 + i] += v; R[t0 + i] += v; }
    if (snare.includes(s)) for (let i = 0; i < sr * 0.12 && t0 + i < n; i++) { const v = (rnd() * 0.6 + Math.sin(2 * Math.PI * 200 * i / sr) * 0.3) * Math.exp(-i / (sr * 0.03)); L[t0 + i] += v * 1.2; R[t0 + i] += v * 0.4; }
    for (let i = 0; i < sr * 0.03 && t0 + i < n; i++) { let v = rnd() * 0.25 * Math.exp(-i / (sr * 0.006)); L[t0 + i] += v * 0.2; R[t0 + i] += v; }
  }
  return { L, R };
}

test('separate: voce al centro va nella voce, colpi laterali restano nella base', () => {
  const sr = 22050, n = sr * 3, L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i++) { const v = 0.3 * Math.sin(2 * Math.PI * 440 * i / sr) + 0.1 * Math.sin(2 * Math.PI * 880 * i / sr); L[i] += v; R[i] += v; }
  let seed = 3; for (let k = 0; k < 12; k++) { const t0 = Math.round(k * 0.25 * sr); for (let i = 0; i < 800; i++) { seed = (seed * 16807) % 2147483647; L[t0 + i] += (seed / 2147483647 - 0.5) * 0.8 * Math.exp(-i / 150); } }
  const r = BL.separate(L, R, sr);
  assert.ok(r.stereo);
  const mid = [sr, sr * 2];
  // nella voce c'è il tono; nella base destra (solo tono) quasi niente
  assert.ok(rms(r.voice, ...mid) > 0.15, 'voce ' + rms(r.voice, ...mid));
  assert.ok(rms(r.baseR, ...mid) < rms(R, ...mid) * 0.35, 'resto base R ' + rms(r.baseR, ...mid));
  // i colpi solo a sinistra restano nella base: nella voce quasi non cambiano niente
  let bb = 0, bq = 0, vb = 0, vq = 0; for (let k = 4; k < 8; k++) { const t0 = Math.round(k * 0.25 * sr), q = t0 + 2000; bb += rms(r.baseL, t0, t0 + 300); bq += rms(r.baseL, q, q + 300); vb += rms(r.voice, t0, t0 + 300); vq += rms(r.voice, q, q + 300); }
  assert.ok(bb > bq * 2, 'colpi nella base ' + bb + ' vs ' + bq);
  assert.ok(vb < vq * 1.4, 'colpi nella voce ' + vb + ' vs ' + vq);
});

test('clean: toglie il fruscio costante e normalizza a -1 dB', () => {
  const sr = 22050, n = sr * 2, x = new Float32Array(n); let seed = 11;
  for (let i = 0; i < n; i++) { seed = (seed * 16807) % 2147483647; x[i] = (seed / 2147483647 - 0.5) * 0.02 + (i > sr * 0.5 && i < sr * 1.5 ? 0.2 * Math.sin(2 * Math.PI * 300 * i / sr) : 0); }
  const c = BL.clean(x, sr);
  let pk = 0; for (const v of c.x) pk = Math.max(pk, Math.abs(v));
  assert.ok(Math.abs(pk - 0.891) < 0.01);
  const snrIn = rms(x, sr * 0.7, sr * 1.3) / rms(x, 1000, sr * 0.4), snrOut = rms(c.x, sr * 0.7, sr * 1.3) / rms(c.x, 1000, sr * 0.4);
  assert.ok(snrOut > snrIn * 2, snrIn + ' -> ' + snrOut);
});

test('learn: riconosce BPM, cassa, rullante a metà tempo e hi-hat fitti', () => {
  const sr = 22050, { L, R } = fakeBeat(sr, 140, 16, [0, 10], [8]);
  const m = new Float32Array(L.length); for (let i = 0; i < m.length; i++) m[i] = (L[i] + R[i]) / 2;
  const p = BL.learn(m, sr);
  assert.ok(Math.abs(p.bpm - 140) <= 3, 'bpm ' + p.bpm);
  assert.ok(p.kick.includes(0) && p.kick.includes(10), 'kick ' + p.kick);
  assert.deepStrictEqual(p.snare.includes(8), true, 'snare ' + p.snare);
  assert.ok(p.hatDensity >= 0.7, 'hat ' + p.hatDensity);
  assert.ok(['trap', 'drill'].includes(p.style), p.style);
  assert.ok(p.why.length >= 5);
});

test('blend: ricava una base nuova (non uguale) e l\'arrangiatore la usa', () => {
  const a = { bpm: 140, key: { tonic: 9, mode: 'minore' }, kick: [0, 10], snare: [8], hatDensity: 0.9, triplets: 0.2, swing: 0, sub: 0.7, style: 'trap' };
  const b = { bpm: 144, key: { tonic: 2, mode: 'minore' }, kick: [0, 7, 10], snare: [8], hatDensity: 0.8, triplets: 0.5, swing: 0, sub: 0.6, style: 'drill' };
  const no = { bpm: 96, key: null, kick: [0, 8], snare: [4, 12], hatDensity: 0.3, triplets: 0, swing: 0.1, sub: 0.2, style: 'melodico' };
  const s = BL.blend([a, b], [no]);
  assert.strictEqual(s.mode, 'minore');
  assert.ok(s.bpm >= 140 && s.bpm <= 150, s.bpm);
  assert.deepStrictEqual(s.groove.kickPats[0][0], [0, 10]);
  assert.notDeepStrictEqual(s.groove.kickPats[0][1], s.groove.kickPats[0][0]);
  assert.strictEqual(BL.blend([], []), null);
  const g = Arranger.generate({ sampleRate: 8000, bpm: s.bpm, genre: s.genre, bars: 4, seed: 1, groove: s.groove, tune: s.tune, sounds: 'sint' });
  const h = Arranger.generate({ sampleRate: 8000, bpm: s.bpm, genre: s.genre, bars: 4, seed: 1, sounds: 'sint' });
  assert.ok(g.tracks && g.length > 0);
  let diff = 0; for (let i = 0; i < g.tracks.kick.length; i += 13) diff += Math.abs(g.tracks.kick[i] - h.tracks.kick[i]);
  assert.ok(diff > 0, 'il groove cambia la cassa');
});

test('separateAsync a blocchi: stessa voce di separate (lontano dai bordi)', async () => {
  const sr = 8000, n = sr * 40, L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i++) { const v = 0.3 * Math.sin(2 * Math.PI * 440 * i / sr); L[i] = v; R[i] = v; }
  let last = 0; const r = await BL.separateAsync(L, R, sr, {}, p => { last = p; });
  assert.strictEqual(last, 1);
  assert.ok(rms(r.voice, sr * 14, sr * 16) > 0.15, 'giunzione ' + rms(r.voice, sr * 14, sr * 16));
  assert.ok(rms(r.baseR, sr * 20, sr * 25) < 0.1);
});

test('learn: groove "2 e 4" a 96 BPM (non metà tempo)', () => {
  const sr = 22050, { L, R } = fakeBeat(sr, 96, 12, [0, 8], [4, 12]);
  const m = new Float32Array(L.length); for (let i = 0; i < m.length; i++) m[i] = (L[i] + R[i]) / 2;
  const p = BL.learn(m, sr);
  assert.ok(Math.abs(p.bpm - 96) <= 3, 'bpm ' + p.bpm);
  assert.deepStrictEqual(p.snare, [4, 12]);
  assert.ok(p.kick.includes(0) && p.kick.includes(8), 'kick ' + p.kick);
});

test('accordi: riconosce un giro La minore – Fa – Do – Sol e lo traduce in gradi', () => {
  const sr = 16000, bpm = 120, bar = 2, seq = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]], n = sr * bar * 8, x = new Float32Array(n);
  for (let b = 0; b < 8; b++) seq[b % 4].forEach(m => { const f = 440 * Math.pow(2, (m - 69) / 12); for (let i = 0; i < sr * bar; i++) x[b * sr * bar + i] += 0.2 * Math.sin(2 * Math.PI * f * i / sr); });
  const r = BL.chordsOf(x, sr, bpm, 0, { tonic: 9, mode: 'minore' });
  assert.deepStrictEqual(r.names.slice(0, 4), ['Lam', 'Fa', 'Do', 'Sol']);
  assert.deepStrictEqual(r.prog, [0, 5, 2, 6]); assert.strictEqual(BL.progName(r.prog, 'minore'), 'i–VI–III–VII');
});
