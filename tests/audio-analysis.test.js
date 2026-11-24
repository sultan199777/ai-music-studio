const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../src/audio-analysis.js');

function sine(freq, seconds, sr, amp) {
  const n = Math.floor(sr * seconds);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = (amp || 0.5) * Math.sin(2 * Math.PI * freq * i / sr);
  return out;
}

const cents = (a, b) => 1200 * Math.log2(a / b);

test('riconosce un La3 (220 Hz) con errore sotto 10 centesimi', () => {
  const r = A.analyze(sine(220, 1.5, 22050), 22050);
  assert.ok(r.pitch, 'pitch assente');
  assert.ok(Math.abs(cents(r.pitch.medianHz, 220)) < 10, 'mediana ' + r.pitch.medianHz);
  assert.equal(r.pitch.medianNote, 'La3');
  assert.ok(r.voicedShare > 0.9);
  assert.ok(r.pitch.meanAbsCentsFromNote < 10);
});

test('riconosce frequenze diverse (110, 330, 440 Hz) a 44,1 kHz', () => {
  for (const f of [110, 330, 440]) {
    const r = A.analyze(sine(f, 1.5, 44100), 44100);
    assert.ok(r.pitch, 'pitch assente a ' + f);
    assert.ok(Math.abs(cents(r.pitch.medianHz, f)) < 15, f + ' Hz -> ' + r.pitch.medianHz);
  }
});

test('misura lo scostamento da una nota calante di circa 40 centesimi', () => {
  const f = A.midiToFreq(60.4); // Do4 + 40 centesimi
  const r = A.analyze(sine(f, 1.5, 22050), 22050);
  assert.ok(r.pitch);
  assert.ok(Math.abs(r.pitch.meanAbsCentsFromNote - 40) < 10, 'scostamento ' + r.pitch.meanAbsCentsFromNote);
  assert.ok(r.pitch.meanSignedCents > 25, 'segno ' + r.pitch.meanSignedCents);
});

test('silenzio: nessuna voce, nessun errore', () => {
  const r = A.analyze(new Float32Array(22050 * 2), 22050);
  assert.equal(r.voicedShare, 0);
  assert.equal(r.pitch, null);
  assert.ok(r.levels.peakDb < -100);
});

test('rumore casuale: quasi nessun frame viene dichiarato voce', () => {
  let seed = 12345;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) % 4294967296; return seed / 4294967296 * 2 - 1; };
  const n = 22050 * 2;
  const x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = 0.3 * rnd();
  const r = A.analyze(x, 22050);
  assert.ok(r.voicedShare < 0.2, 'voce stimata ' + r.voicedShare);
});

test('rileva il clipping', () => {
  const x = sine(220, 1, 22050, 2.0); // oltre il fondo scala
  for (let i = 0; i < x.length; i++) x[i] = Math.max(-1, Math.min(1, x[i]));
  const r = A.analyze(x, 22050);
  assert.ok(r.levels.clippingShare > 0.1);
  assert.ok(Math.abs(r.levels.peakDb) < 0.1);
});

test('segnale di esempio: quattro note, estensione Do4-Sol4 circa', () => {
  const r = A.analyze(A.synthExample(22050), 22050);
  assert.ok(r.pitch);
  assert.ok(r.voicedShare > 0.6, 'voce ' + r.voicedShare);
  assert.ok(r.pitch.spanSemitones > 5 && r.pitch.spanSemitones < 9, 'estensione ' + r.pitch.spanSemitones);
  assert.ok(r.pitch.meanAbsCentsFromNote > 5, 'il vibrato e la nota calante devono vedersi');
});

test('accetta più canali e tronca i file lunghi', () => {
  const ch = sine(220, 3, 8000);
  const r = A.analyze([ch, ch], 8000, { maxSeconds: 1 });
  assert.equal(r.truncated, true);
  assert.ok(Math.abs(r.duration - 1) < 0.01);
  assert.ok(r.pitch);
});
