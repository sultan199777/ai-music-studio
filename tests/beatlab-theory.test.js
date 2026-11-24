const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../src/beatlab-engine.js');
const P = require('../src/beatlab-patterns.js');
require('../src/beatlab-sampler.js');
const T = require('../src/beatlab-theory.js');

test('nomi delle note: Do Re Mi con la lettera', () => {
  assert.equal(T.noteName(60), 'Do (C)'); assert.equal(T.noteName(62), 'Re (D)'); assert.equal(T.noteName(64), 'Mi (E)'); assert.equal(T.noteName(69), 'La (A)'); assert.equal(T.noteName(70), 'La# (A#)'); assert.equal(T.noteFull(60), 'Do (C)4');
});
test('blocco sulla scala: ogni nota proposta cade nella scala, per tutte le tonalita\' e scale', () => {
  for (const sc of Object.keys(P.SCALES)) for (let root = 0; root < 12; root++) {
    const key = { root, scale: sc }, ok = new Set(P.SCALES[sc]);
    for (let m = 24; m <= 100; m++) { const s = T.snapToScale(key, m); assert.ok(ok.has(((s - root) % 12 + 12) % 12), `${sc} ${root} ${m}->${s}`); assert.ok(Math.abs(s - m) <= 2, 'distanza'); if (T.inScale(key, m)) assert.equal(s, m); }
    const notes = T.scaleNotes(key, 48, 83); assert.ok(notes.every((n) => T.inScale(key, n))); assert.equal(notes.length, Math.round(P.SCALES[sc].length * 3), sc + ' note in 3 ottave');
  }
  assert.equal(T.snapToScale({ root: 0, scale: 'major' }, 61), 62); // Do# in Do maggiore -> sale a Re
});
test('accordi: note della scala, ordinate, nome corretto; progressioni per atmosfera', () => {
  const key = { root: 0, scale: 'minor' };
  assert.deepEqual(T.chord(key, 0, 60).map((n) => n % 12).sort((a, b) => a - b), [0, 3, 7]); assert.equal(T.chordName(key, 0), 'Do min'); assert.equal(T.chordName(key, 5), 'Sol# magg'); assert.equal(T.chordName({ root: 0, scale: 'major' }, 4), 'Sol magg');
  for (const id of Object.keys(T.MOODS)) {
    const M = T.MOODS[id]; assert.ok(M.desc.length > 20 && M.desc.length < 90); const k = { root: 2, scale: M.scale };
    for (const d of M.prog) { const c = T.chord(k, d, 60, true); assert.equal(c.length, 4); assert.ok(c.every((n) => T.inScale(k, n))); for (let i = 1; i < c.length; i++) assert.ok(c[i] > c[i - 1]); }
  }
  for (const id of ['cupa', 'malinconica', 'luminosa', 'epica']) assert.ok(T.MOODS[id], id);
  const p = E.newProject({ bars: 4 }); p.key = { root: 0, scale: 'minor' }; const tr = E.newInstTrack('piano', 'P'); p.tracks.push(tr); const out = T.writeProgression(p, tr, 'malinconica');
  assert.equal(out.length, 12); assert.ok(tr.notes.every((n) => T.inScale(p.key, n.n) && n.t % E.BAR === 0 && n.d < E.BAR)); assert.deepEqual(T.chordRow(p, 'malinconica').map((c) => c.name), ['Do min', 'Sol# magg', 'Re# magg', 'La# magg']);
});
test('piano roll: aggiungi, quantizza, sposta, ridimensiona, cancella, velocity, blocco sulla scala', () => {
  const p = E.newProject({ bars: 2 }); p.key = { root: 0, scale: 'minor' }; const tr = E.newInstTrack('piano', 'P');
  const n = T.addNote(p, tr, 30, 61, { quant: '1/16' }); assert.equal(n.t, 24); assert.ok(T.inScale(p.key, n.n)); assert.equal(n.n, 62 - 0 === 62 && T.inScale(p.key, 62) ? 62 : n.n);
  const n2 = T.addNote(p, tr, 30, 61, { quant: '1/16', lock: false }); assert.equal(n2.n, 61);
  assert.equal(T.snapTick(37, '1/8'), 48); assert.equal(T.snapTick(37, '1/32'), 36); assert.equal(T.snapTick(40, 'tr'), 32); assert.equal(T.snapTick(5, '1/4'), 0);
  assert.equal(T.addNote(p, tr, 99999, 60, {}).t < E.loopTicks(p), true, 'oltre la fine rientra nel loop');
  const m = T.moveNote(p, n2, 50, 2, { quant: '1/16' }); assert.equal(m.t, 72); assert.ok(T.inScale(p.key, m.n));
  T.resizeNote(p, m, 100, '1/8'); assert.equal(m.d, 96); T.resizeNote(p, m, 1e6, '1/8'); assert.ok(m.t + m.d <= E.loopTicks(p)); T.setVelocity(m, 999); assert.equal(m.v, 127);
  assert.equal(T.noteAt(tr, m.t + 1, m.n), m); assert.equal(T.removeNote(tr, m), true); assert.equal(T.noteAt(tr, m.t + 1, m.n), null);
  const t2 = E.newInstTrack('piano', 'Q'); t2.notes = [{ t: 13, d: 20, n: 60, v: 90 }, { t: 200, d: 20, n: 64, v: 90 }]; T.quantizeAll(p, t2, '1/16'); assert.deepEqual(t2.notes.map((x) => x.t), [24, 192]);
  // sostituzione di nota identica nello stesso istante
  const t3 = E.newInstTrack('piano', 'R'); T.addNote(p, t3, 0, 60, { lock: false }); T.addNote(p, t3, 0, 60, { lock: false, vel: 50 }); assert.equal(t3.notes.length, 1); assert.equal(t3.notes[0].v, 50);
});
test('Impara: ogni controllo ha titolo e 1-2 righe di spiegazione', () => {
  for (const k of Object.keys(T.LEARN)) { const L = T.LEARN[k]; assert.ok(L.t && L.d.length > 40 && L.d.length < 260, k); assert.ok((L.d.match(/[.!?](\s|$)/g) || []).length <= 3, k + ' troppo lunga'); }
  for (const k of ['bpm', 'swing', 'style', 'kick', 'snare', 'hat', 'velocity', '808', 'scale', 'chords', 'pianoroll', 'quant', 'mixer', 'inst']) assert.ok(T.LEARN[k], k);
});
