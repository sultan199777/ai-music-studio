'use strict';
const test = require('node:test'), assert = require('node:assert');
const Brain = require('../src/sultan-brain.js'), L = require('../src/lyrics-engine.js'), Remix = require('../src/remix.js');
const TXT = '[Strofa]\nNotte in strada, sirene che urlano\nMia madre prega, io corro nel buio\n[Ritornello]\nDark nel cuore, la città mi consuma';

test('uno stile scelto dalla lista resta, anche con tante versioni', () => {
  const an = L.analyze(TXT);
  for (let v = 0; v < 8; v++) assert.strictEqual(Brain.plan(TXT, an, { variant: v, forceGenre: 'drill' }).genre, 'drill');
});
test('con lo stile bloccato le versioni cambiano comunque ritmo e melodia (Remix)', () => {
  const an = L.analyze(TXT), sig = new Set(), mel = new Set();
  for (let v = 0; v < 10; v++) { const pl = Brain.plan(TXT, an, { variant: v, forceGenre: 'trapdark' }); const r = Remix.make(pl.seed + v * 7919, { heavy: pl.heavy, mode: pl.mode }); sig.add(JSON.stringify(r.groove)); mel.add(r.melSeed); }
  assert.strictEqual(sig.size, 10); assert.strictEqual(mel.size, 10);
});
test('i nuovi umori funzionano e spingono gli stili giusti', () => {
  const an = L.analyze(TXT);
  assert.strictEqual(Brain.plan(TXT, an, { mood: 'emo', variant: 0 }).genre, 'emorap');
  assert.ok(['phonk', 'trapdark', 'drill', 'brooklyn'].indexOf(Brain.plan(TXT, an, { mood: 'horror', variant: 0 }).genre) >= 0);
  assert.strictEqual(Brain.plan(TXT, an, { mood: 'sognante', variant: 0 }).moodTarget, 'sognante');
});
test('lo stile scritto a mano (es. drill) non cambia nelle versioni', () => {
  const an = L.analyze(TXT);
  for (let v = 0; v < 6; v++) assert.strictEqual(Brain.plan(TXT, an, { variant: v, styleText: 'drill malinconica' }).genre, 'drill');
});
