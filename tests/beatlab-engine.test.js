const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../src/beatlab-engine.js');
const P = require('../src/beatlab-patterns.js');

function proj(style, o) { const p = E.newProject(o || {}); P.applyStyle(p, style || 'trap'); return p; }
// orologio finto + scheduler: raccoglie (evento, quando)
function run(p, seconds, opts) {
  opts = opts || {};
  let now = 0; const got = [];
  const s = new E.Scheduler({ getProject: () => p, now: () => now, onEvent: (e, when) => { got.push({ e, when, atPump: now }); }, lookahead: opts.lookahead || 0.12 });
  s.start(0, 0);
  const step = opts.interval || 0.025;
  for (now = 0; now < seconds; now += step * (1 + (opts.jitter ? Math.random() * 0.8 : 0))) {
    if (opts.onTime) opts.onTime(now, p);
    s.pump();
  }
  return { got, s };
}

test('scheduler: cassa a 0 s e rullante sul 3 a 120 BPM cadono all\'istante esatto', () => {
  const p = proj('trap'); p.bpm = 120; p.swing = 50;
  const { got } = run(p, 3);
  const kick0 = got.filter((g) => g.e.lane === 'kick').map((g) => g.when);
  assert.ok(Math.abs(kick0[0] - 0) < 1e-9);
  const sn = got.filter((g) => g.e.lane === 'snare').map((g) => g.when);
  assert.ok(Math.abs(sn[0] - 1.0) < 1e-9, 'rullante a ' + sn[0]); // beat 3 = 2 quarti = 1.0 s a 120 BPM
  assert.ok(Math.abs(sn[1] - 3.0) < 1e-9, 'secondo rullante a ' + sn[1]); // battuta 2: 2.0 + 1.0
});

test('scheduler: con il jitter del timer nessun evento viene consegnato in ritardo e nessuno e\' doppio', () => {
  const p = proj('drill'); p.swing = 62;
  const { got } = run(p, 12, { jitter: true, interval: 0.03 });
  assert.ok(got.length > 100);
  for (const g of got) assert.ok(g.when >= g.atPump - 1e-9, `evento in ritardo: ${g.when} < ${g.atPump}`);
  const keys = got.map((g) => g.e.track + ':' + g.e.tick.toFixed(4));
  assert.equal(new Set(keys).size, keys.length, 'eventi duplicati');
});

test('loop: dopo 2 battute il disegno riparte (4,0 s a 120 BPM)', () => {
  const p = proj('trap'); p.bpm = 120;
  const { got } = run(p, 8.5);
  const k = got.filter((g) => g.e.lane === 'kick').map((g) => +g.when.toFixed(6));
  assert.ok(k.includes(0) && k.includes(4) && k.includes(8));
});

test('swing: solo i sedicesimi in levare si ritardano; 50 = dritto, 66 = terzina', () => {
  assert.equal(E.swingDelay(24, 50), 0);
  assert.ok(Math.abs(E.swingDelay(24, 66) - (0.66 * 48 - 24)) < 1e-9);
  assert.equal(E.swingDelay(0, 66), 0); assert.equal(E.swingDelay(48, 66), 0); assert.equal(E.swingDelay(12, 66), 0);
  assert.equal(E.swingDelay(72, 100), E.swingDelay(72, 75)); // limitato a 75
  const p = proj('boombap'); p.bpm = 90; p.swing = 66; assert.ok(p.tracks.find((t) => t.lane === 'hat').steps.some((v, i) => v > 0 && i % 2 === 1), 'boom bap ha sedicesimi in levare');
  const evs = E.eventsInRange(p, 0, 384);
  const off = evs.filter((e) => e.lane === 'hat' && Math.abs(e.tick % 48 - 24) < 1e-6);
  assert.ok(off.length > 0); off.forEach((e) => assert.ok(e.delay > 7 && e.delay < 8));
});

test('cambio di BPM mentre suona: il passo successivo usa il nuovo tempo', () => {
  const p = proj('elettronico'); p.bpm = 120; p.swing = 50;
  const { got } = run(p, 6, { onTime: (t, pr) => { if (t > 2) pr.bpm = 60; } });
  const k = got.filter((g) => g.e.lane === 'kick').map((g) => g.when);
  const gaps = k.slice(1).map((x, i) => x - k[i]);
  assert.ok(Math.abs(gaps[0] - 0.5) < 1e-6, 'prima 0,5 s: ' + gaps[0]);
  assert.ok(gaps.some((g) => Math.abs(g - 1.0) < 1e-6), 'poi 1 s');
  for (let i = 1; i < k.length; i++) assert.ok(k[i] > k[i - 1]);
});

test('rullate: 2, 3 o 4 colpi dentro il passo, forza che scende (down) o piu\' bassa al centro (dip)', () => {
  const p = E.newProject({ bars: 1, res: 16 }); const h = p.tracks.find((t) => t.lane === 'hat');
  h.steps[4] = 100; h.roll[4] = 3; h.steps[8] = 100; h.roll[8] = 2; h.steps[12] = 100; h.roll[12] = 4;
  const ev = E.eventsInRange(p, 0, 384).filter((e) => e.lane === 'hat');
  const at = (a, b) => ev.filter((e) => e.tick >= a && e.tick < b);
  const r3 = at(96, 120); assert.equal(r3.length, 3); assert.deepEqual(r3.map((e) => e.tick), [96, 104, 112]);
  assert.ok(r3[0].vel > r3[1].vel && r3[1].vel > r3[2].vel);
  const r2 = at(192, 216); assert.deepEqual(r2.map((e) => e.tick), [192, 204]);
  h.rollShape = 'dip'; const d = E.eventsInRange(p, 288, 312).filter((e) => e.lane === 'hat');
  assert.equal(d.length, 4); assert.ok(d[1].vel < d[0].vel && d[2].vel < d[3].vel);
  for (const e of ev) assert.ok(e.vel >= 1 && e.vel <= 127);
});

test('mute e solo: "audible" segue le regole', () => {
  const p = proj('trap'); const k = p.tracks.find((t) => t.lane === 'kick'), s = p.tracks.find((t) => t.lane === 'snare');
  k.mute = true; let ev = E.eventsInRange(p, 0, 384);
  assert.ok(ev.filter((e) => e.lane === 'kick').every((e) => !e.audible)); assert.ok(ev.filter((e) => e.lane === 'snare').every((e) => e.audible));
  s.solo = true; ev = E.eventsInRange(p, 0, 384);
  assert.ok(ev.filter((e) => e.lane === 'snare').every((e) => e.audible)); assert.ok(ev.filter((e) => e.lane !== 'snare').every((e) => !e.audible));
});

test('resize: 16 -> 32 passi conserva i colpi, 2 -> 4 battute ripete, 32 -> 16 non perde colpi', () => {
  const p = proj('trap'); const before = p.tracks.find((t) => t.lane === 'snare').steps.slice();
  E.resize(p, 2, 32); const s32 = p.tracks.find((t) => t.lane === 'snare').steps;
  assert.equal(s32.length, 64); assert.equal(s32[16], before[8]); assert.equal(s32[17], 0);
  E.resize(p, 4, 32); assert.equal(p.tracks.find((t) => t.lane === 'snare').steps.length, 128);
  assert.equal(p.tracks.find((t) => t.lane === 'snare').steps[64 + 16], before[8]);
  E.resize(p, 2, 16); assert.deepEqual(p.tracks.find((t) => t.lane === 'snare').steps, before);
  // un colpo sul passo "in mezzo" a 32 diventa una rullata da 2 a 16
  const q = E.newProject({ bars: 1, res: 32 }); const h = q.tracks.find((t) => t.lane === 'hat'); h.steps[4] = 90; h.steps[5] = 70; E.resize(q, 1, 16);
  assert.equal(h.steps[2], 90); assert.equal(h.roll[2], 2);
});

test('808: la nota con glide parte dalla nota precedente', () => {
  const p = proj('drill'); const b = p.tracks.find((t) => t.inst === 'sub808');
  const ev = E.eventsInRange(p, 0, 768).filter((e) => e.type === 'note');
  const g = ev.filter((e) => e.glideFrom != null); assert.ok(g.length > 0);
  for (const e of ev) assert.ok(e.mono);
  assert.ok(b.notes.some((n) => n.s === 1));
});

test('posizione del cursore: segue il tempo e rientra nel loop', () => {
  const p = proj('trap'); p.bpm = 120;
  let now = 0; const s = new E.Scheduler({ getProject: () => p, now: () => now, onEvent: () => {} }); s.start(0, 0);
  for (now = 0; now < 1.01; now += 0.025) s.pump();
  now = 1.0; assert.ok(Math.abs(s.positionAt(1.0) - 192) < 0.5, 'pos ' + s.positionAt(1.0));
  for (; now < 5.01; now += 0.025) s.pump();
  now = 5.0; assert.ok(Math.abs(s.positionAt(5.0) - 192) < 1, 'dopo un giro: ' + s.positionAt(5.0));
});

test('WAV: intestazione valida, lunghezza esatta, valori limitati, 16 e 24 bit', () => {
  const sr = 44100, n = 1000, L = new Float32Array(n), R = new Float32Array(n);
  for (let i = 0; i < n; i++) { L[i] = Math.sin(i / 10); R[i] = i === 5 ? 3 : (i === 6 ? NaN : -0.5); }
  for (const bits of [16, 24]) {
    const w = E.encodeWav([L, R], sr, bits), h = E.parseWav(w);
    assert.ok(h); assert.equal(h.fmt, 1); assert.equal(h.ch, 2); assert.equal(h.sr, sr); assert.equal(h.bits, bits);
    assert.equal(h.frames, n); assert.equal(h.size, 44 + n * 2 * bits / 8); assert.equal(h.riffLen, h.size - 8);
  }
  const w = E.encodeWav([L, R], sr, 16), v = new DataView(w.buffer);
  assert.equal(v.getInt16(44 + 5 * 4 + 2, true), 32767); // 3 -> limitato a 1
  assert.equal(v.getInt16(44 + 6 * 4 + 2, true), 0);     // NaN -> 0
  const a = E.analyzeChannels([L, R]); assert.equal(a.finite, false);
});

test('campioni batteria: decodifica da samples-data.js dà valori finiti nel range', () => {
  const S = require('../src/samples-data.js');
  for (const k of ['kick', 'snare', 'clap', 'hat']) { const f = E.decodeSample(S.data[k][0]); assert.ok(f.length > 1000); let pk = 0; for (const x of f) { assert.ok(Number.isFinite(x)); pk = Math.max(pk, Math.abs(x)); } assert.ok(pk > 0.3 && pk <= 1); }
});
