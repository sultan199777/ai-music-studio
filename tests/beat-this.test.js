const test = require('node:test'), assert = require('node:assert');
const BT = require('../src/beat-this.js');
test('log-mel: 50 fotogrammi al secondo, 128 bande, valori finiti', () => {
  const x = new Float32Array(22050 * 2); for (let i = 0; i < x.length; i++) x[i] = Math.sin(2 * Math.PI * 440 * i / 22050) * 0.5;
  const M = BT.logMel(x); assert.strictEqual(M.frames, 1 + Math.floor(x.length / 441)); assert.strictEqual(M.data.length, M.frames * 128);
  assert.ok(M.data.every(Number.isFinite));
  // il La 440 Hz accende le bande intorno a 440 Hz, non quelle sopra i 5 kHz
  const f = M.frames >> 1, row = Array.from(M.data.subarray(f * 128, f * 128 + 128)), top = row.indexOf(Math.max(...row));
  assert.ok(top >= 10 && top <= 22, 'banda ' + top);
});
test('pezzi come split_piece dell\'originale (1500 fotogrammi, bordo 6)', () => {
  assert.deepStrictEqual(BT.chunks(1000), [-6]);
  const s = BT.chunks(4000); assert.strictEqual(s[0], -6); assert.strictEqual(s[1], 1482); assert.strictEqual(s[s.length - 1], 4000 - 1494);
});
test('post: logit con battiti a 120 BPM e downbeat ogni 4 → 120 BPM, 4/4, affidabilità alta', () => {
  const T = 50 * 20, b = new Float32Array(T).fill(-5), d = new Float32Array(T).fill(-5);
  for (let k = 0; k * 25 < T; k++) { b[k * 25] = 3; b[k * 25 + 1] = 2.5; if (k % 4 === 0) d[k * 25] = 3; }
  const r = BT.post(b, d); assert.ok(Math.abs(r.bpm - 120) < 0.5, r.bpm); assert.strictEqual(r.beatsPerBar, 4); assert.ok(r.conf > 0.9); assert.ok(r.downbeats.length >= 9);
});
test('post: downbeat ogni 2 battute (metà tempo) → velocità comunque giusta', () => {
  const T = 50 * 30, b = new Float32Array(T).fill(-5), d = new Float32Array(T).fill(-5), per = 50 * 60 / 140;
  for (let k = 0; k * per < T - 1; k++) { const i = Math.round(k * per); b[i] = 3; if (k % 8 === 0) d[i] = 3; }
  const r = BT.post(b, d); assert.ok(Math.abs(r.bpm - 140) < 1.5, r.bpm);
});
test('ricampionamento a 22050 Hz', () => { const x = new Float32Array(44100); assert.strictEqual(BT.resample(x, 44100).length, 22050); });
test('impara da una base: con la griglia di Beat This! usa la sua velocità', () => {
  const BL = require('../src/beat-learn.js'), sr = 16000, x = new Float32Array(sr * 12);
  for (let k = 0; k < 24; k++) { const s0 = Math.round(k * 0.5 * sr); for (let i = 0; i < 800; i++) x[s0 + i] += Math.sin(2 * Math.PI * 60 * i / sr) * Math.exp(-i / 300); }
  const grid = { bpm: 120, conf: 0.95, beats: Array.from({ length: 24 }, (_, k) => k * 0.5), downbeats: [0, 2, 4, 6, 8, 10] };
  const L = BL.learn(x, sr, { grid }); assert.strictEqual(L.bpm, 120); assert.strictEqual(L.grid, 'beatthis');
  const L2 = BL.learn(x, sr, { grid: Object.assign({}, grid, { conf: 0.2 }) }); assert.strictEqual(L2.grid, 'regole');
});
