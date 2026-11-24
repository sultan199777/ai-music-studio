const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('../src/sultan-brain.js');
const L = require('../src/lyrics-engine.js');
const Arr = require('../src/arranger.js');

const STRADA = '[Strofa]\nNel quartiere la strada non perdona\nFra i soldi in tasca e la polizia\nIl blocco mi conosce, la gang è la mia zona\nSangue sull\'asfalto e nemici in fila\n[Ritornello]\nSoldi soldi soldi, strada strada strada';
const AMORE = '[Strofa]\nTi guardo negli occhi amore mio\nIl tuo bacio sa di estate e di mare\nBalliamo insieme stasera tesoro\nIl cuore mi batte, non voglio smettere\n[Ritornello]\nBalla con me, balla con me';
const NOSTALGIA = '[Strofa]\nRicordo la casa dei miei nonni da bambino\nGli anni passano e la scuola è lontana\nMia mamma cucinava e il tempo si fermava\nIeri sembra un sogno ormai passato';

test('lo stesso testo dà sempre lo stesso piano (deterministico)', () => {
  const a = B.plan(STRADA, L.analyze(STRADA)), b = B.plan(STRADA, L.analyze(STRADA));
  assert.deepEqual(a, b);
});
test('testi diversi danno basi diverse (stile, seme o tonalità)', () => {
  const k = (t) => { const p = B.plan(t, L.analyze(t)); return [p.genre, p.seed, p.tonic, p.bpm].join('|'); };
  assert.equal(new Set([k(STRADA), k(AMORE), k(NOSTALGIA)]).size, 3);
});
test('la scena del testo orienta lo stile', () => {
  assert.ok(['street', 'trapdark', 'boombap', 'drill'].includes(B.plan(STRADA, L.analyze(STRADA)).genre), 'strada');
  assert.ok(['clubtrap', 'melodico', 'estate'].includes(B.plan(AMORE, L.analyze(AMORE)).genre), 'amore/festa');
  assert.ok(['boombap', 'melodico', 'trap'].includes(B.plan(NOSTALGIA, L.analyze(NOSTALGIA)).genre), 'nostalgia');
});
test('"altra versione" cambia il risultato ma resta nei limiti', () => {
  const a = B.plan(STRADA, null, { variant: 0 }), b = B.plan(STRADA, null, { variant: 1 });
  assert.notEqual(a.seed, b.seed);
  [a, b].forEach((p) => { assert.ok(p.bpm >= 78 && p.bpm <= 150); assert.ok(p.tonic >= 0 && p.tonic < 12); assert.ok(p.why.length >= 3); });
});
test('testo vuoto: non si rompe', () => {
  const p = B.plan('', null); assert.ok(B.GENRES.includes(p.genre));
});
test('i nuovi stili pesanti generano audio valido', () => {
  ['boombap', 'street', 'trapdark', 'clubtrap'].forEach((g) => {
    assert.ok(Arr.STYLES[g], g);
    const r = Arr.generate({ sampleRate: 8000, bpm: Arr.STYLES[g].bpm, tonic: 9, mode: 'minore', bars: 4, genre: g, seed: 5 });
    assert.ok(r.length >= 8000 * 4 * 60 / r.bpm * 3, g + ' lunghezza ' + r.length);
    let pk = 0; Object.keys(r.tracks).forEach((k) => { const t = r.tracks[k]; for (let q = 0; q < t.length; q += 13) { assert.ok(Number.isFinite(t[q])); if (Math.abs(t[q]) > pk) pk = Math.abs(t[q]); } });
    assert.ok(pk > 0.05, g + ' picco ' + pk);
  });
});

test('umore voluto: dark e euforico spingono stile e scala in direzioni opposte', () => {
  const neutro = 'Cammino piano sotto un cielo grigio\nPenso a cosa resta di noi\nLa notte è lunga e il tempo scorre';
  const d = B.plan(neutro, null, { mood: 'dark' }), e = B.plan(neutro, null, { mood: 'euforico' }), m = B.plan(neutro, null, { mood: 'malinconico' });
  assert.ok(['trapdark', 'drill', 'street'].includes(d.genre), 'dark ' + d.genre);
  assert.equal(d.mode, 'minore');
  assert.ok(['clubtrap', 'estate', 'melodico'].includes(e.genre), 'euforico ' + e.genre);
  assert.ok(['trap', 'boombap', 'melodico'].includes(m.genre), 'malinconico ' + m.genre);
  assert.equal(d.moodTarget, 'dark'); assert.ok(B.plan(STRADA, null).moodTarget);
});

test('stile scritto a parole: trap dark, drill malinconica, boom bap', () => {
  const S = require('../src/sultan-brain.js'), t = 'Sono nato in strada con la fame addosso, ogni giorno una guerra';
  const a = S.plan(t, null, { styleText: 'trap dark' }), b = S.plan(t, null, { styleText: 'drill malinconica' }), c = S.plan(t, null, { styleText: 'boom bap' });
  assert.equal(a.genre, 'trapdark'); assert.ok(a.heavy);
  assert.equal(b.genre, 'drill'); assert.equal(b.moodTarget, 'malinconico');
  assert.equal(c.genre, 'boombap');
});
