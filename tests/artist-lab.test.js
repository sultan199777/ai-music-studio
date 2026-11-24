const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../src/artist-lab.js');
const B = require('../src/sultan-brain.js');

const S1 = '[Strofa]\nNel quartiere la strada non perdona\nFra i soldi in tasca e la polizia\nIl blocco mi conosce, la gang è la mia zona\nSangue sull\'asfalto e nemici in fila\n[Ritornello]\nSoldi soldi soldi, strada strada strada\nSoldi soldi soldi, strada strada strada';
const S2 = '[Strofa]\nTi guardo negli occhi amore mio\nIl tuo bacio sa di estate e di mare\nBalliamo insieme stasera tesoro';

test('measure: solo numeri, nessun testo conservato', () => {
  const m = A.measure(S1);
  assert.equal(m.songs, 1); assert.ok(m.lines >= 6); assert.ok(m.scenes.strada >= 3);
  assert.ok(!JSON.stringify(m).includes('quartiere'), 'il testo non deve restare');
});
test('finalize: profilo con umore e stile', () => {
  const P = A.finalize(A.merge(A.merge(null, A.measure(S1)), A.measure(S1)));
  assert.equal(P.songs, 2); assert.ok(P.avgSyll > 5); assert.equal(P.top[0].scene, 'strada');
  assert.ok(['street', 'trapdark', 'boombap', 'drill', 'trap'].includes(P.styleTop), P.styleTop);
  assert.match(P.mood, /strada/);
  assert.ok(P.pairs.some(p => p.pair === 'soldi+strada'), 'associazione strada+soldi');
});
test('profili diversi danno stili diversi', () => {
  const a = A.finalize(A.measure(S1)), b = A.finalize(A.measure(S2));
  assert.notEqual(a.styleTop, b.styleTop);
});
test('blend: media di due artisti, valori tra i due', () => {
  const a = A.finalize(A.measure(S1)), b = A.finalize(A.measure(S2)), m = A.blend([a, b], ['A', 'B']);
  assert.ok(m.avgSyll >= Math.min(a.avgSyll, b.avgSyll) - 0.01 && m.avgSyll <= Math.max(a.avgSyll, b.avgSyll) + 0.01);
  assert.equal(m.names, 'A + B');
});
test('compare: consigli con numeri; nessun errore con testo vuoto o senza modello', () => {
  const P = A.finalize(A.measure(S1));
  const r = A.compare(S2, P); assert.ok(r.length >= 5); assert.ok(r.every(x => x.text && x.tag));
  assert.ok(A.compare('', P)[0].text.includes('Scrivi'));
  assert.ok(A.compare(S2, null)[0].text.includes('modello'));
});
test('il cervello segue il profilo artista', () => {
  const P = A.finalize(A.measure(S1)), neutro = 'Cammino piano sotto un cielo grigio\nPenso a cosa resta di noi';
  const without = B.plan(neutro, null), withP = B.plan(neutro, null, { profile: P });
  assert.ok(withP.why.some(w => w.includes('modello artisti')));
  assert.ok(['street', 'trapdark', 'boombap', 'drill', 'trap'].includes(withP.genre), withP.genre + ' (senza: ' + without.genre + ')');
});

test('Beat Lab: il piano del cervello cambia davvero il progetto (testi diversi, basi diverse)', () => {
  const E = require('../src/beatlab-engine.js'), P = require('../src/beatlab-patterns.js');
  const mk = (pl) => { const p = E.newProject(); P.randomize(p, 'trap', pl.seed, { keepBpm: true }); return JSON.stringify(E.drumTracks(p).map(t => t.steps)); };
  const a = B.plan(S1, null), b = B.plan(S2, null);
  assert.notEqual(mk(a), mk(b));
});
