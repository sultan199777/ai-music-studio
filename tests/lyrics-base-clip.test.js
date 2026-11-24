const test = require('node:test');
const assert = require('node:assert/strict');
const L = require('../src/lyrics-engine.js');
const LB = require('../src/lyrics-to-base.js');
const C = require('../src/clip-fx.js');

test('testo triste -> lo-fi in minore e lento', () => {
  const r = LB.suggest(L.analyze('Piango da solo nel buio\nIl dolore è un vuoto\nAddio, ho perduto tutto'));
  assert.equal(r.genre, 'lofi'); assert.equal(r.mode, 'minore'); assert.ok(r.bpm <= 90);
  assert.equal(r.tonic, 9); assert.equal(r.confident, true); assert.ok(r.why.length >= 1);
});

test('testo di gioia -> dance in maggiore e veloce', () => {
  const r = LB.suggest(L.analyze('Danza con me sotto il sole\nSiamo felici, ridere è bello\nLa festa è la nostra luce'));
  assert.equal(r.genre, 'dance'); assert.equal(r.mode, 'maggiore'); assert.ok(r.bpm >= 115);
});

test('testo di rabbia -> hip-hop in minore', () => {
  const r = LB.suggest(L.analyze('Urla la rabbia, odio la guerra\nBasta violenza, maledetto fuoco'));
  assert.equal(r.genre, 'hiphop'); assert.equal(r.mode, 'minore');
});

test('testo neutro o vuoto -> pop neutro, non troppo sicuro', () => {
  const n = LB.suggest(L.analyze('Tavolo sedia finestra\nPorta armadio libro'));
  assert.equal(n.genre, 'pop'); assert.equal(n.confident, false);
  const v = LB.suggest(L.analyze(''));
  assert.equal(v.genre, 'pop');
});

test('righe lunghe rallentano, righe corte accelerano, sempre tra 70 e 160', () => {
  const lunga = LB.suggest(L.analyze('Cammino da solo sotto la luna piena di ricordi lontani\nIl vento mi racconta storie di amore perduto nel tempo'));
  const corta = LB.suggest(L.analyze('Amore\nCuore\nBaci'));
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
