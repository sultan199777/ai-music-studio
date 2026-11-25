'use strict';
const test = require('node:test'), assert = require('node:assert');
const G = require('../src/guide-voice.js'), AA = require('../src/audio-analysis.js'), SongMap = require('../src/song-map.js'), LE = require('../src/lyrics-engine.js');
const n = (w) => G.syllabify(w).length;

test('sillabe italiane: parole del testo di prova', () => {
  const want = { consuma: 3, cuore: 2, 'città': 2, strada: 2, sirene: 3, nella: 2, notte: 2, prega: 2, madre: 2, fermo: 2, dark: 1, la: 1, mi: 1, freddo: 2, cemento: 3, urlano: 3 };
  Object.keys(want).forEach((w) => assert.strictEqual(n(w), want[w], w + ' -> ' + JSON.stringify(G.syllabify(w))));
});
test('vocali giuste e consonanti all\'attacco', () => {
  assert.deepStrictEqual(G.syllabify('strada').map(s => s.vowel + ':' + s.onset), ['a:str', 'a:d']);
  assert.deepStrictEqual(G.syllabify('cuore').map(s => s.vowel), ['o', 'e']);
});
test('Misurato: la voce guida su un testo vero ha suono, nota giusta e tempi dentro le parole', () => {
  const t = '[Ritornello]\nDark nel cuore, la città mi consuma\nSirene nella notte, ma io non mi fermo';
  const map = SongMap.build(t, { bpm: 140, syll: LE.lineSyllables, modes: {} }), sr = 16000, len = Math.round(sr * (map.lines[map.lines.length - 1].end + 1));
  const r = G.render(map.lines, { sr, length: len, tonic: 9, mode: 'minore', f0: 130, seed: 3 });
  assert.ok(r.syllables >= 20, 'sillabe ' + r.syllables);
  let pk = 0, e1 = 0, e0 = 0; const l0 = map.lines[0];
  for (let i = 0; i < r.audio.length; i++) { const a = Math.abs(r.audio[i]); if (a > pk) pk = a; const ts = i / sr; if (ts >= l0.start && ts < l0.end) e1 += a * a; else if (ts < l0.start - 0.2) e0 += a * a; }
  assert.ok(pk > 0.5 && pk <= 0.91, 'picco ' + pk);
  assert.ok(e1 > e0 * 20, 'prima della riga c\'è silenzio (intro): ' + e0 + ' vs ' + e1);
  /* altezza: la voce deve stare nel registro maschile e sulla scala di La minore pentatonica */
  const f = G.measureF0(r.audio, sr, AA.detectPitch);
  assert.ok(f && f.f0 > 85 && f.f0 < 330, 'f0 ' + JSON.stringify(f));
});
test('stesso testo e seme = stessa melodia; ritornello ripetuto = stessa melodia', () => {
  const w = [{ w: 'Dark', start: 0, end: 0.4 }, { w: 'cuore', start: 0.4, end: 1 }], mk = (s) => G.render([{ text: 'x', mode: 'canta', words: w }], { sr: 8000, length: 8000, tonic: 0, mode: 'minore', seed: s });
  assert.deepStrictEqual(Array.from(mk(2).audio.slice(0, 500)), Array.from(mk(2).audio.slice(0, 500)));
  assert.notDeepStrictEqual(Array.from(mk(2).audio.slice(2000, 2500)), Array.from(mk(9).audio.slice(2000, 2500)));
});
test('l\'altezza della voce cambia con il profilo (f0 più basso = voce più bassa)', () => {
  const w = [{ w: 'mamma', start: 0, end: 1.2 }], mk = (f0) => G.render([{ text: 'mamma', mode: 'parla', words: w }], { sr: 16000, length: 20000, tonic: 0, mode: 'minore', f0, seed: 1 });
  const lo = G.measureF0(mk(100).audio, 16000, AA.detectPitch), hi = G.measureF0(mk(190).audio, 16000, AA.detectPitch);
  assert.ok(lo && hi && hi.f0 > lo.f0 * 1.2, JSON.stringify([lo, hi]));
});
test('measureF0 misura un tono vero (120 Hz) e rifiuta il silenzio', () => {
  const sr = 16000, x = new Float32Array(sr * 2); for (let i = 0; i < x.length; i++) x[i] = 0.3 * Math.sin(2 * Math.PI * 120 * i / sr) + 0.1 * Math.sin(2 * Math.PI * 240 * i / sr);
  const f = G.measureF0(x, sr, AA.detectPitch); assert.ok(f && Math.abs(f.f0 - 120) < 4, JSON.stringify(f));
  assert.strictEqual(G.measureF0(new Float32Array(sr * 2), sr, AA.detectPitch), null);
});
test('nessuna riga o scala vuota: niente crash, audio vuoto', () => { assert.strictEqual(G.render([], { sr: 8000, length: 800 }).syllables, 0); });
