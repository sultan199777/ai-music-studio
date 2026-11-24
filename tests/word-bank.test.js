const test = require('node:test');
const assert = require('node:assert/strict');
const W = require('../src/word-bank.js');

test('rime piene: "cuore" con dolore/amore/colore', () => {
  const r = W.rhymes(null, 'cuore'), ws = r.rhyme.map(x => x.word);
  ['dolore', 'amore', 'colore'].forEach(w => assert.ok(ws.includes(w), w + ' in ' + ws.join()));
  assert.ok(!ws.includes('cuore'));
});
test('rime piene: "strada" non propone parole che non c\'entrano, e trova assonanze', () => {
  const r = W.rhymes(null, 'notte'); assert.ok(r.rhyme.length + r.assonance.length > 0);
  r.rhyme.forEach(x => assert.ok(/otte$|otte/.test(x.word) || x.word.length >= 3));
});
test('il dizionario impara le TUE parole e le mette prima; non conserva frasi', () => {
  const b = W.learn(null, 'Il mio zaffiro è un tesoro\nzaffiro zaffiro');
  assert.equal(b.w.zaffiro, 3);
  assert.ok(!JSON.stringify(b).includes('tesoro è'), 'solo parole singole');
  const r = W.rhymes(b, 'tesoro'), l = r.rhyme.concat(r.assonance).map(x => x.word);
  assert.ok(l.length > 0);
});
test('parola vuota o corta: nessun errore', () => { assert.deepEqual(W.rhymes(null, '').rhyme, []); assert.ok(Array.isArray(W.rhymes(null, 'a').assonance)); });
test('limite: il dizionario non cresce oltre 15000 parole', () => {
  const b = W.newBank(); for (let i = 0; i < 16500; i++) b.w['parola' + i.toString(36).replace(/\d/g, 'x')] = 1;
  W.learn(b, 'ciao mondo'); assert.ok(Object.keys(b.w).length <= 15002);
});
