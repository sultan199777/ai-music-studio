const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../src/audio-analysis.js');
const K = require('../src/key-detect.js');
const T = require('../src/autotune.js');

function melody(midis, sr, perNote, amp) {
  const n = Math.floor(sr * perNote);
  const out = new Float32Array(n * midis.length);
  let ph = 0;
  midis.forEach((m, k) => {
    const f = A.midiToFreq(m);
    for (let i = 0; i < n; i++) {
      ph += 2 * Math.PI * f / sr;
      const env = Math.min(1, i / (0.01 * sr)) * Math.min(1, (n - i) / (0.01 * sr));
      out[k * n + i] = (amp || 0.4) * env * (Math.sin(ph) + 0.3 * Math.sin(2 * ph));
    }
  });
  return out;
}
const cents = (a, b) => 1200 * Math.log2(a / b);

test('tonalità: melodia in Do maggiore', () => {
  const m = [60, 64, 67, 64, 60, 67, 60, 62, 64, 65, 64, 62, 60, 60, 67, 64, 60];
  const r = K.detect(A.analyze(melody(m, 22050, 0.5), 22050).frames);
  assert.ok(r, 'nessun risultato');
  assert.equal(r.name, 'Do maggiore');
});

test('tonalità: melodia in La minore', () => {
  const m = [57, 57, 60, 64, 57, 62, 60, 59, 57, 52, 57, 60, 57, 59, 57, 55, 57, 57];
  const r = K.detect(A.analyze(melody(m, 22050, 0.5), 22050).frames);
  assert.ok(r);
  assert.equal(r.name, 'La minore');
});

test('tonalità: troppo poca voce = nessuna risposta', () => {
  assert.equal(K.detect(A.analyze(new Float32Array(22050), 22050).frames), null);
});

test('scala e quantizzazione', () => {
  const dom = T.scaleMask(0, 'maggiore');
  assert.equal(dom.filter(Boolean).length, 7);
  assert.equal(T.quantizeMidi(61.2, dom), 62); // Do# -> Re (più vicino in scala)
  assert.equal(T.quantizeMidi(60.3, dom), 60);
  assert.equal(T.quantizeMidi(60.3, T.scaleMask(0, 'cromatica')), 60);
});

test('autotune: nota calante di 30 centesimi riportata sulla nota', () => {
  const sr = 22050;
  const x = melody([57.3], sr, 2); // La3 + 30 centesimi
  const before = A.analyze(x, sr).pitch;
  assert.ok(before.meanAbsCentsFromNote > 25);
  const r = T.correct(x, sr, { tonic: 9, mode: 'cromatica', strength: 1, retuneMs: 0 });
  const after = A.analyze(r.samples, sr).pitch;
  assert.ok(after, 'nota non più riconoscibile');
  assert.ok(Math.abs(cents(after.medianHz, 220)) < 10, 'altezza ' + after.medianHz);
  assert.ok(after.meanAbsCentsFromNote < 10, 'scostamento ' + after.meanAbsCentsFromNote);
  assert.equal(r.samples.length, x.length);
});

test('autotune in scala: una nota stonata va sulla nota di scala più vicina', () => {
  const sr = 22050;
  const x = melody([61.3], sr, 2); // vicino a Do#, che non è in Do maggiore
  const r = T.correct(x, sr, { tonic: 0, mode: 'maggiore', strength: 1, retuneMs: 0 });
  const after = A.analyze(r.samples, sr).pitch;
  assert.ok(after);
  assert.equal(after.medianNote, 'Re4'); // 62 è la nota di scala più vicina a 61,3
  assert.ok(Math.abs(cents(after.medianHz, A.midiToFreq(62))) < 15);
});

test('autotune: la voce di esempio con vibrato diventa molto più precisa', () => {
  const sr = 22050;
  const x = A.synthExample(sr);
  const before = A.analyze(x, sr).pitch.meanAbsCentsFromNote;
  const r = T.correct(x, sr, { mode: 'cromatica', strength: 1, retuneMs: 0 });
  const after = A.analyze(r.samples, sr).pitch.meanAbsCentsFromNote;
  assert.ok(after < before * 0.6, 'prima ' + before.toFixed(1) + ' dopo ' + after.toFixed(1));
  assert.ok(r.stats.runs >= 1 && r.stats.correctedSeconds > 1);
  let finite = true; for (const v of r.samples) if (!Number.isFinite(v)) finite = false;
  assert.ok(finite);
});

test('autotune: intensità 0 non cambia nulla', () => {
  const x = melody([57.3], 22050, 1);
  const r = T.correct(x, 22050, { strength: 0 });
  assert.deepEqual(Array.from(r.samples.slice(0, 200)), Array.from(x.slice(0, 200)));
});

test('autotune: rumore e silenzio restano invariati', () => {
  const x = new Float32Array(22050);
  const r = T.correct(x, 22050, { strength: 1 });
  assert.equal(r.stats.runs, 0);
  assert.ok(r.samples.every((v) => v === 0));
});

test('autotune: velocità morbida corregge meno in fretta della velocità robot', () => {
  const sr = 22050;
  const x = A.synthExample(sr);
  const hard = T.correct(x, sr, { mode: 'cromatica', retuneMs: 0 });
  const soft = T.correct(x, sr, { mode: 'cromatica', retuneMs: 250 });
  const h = A.analyze(hard.samples, sr).pitch.meanAbsCentsFromNote;
  const s = A.analyze(soft.samples, sr).pitch.meanAbsCentsFromNote;
  assert.ok(h <= s + 1, 'robot ' + h.toFixed(1) + ' morbida ' + s.toFixed(1));
});

test('autotune: vibrato naturale conservato rispetto all\'effetto robot', () => {
  const sr = 22050;
  const x = A.synthExample(sr);
  const robot = T.correct(x, sr, { mode: 'cromatica', strength: 1, retuneMs: 0, vibrato: 0 });
  const natural = T.correct(x, sr, { mode: 'cromatica', strength: 1, retuneMs: 0, vibrato: 1 });
  const dev = (s) => A.analyze(s, sr).pitch.meanAbsCentsFromNote;
  const before = dev(x), r = dev(robot.samples), n = dev(natural.samples);
  assert.ok(r < before, 'robot ' + r.toFixed(1) + ' prima ' + before.toFixed(1));
  assert.ok(n > r, 'con vibrato (' + n.toFixed(1) + ') deve restare più mosso del robot (' + r.toFixed(1) + ')');
  assert.ok(Math.abs(natural.stats.meanShiftCents) < Math.abs(robot.stats.meanShiftCents) + 1);
});

test('armonia: due gradini sopra nella scala (La -> Do in Do maggiore)', () => {
  const sr = 22050;
  const x = melody([57], sr, 2); // La3
  const r = T.correct(x, sr, { tonic: 0, mode: 'maggiore', strength: 1, retuneMs: 0, vibrato: 1, harmonyDegrees: 2 });
  const p = A.analyze(r.samples, sr).pitch;
  assert.ok(p);
  assert.equal(p.medianNote, 'Do4');
  assert.ok(Math.abs(cents(p.medianHz, A.midiToFreq(60))) < 20, 'altezza ' + p.medianHz);
  assert.equal(T.stepUp(57, 2, T.scaleMask(0, 'maggiore')), 60);
  assert.equal(T.stepUp(60, 2, T.scaleMask(0, 'maggiore')), 64);
});

test('spostamento creativo: +7 semitoni porta il La3 al Mi4', () => {
  const sr = 22050, x = melody([57], sr, 2);
  const r = T.correct(x, sr, { mode: 'cromatica', strength: 1, retuneMs: 0, vibrato: 1, shiftSemitones: 7 });
  const p = A.analyze(r.samples, sr).pitch;
  assert.ok(p);
  assert.ok(Math.abs(cents(p.medianHz, A.midiToFreq(64))) < 25, 'altezza ' + p.medianHz);
});
