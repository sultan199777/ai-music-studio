const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../src/lyrics-engine.js');
const LB = require('../src/lyrics-to-base.js');
const C = require('../src/clip-fx.js');

test('testo triste -> trap malinconica in minore, piano e chitarra', () => {
  const r = LB.suggest(L.analyze('Piango da solo nel buio\nIl dolore è un vuoto\nAddio, ho perduto tutto'));
  assert.equal(r.genre, 'trap'); assert.equal(r.mode, 'minore'); assert.ok(r.bpm <= 135); assert.equal(r.inst.melodia, 'piano');
  assert.equal(r.tonic, 9); assert.equal(r.confident, true); assert.ok(r.why.length >= 1);
});

test('testo di gioia -> estate in maggiore, marimba', () => {
  const r = LB.suggest(L.analyze('Danza con me sotto il sole\nSiamo felici, ridere è bello\nLa festa è la nostra luce'));
  assert.equal(r.genre, 'estate'); assert.equal(r.mode, 'maggiore'); assert.ok(r.bpm >= 95); assert.equal(r.inst.melodia, 'marimba');
});

test('testo di rabbia -> drill in minore, mai il flauto', () => {
  const r = LB.suggest(L.analyze('Urla la rabbia, odio la guerra\nBasta violenza, maledetto fuoco'));
  assert.equal(r.genre, 'drill'); assert.equal(r.mode, 'minore'); assert.notEqual(r.inst.melodia, 'flute');
});

test('testo neutro o vuoto -> melodico neutro con strumenti veri, non troppo sicuro', () => {
  const n = LB.suggest(L.analyze('Tavolo sedia finestra\nPorta armadio libro'));
  assert.equal(n.genre, 'melodico'); assert.equal(n.confident, false); assert.ok(n.inst.melodia);
  const v = LB.suggest(L.analyze(''));
  assert.equal(v.genre, 'melodico');
});

test('righe lunghe rallentano, righe corte accelerano, sempre tra 70 e 160', () => {
  const lunga = LB.suggest(L.analyze('Piango da solo nel buio di questa notte senza fine\nIl dolore mi lascia un vuoto che non passa mai più'));
  const corta = LB.suggest(L.analyze('Piango solo nel buio\nDolore e vuoto\nAddio')); // stessa emozione (tristezza), righe corte
  assert.ok(lunga.bpm >= 70 && corta.bpm <= 160);
  assert.ok(corta.bpm > lunga.bpm);
});

test('clip: battiti, battute e testo a rotazione', () => {
  const s = C.beatState(2.0, 120); // 0,5 s a battito
  assert.equal(s.beat, 4); assert.equal(s.bar, 1); assert.equal(s.beatInBar, 0); assert.ok(s.pulse > 0.99);
  assert.equal(C.beatState(0.25, 120).beat, 0);
  assert.equal(C.lyricAt(['a', 'b', 'c'], 4), 'b');
  assert.equal(C.lyricAt([], 3), '');
  assert.equal(C.lyricAt(['x', '', '  ', 'y'], 1), 'y');
});

test('clip: l\'immagine pulsa sul battito e il glitch compare solo sul primo tempo', () => {
  const on = C.frame(0.02, 120), off = C.frame(0.45, 120), beat2 = C.frame(0.52, 120);
  assert.ok(on.scale > off.scale);
  assert.ok(on.split > off.split);
  assert.ok(Math.abs(on.shakeX) + Math.abs(on.shakeY) > 0);
  assert.equal(beat2.shakeX, 0);
  for (let t = 0; t < 10; t += 0.07) { const f = C.frame(t, 100); assert.ok(Number.isFinite(f.scale) && f.scale >= 1 && f.scale < 1.1); }
});

test('testo che scorre: tempi dalle sillabe e dal modo (rap più veloce del cantato)', () => {
  const syll = L.lineSyllables;
  const lines = ['Corro di notte sotto le luci della città che non dorme mai', 'Ti amo', 'Resto qui'];
  const a = C.timeline(lines, { bpm: 140, syll, modes: { [lines[0]]: 'parla' } });
  const b = C.timeline(lines, { bpm: 140, syll, modes: { [lines[0]]: 'canta' } });
  assert.equal(a.length, 3);
  assert.ok(b[0].bars > a[0].bars, 'cantare la riga lunga richiede più battute: ' + b[0].bars + ' vs ' + a[0].bars);
  assert.equal(a[1].bars, 1, 'riga corta = 1 battuta');
  a.forEach((l, i) => { assert.ok([1, 2, 4].includes(l.bars)); if (i) assert.equal(l.start, a[i - 1].end); assert.ok(l.words[l.words.length - 1].end <= l.end + 1e-9); });
  const p = C.lineAt(a, a[1].start + 0.01); assert.equal(p.index, 1); assert.equal(p.word, 0); assert.equal(p.bar, 0);
  const q = C.lineAt(b, b[0].start + (b[0].end - b[0].start) * 0.9); assert.equal(q.bar, b[0].bars - 1);
  const f = C.timeline(lines, { bpm: 140, syll, barsPerLine: 2 }); assert.ok(f.every((l) => l.bars === 2));
});
