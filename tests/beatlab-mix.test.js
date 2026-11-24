'use strict';
const test = require('node:test'), assert = require('node:assert');
const E = require('../src/beatlab-engine.js'), P = require('../src/beatlab-patterns.js'), M = require('../src/beatlab-mix.js'), MI = require('../src/beatlab-midi.js'), S = require('../src/beatlab-store.js');

function sine(f, amp, sec, sr) { const a = new Float32Array(sec * sr); for (let i = 0; i < a.length; i++) a[i] = amp * Math.sin(2 * Math.PI * f * i / sr); return a; }

test('LUFS: seno 1 kHz stereo, picco -23 dBFS: -26.0 per canale (RMS -26.02 + pesatura K ~+0.7 -0.69) +3.01 per due canali = circa -22.9', () => {
  const sr = 48000, a = sine(1000, Math.pow(10, -23 / 20), 6, sr), l = M.lufs([a, a], sr);
  assert.ok(Math.abs(l + 22.93) < 0.15, 'lufs ' + l); assert.ok(Math.abs(M.lufs([a], sr) + 25.94) < 0.15);
});
test('LUFS: raddoppiare l\'ampiezza alza di 6 dB; silenzio = -Infinity', () => {
  const sr = 48000, a = sine(1000, 0.1, 5, sr), b = sine(1000, 0.2, 5, sr);
  assert.ok(Math.abs(M.lufs([b], sr) - M.lufs([a], sr) - 6.02) < 0.05);
  assert.strictEqual(M.lufs([new Float32Array(sr * 3)], sr), -Infinity);
});
test('picchi: true peak >= picco campionato; valori noti', () => {
  const sr = 44100, a = sine(11025, 1, 1, sr); // 4 campioni per ciclo con fase: picco campionato < 1
  const r = M.peaks([a]); assert.ok(r.truePeakDb >= r.peakDb - 1e-9 && r.truePeakDb <= 0.5);
  const b = sine(100, 0.5, 1, sr); assert.ok(Math.abs(M.peaks([b]).peakDb + 6.02) < 0.05);
});
test('preset: valori nei limiti, 808 con sidechain, hat senza', () => {
  const p = P.applyStyle(E.newProject(), 'trap'); const t = E.newInstTrack('sub808'); p.tracks.push(t);
  M.applyPresets(p);
  p.tracks.forEach(tr => { const f = tr.fx; assert.ok(f && Math.abs(f.eq.low) <= 15); ['sat', 'comp', 'sc', 'rev', 'dly'].forEach(k => assert.ok(f[k] >= 0 && f[k] <= 1)); });
  assert.ok(t.fx.sc > 0 && t.fx.sat > 0); assert.strictEqual(E.trackById(p, 'd-hat').fx.sc, 0);
});
test('ducking: eventi di cassa -> pianifica abbassamento su tracce con sc>0, non sulla cassa', () => {
  const calls = []; const mk = () => ({ cancelScheduledValues() {}, setValueAtTime: (v, t) => calls.push(['set', v, t]), linearRampToValueAtTime: (v, t) => calls.push(['ramp', v, t]) });
  const p = E.newProject(); const b = E.newInstTrack('sub808'); p.tracks.push(b); b.fx = E.defaultFx(); b.fx.sc = 1; E.trackById(p, 'd-kick').fx = Object.assign(E.defaultFx(), { sc: 1 });
  const G = { tracks: { [b.id]: { duck: { gain: mk() } }, 'd-kick': { duck: { gain: mk() } } } };
  E.duckAt(G, p, 2);
  assert.strictEqual(calls.length, 2); assert.ok(calls[0][1] < 0.3 && calls[0][2] === 2); assert.strictEqual(calls[1][1], 1); assert.ok(calls[1][2] > 2.04);
});
test('MIDI: file valido, tipo 1, ppq 96, note come nel progetto, batteria su canale 10', () => {
  const p = P.applyStyle(E.newProject({ swing: 50 }), 'trap'); p.bpm = 120; p.swing = 50; const t = E.newInstTrack('piano'); t.notes = [{ t: 0, d: 96, n: 60, v: 90, s: 0 }, { t: 192, d: 48, n: 64, v: 100, s: 0 }]; p.tracks.push(t);
  const u8 = MI.toMidi(p), m = MI.parse(u8);
  assert.strictEqual(m.format, 1); assert.strictEqual(m.ppq, 96); assert.strictEqual(m.tempo, 500000); assert.strictEqual(m.ntrks, m.tracks.length); m.tracks.forEach(x => assert.ok(x.ended));
  const dr = m.tracks.filter(x => x.name === 'Batteria')[0]; assert.ok(dr); const ons = dr.events.filter(e => e.type === 'on'); assert.ok(ons.length > 10); ons.forEach(e => assert.strictEqual(e.ch, 9));
  const kicks = E.eventsInRange(p, 0, E.BAR * p.bars).filter(e => e.type === 'drum' && e.lane === 'kick').length; assert.strictEqual(ons.filter(e => e.note === 36).length, kicks);
  const pn = m.tracks[m.tracks.length - 1]; const pon = pn.events.filter(e => e.type === 'on');
  assert.deepStrictEqual(pon.map(e => [e.t, e.note, e.vel]), [[0, 60, 90], [192, 64, 100]]);
  const off = pn.events.filter(e => e.type === 'off'); assert.deepStrictEqual(off.map(e => e.t), [96, 240]);
});
test('MIDI: lo swing sposta i levare', () => {
  const p = P.applyStyle(E.newProject({ swing: 66 }), 'boombap'); const t = E.newInstTrack('piano'); t.notes = [{ t: 24, d: 24, n: 60, v: 90 }]; p.tracks.push(t);
  const m = MI.parse(MI.toMidi(p)); const on = m.tracks[m.tracks.length - 1].events.filter(e => e.type === 'on')[0]; assert.ok(on.t > 24);
});
test('MIDI: file rovinato -> errore, non crash', () => { assert.throws(() => MI.parse(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]))); });
test('sanitize: ripara valori assurdi, mantiene un progetto buono', () => {
  const p = P.applyStyle(E.newProject(), 'drill'); M.applyPresets(p); const q = S.sanitize(JSON.parse(JSON.stringify(p)));
  assert.deepStrictEqual(q.tracks.map(t => t.steps || t.notes), p.tracks.map(t => t.steps || t.notes)); assert.strictEqual(q.bpm, p.bpm);
  assert.deepStrictEqual(q.tracks.map(t => t.fx), p.tracks.map(t => t.fx));
  const bad = S.sanitize({ bpm: 9999, swing: 'x', bars: 99, res: 7, tracks: [{ kind: 'drum', lane: 'kick', steps: [500, -3, 'a'], roll: [9], vol: 50, pan: -9, fx: { eq: { low: 99 }, sat: 5 } }, { kind: 'boh' }, null, { kind: 'inst', inst: 'inesistente', notes: [{ t: -5, d: 0, n: 999, v: 0 }] }], master: { vol: 99 } });
  assert.strictEqual(bad.bpm, 240); assert.strictEqual(bad.swing, 50); assert.strictEqual(bad.bars, 16); assert.strictEqual(bad.res, 16);
  const k = bad.tracks[0]; assert.strictEqual(k.steps.length, 256); assert.strictEqual(k.steps[0], 127); assert.strictEqual(k.steps[1], 0); assert.strictEqual(k.steps[2], 0); assert.strictEqual(k.roll[0], 4);
  assert.strictEqual(k.vol, 1.5); assert.strictEqual(k.pan, -1); assert.strictEqual(k.fx.eq.low, 15); assert.strictEqual(k.fx.sat, 1);
  const n = bad.tracks[1].notes[0]; assert.strictEqual(n.t, 0); assert.ok(n.d >= 1 && n.n === 127 && n.v === 1); assert.strictEqual(bad.master.vol, 1.2);
  assert.throws(() => S.sanitize(null));
});
test('store senza IndexedDB: salva/elenca/carica/cancella via localStorage', async () => {
  const mem = {}; const ls = { get length() { return Object.keys(mem).length; }, key: i => Object.keys(mem)[i], getItem: k => mem[k], setItem: (k, v) => { mem[k] = String(v); }, removeItem: k => { delete mem[k]; } };
  // il modulo usa root (globalThis nel test): simuliamo localStorage
  globalThis.localStorage = ls; const SS = require('../src/beatlab-store.js');
  const p = P.applyStyle(E.newProject({ name: 'Prova' }), 'trap'); const id = await SS.save(p); const l = await SS.list(); assert.strictEqual(l.length, 1); assert.strictEqual(l[0].name, 'Prova');
  const q = await SS.load(id); assert.strictEqual(q.name, 'Prova'); await SS.remove(id); assert.strictEqual((await SS.list()).length, 0); delete globalThis.localStorage;
});
