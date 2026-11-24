const test = require('node:test');
const assert = require('node:assert/strict');
const AA = require('../src/audio-analysis.js');
const AT = require('../src/autotune.js');
const PE = require('../src/pitch-editor.js');
const VI = require('../src/video-ideas.js');

const SR = 22050;
// tre note con timbro ricco: 220 Hz, 262 Hz calante di ~40 cent, 330 Hz
function tone(f, sec) { const n = Math.round(sec * SR), o = new Float32Array(n); for (let i = 0; i < n; i++) { const t = i / SR; o[i] = 0.4 * (Math.sin(2 * Math.PI * f * t) + 0.5 * Math.sin(4 * Math.PI * f * t) + 0.25 * Math.sin(6 * Math.PI * f * t)) * Math.min(1, i / 400, (n - i) / 400); } return o; }
function seq(parts) { const gap = new Float32Array(Math.round(0.12 * SR)); const arr = []; parts.forEach((p) => { arr.push(p, gap); }); const len = arr.reduce((a, b) => a + b.length, 0), o = new Float32Array(len); let k = 0; arr.forEach((a) => { o.set(a, k); k += a.length; }); return o; }
const flat = 262 * Math.pow(2, -40 / 1200);
const SIG = seq([tone(220, 0.6), tone(flat, 0.6), tone(330, 0.6)]);
const midi = (f) => 69 + 12 * Math.log2(f / 440);
const medianPitch = (x, t0, t1) => { const r = AA.analyze(x, SR); const v = r.frames.filter((f) => f.voiced && f.t >= t0 && f.t + r.frameSeconds <= t1).map((f) => midi(f.f0)).sort((a, b) => a - b); return v[v.length >> 1]; };

test('editor note: trova tre note e le misura', () => {
  const r = AA.analyze(SIG, SR); const n = PE.segment(r, { tonic: 0, mode: 'cromatica' });
  assert.equal(n.length, 3);
  assert.ok(Math.abs(n[0].midi - midi(220)) < 0.25 && Math.abs(n[2].midi - midi(330)) < 0.25);
  assert.ok(Math.abs(n[1].midi - midi(flat)) < 0.25);
  assert.equal(n[1].target, 60);
  assert.ok(PE.offsetCents(n[1]) < -20 && PE.offsetCents(n[1]) > -60);
});

test('editor note: la scala cambia il bersaglio delle note non modificate', () => {
  const n = PE.segment(AA.analyze(SIG, SR), { tonic: 0, mode: 'cromatica' });
  n[0].edited = true; n[0].target = 50;
  PE.resnap(n, 0, 'maggiore');
  assert.equal(n[0].target, 50); assert.equal(n[2].target, 64);
});

test('autotune con note a mano: la nota si sposta dove voluto', () => {
  const r = AA.analyze(SIG, SR); const n = PE.segment(r, { tonic: 0, mode: 'cromatica' });
  n[2].target = n[2].target + 2; n[2].edited = true; // 330 Hz -> +2 semitoni
  const out = AT.correct(SIG, SR, { notes: n, strength: 1, retuneMs: 0, analysis: r }).samples;
  const got = medianPitch(out, n[2].t0 + 0.1, n[2].t1 - 0.05);
  assert.ok(Math.abs(got - (n[2].target)) < 0.35, `${got} vs ${n[2].target}`);
});

test('autotune con note a mano: amount 0 lascia la nota com\'era, e fuori dalle note non tocca nulla', () => {
  const r = AA.analyze(SIG, SR); const n = PE.segment(r, { tonic: 0, mode: 'cromatica' });
  n.forEach((x) => { x.amount = 0; });
  const out = AT.correct(SIG, SR, { notes: n, strength: 1, retuneMs: 0, analysis: r }).samples;
  let diff = 0; for (let i = 0; i < SIG.length; i++) diff = Math.max(diff, Math.abs(out[i] - SIG[i]));
  assert.ok(diff < 1e-3, 'differenza ' + diff);
});

test('autotune con note: la nota calante viene portata sul target', () => {
  const r = AA.analyze(SIG, SR); const n = PE.segment(r, { tonic: 0, mode: 'cromatica' });
  const before = Math.abs(medianPitch(SIG, n[1].t0 + 0.1, n[1].t1 - 0.05) - 60);
  const out = AT.correct(SIG, SR, { notes: n, strength: 1, retuneMs: 0, analysis: r }).samples;
  const after = Math.abs(medianPitch(out, n[1].t0 + 0.1, n[1].t1 - 0.05) - 60);
  assert.ok(after < before && after < 0.15, `prima ${before}, dopo ${after}`);
});

test('idee video: struttura a battute coerente con durata e tempo', () => {
  const g = VI.generate({ title: 'Torna domani', lyrics: '[Strofa]\nRiga uno\nRiga due\n\n[Ritornello]\nTorna domani\nTorna con il sole', genre: 'pop', mood: 'amore', bpm: 100, bars: 16 });
  assert.equal(g.sections.reduce((a, s) => a + s.bars, 0), 16);
  assert.equal(g.totalSeconds, 38);
  assert.equal(g.sections[0].fromBar, 1); assert.equal(g.sections[3].toBar, 16);
  assert.equal(g.sections[2].text, 'Torna domani');
  assert.equal(g.kind, 'ipotesi'); assert.ok(g.concept.palette.length >= 3);
});

test('idee video: nessun valore vuoto o indefinito con dati minimi o sconosciuti', () => {
  for (const s of [{}, { mood: 'boh', genre: 'xxx', bars: 3, bpm: 500 }]) {
    const g = VI.generate(s);
    assert.ok(!/undefined|NaN|null/.test(JSON.stringify(g)));
    assert.ok(g.sections.every((x) => x.bars >= 1 && x.seconds > 0));
    assert.equal(g.sections.reduce((a, x) => a + x.bars, 0), Math.max(4, Math.min(32, Math.round(s.bars || 16))));
  }
});
