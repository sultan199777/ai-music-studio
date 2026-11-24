const test = require('node:test'), assert = require('node:assert');
const SD = require('../src/synth-design.js'), A = require('../src/arranger.js');
const sr = 22050;
const f0 = (y, a, b) => { let z = 0; for (let i = a + 1; i < b; i++) if (y[i - 1] < 0 && y[i] >= 0) z++; return z / ((b - a) / sr); };
test('synth: suona la nota giusta, la posizione cambia il timbro, il rilascio allunga', () => {
  const a = SD.synth({ pos: 0, voices: 1, cutoff: 1, lfo: 0 }, 69, 0.5, sr);
  assert.ok(Math.abs(f0(a, 2000, 8000) - 440) < 8, 'freq ' + f0(a, 2000, 8000));
  const b = SD.synth({ pos: 0.66, voices: 1, cutoff: 1, lfo: 0 }, 69, 0.5, sr);
  let d = 0; for (let i = 2000; i < 6000; i++) d += (a[i] - b[i]) ** 2; assert.ok(d > 1, 'timbro diverso');
  assert.ok(SD.synth({ release: 1 }, 60, 0.5, sr).length > SD.synth({ release: 0.1 }, 60, 0.5, sr).length);
  assert.ok(Object.keys(SD.SYNTH_PRESETS).length >= 5);
});
test('808 designer: nota giusta, decadimento e glide', () => {
  const y = SD.b808({ punch: 0, click: 0, decay: 2 }, 36, 1.5, sr);
  assert.ok(Math.abs(f0(y, sr * 0.3, sr * 1.2) - 65.4) < 3, '808 ' + f0(y, sr * 0.3, sr * 1.2));
  const s = SD.b808({ punch: 0, click: 0 }, 41, 1, sr, 36, 0.1);
  assert.ok(f0(s, 0, sr * 0.08) < f0(s, sr * 0.5, sr * 0.9), 'glide sale');
  const short = SD.b808({ decay: 0.2 }, 36, 1.5, sr), long = SD.b808({ decay: 3 }, 36, 1.5, sr);
  const e = (x) => { let t = 0; for (let i = sr; i < sr * 1.4; i++) t += x[i] * x[i]; return t; };
  assert.ok(e(long) > e(short) * 10);
});
test('effetti: riser cresce, impact cala, reverse finisce forte', () => {
  const e = (x, a, b) => { let t = 0; for (let i = a; i < b; i++) t += x[i] * x[i]; return t; };
  const r = SD.riser(2, sr); assert.ok(e(r, r.length - 4000, r.length) > e(r, 0, 4000) * 10);
  const im = SD.impact(sr); assert.ok(e(im, 0, 4000) > e(im, im.length - 4000, im.length) * 10);
  const rv = SD.reverseCrash(1, sr); assert.ok(e(rv, rv.length - 2000, rv.length) > e(rv, 0, 2000) * 5);
});
test('arrangiatore: 808 dal designer ed effetti a mano finiscono nella base', () => {
  const base = { sampleRate: 8000, bpm: 140, genre: 'trap', bars: 4, seed: 2, sounds: 'sint', bassStyle: '808' };
  let calls = 0; const g = A.generate(Object.assign({}, base, { bassRender: (m, d, s2, from, gl) => { calls++; return SD.b808({ decay: 0.3 }, m, d, s2, from, gl); } }));
  assert.ok(calls > 0, '808 del designer usato');
  const h = A.generate(Object.assign({}, base, { extraFx: [{ bar: 2, buf: SD.impact(8000), end: false }] })), ref = A.generate(base);
  const bar = Math.round(240 / 140 * 8000); let d = 0; for (let i = 2 * bar; i < 2 * bar + 4000; i++) d += Math.abs(h.tracks.fx[i] - ref.tracks.fx[i]);
  assert.ok(d > 10, 'impact alla battuta 3');
});
test('percussioni del mondo, 808 pronti e strumento dalla voce', () => {
  assert.strictEqual(Object.keys(SD.PERC).length, 5); assert.ok(Object.keys(SD.B808_PRESETS).length >= 5);
  const ev = SD.percEvents('conga', [{ name: 'strofa', startBar: 2, bars: 2 }, { name: 'intro', startBar: 0, bars: 2 }], sr, ['strofa']);
  assert.strictEqual(ev.length, 10); assert.ok(ev.every(e => e.bar >= 2 && e.track === 'hat' && e.buf.length > 100));
  // voce a 220 Hz (La3 = 57) → suonata come Mi4 (64) deve stare a ~329.6 Hz
  const seg = Float32Array.from({ length: sr * 0.5 }, (_, i) => 0.5 * Math.sin(2 * Math.PI * 220 * i / sr)), inst = SD.voiceInstrument(seg, sr, 57), y = inst(64, 1.2, sr);
  assert.strictEqual(y.length, Math.round(1.2 * sr)); assert.ok(Math.abs(f0(y, 2000, sr) - 329.6) < 6, 'nota ' + f0(y, 2000, sr));
  const A2 = require('../src/arranger.js'), g = A2.generate({ sampleRate: 8000, bpm: 100, genre: 'melodico', bars: 4, seed: 1, sounds: 'sint', extraFx: [{ bar: 1, step: 4, buf: new Float32Array(400).fill(0.5), track: 'hat' }] });
  const at = Math.round((240 / 100) * 8000 + 4 * (240 / 100 / 16) * 8000); assert.ok(Math.abs(g.tracks.hat[at + 10]) > 0.2, 'colpo sul passo giusto');
});
