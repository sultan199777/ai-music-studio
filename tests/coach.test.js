const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../src/coach.js');

const cands = { melodia: [{ id: 'piano', prior: 2 }, { id: 'harp', prior: 1.5 }, { id: 'lab:vetro', prior: 1 }], accordi: [{ id: 'guitar', prior: 2 }, { id: 'piano', prior: 1 }], pad: [{ id: 'violins', prior: 2 }, { id: 'organ', prior: 1 }] };

test('impara: senza esperienza segue il mestiere, dopo i "mi piace" cambia scelta', () => {
  let st = C.fresh();
  assert.equal(C.suggest(st, cands, { seed: 1 }).inst.melodia, 'piano');
  for (let i = 0; i < 3; i++) st = C.record(st, 'like', { genre: 'trap', inst: { melodia: 'lab:vetro', accordi: 'guitar', pad: 'violins' } });
  st = C.record(st, 'dislike', { genre: 'trap', inst: { melodia: 'piano' } });
  const s = C.suggest(st, cands, { seed: 2 });
  assert.equal(s.inst.melodia, 'lab:vetro');
  assert.ok(s.why.some((w) => /piaciuto/.test(w)));
});

test('impara per emozione: triste e allegro possono avere strumenti diversi', () => {
  let st = C.fresh();
  for (let i = 0; i < 3; i++) { st = C.record(st, 'like', { emotion: 'tristezza', inst: { melodia: 'harp' } }); st = C.record(st, 'dislike', { emotion: 'gioia', inst: { melodia: 'harp' } }); }
  assert.equal(C.suggest(st, cands, { emotion: 'tristezza', seed: 3 }).inst.melodia, 'harp');
  assert.notEqual(C.suggest(st, cands, { emotion: 'gioia', seed: 3 }).inst.melodia, 'harp');
});

test('cambiare strumento e scartare subito contano come voti; i voti vecchi decadono', () => {
  let st = C.fresh();
  st = C.record(st, 'change', {}, { role: 'melodia', from: 'piano', to: 'harp' });
  assert.ok(st.prefs['inst.melodia:piano'] < 0 && st.prefs['inst.melodia:harp'] > 0);
  const v = st.prefs['inst.melodia:harp'];
  for (let i = 0; i < 10; i++) st = C.record(st, 'skip', { genre: 'drill' });
  assert.ok(st.prefs['inst.melodia:harp'] < v && st.prefs['genre:drill'] < 0);
});

test('esplora ogni tanto e lo dichiara', () => {
  let st = C.fresh(), seen = 0;
  for (let i = 0; i < 6; i++) st = C.record(st, 'complete', { inst: { melodia: 'piano' } });
  for (let seed = 1; seed < 60; seed++) { const s = C.suggest(st, cands, { seed }); if (s.explore) { seen++; assert.ok(s.why.some((w) => /provare/.test(w))); assert.notEqual(s.explore.to, s.explore.from); } }
  assert.ok(seen > 3 && seen < 30, 'esplorazioni ' + seen);
});

test('lezioni: errori misurati con perché, come e azione; niente lezioni se va tutto bene', () => {
  const bad = C.lessons({
    take: { peakDb: 0, rmsDb: -12, clippingShare: 0.01, cents: 42, voiced: 0.6, key: { tonic: 2, mode: 'minore', confidence: 'alta', name: 'Re minore' } },
    base: { tonic: 0, mode: 'maggiore', bpm: 140, bars: 8, melodia: 1, name: 'Do maggiore' }, mixDb: -6,
    lines: [{ text: 'a', need: 5 }, { text: 'b', need: 1 }, { text: 'c', need: 1 }, { text: 'd', need: 1 }, { text: 'e', need: 1 }, { text: 'f', need: 1 }]
  });
  const ids = bad.lessons.map((l) => l.id);
  for (const id of ['clip', 'pitch', 'key', 'quiet', 'clash', 'dense', 'short']) assert.ok(ids.includes(id), id);
  bad.lessons.forEach((l) => assert.ok(l.what && l.why && l.how && C.SKILLS[l.skill]));
  assert.equal(bad.lessons.find((l) => l.id === 'key').fix.tonic, 2);
  const good = C.lessons({ take: { peakDb: -4, rmsDb: -18, clippingShare: 0, cents: 12, voiced: 0.6, key: { tonic: 9, mode: 'minore', confidence: 'alta', name: 'La minore' } }, base: { tonic: 0, mode: 'maggiore', bpm: 96, bars: 32, melodia: 0.5, name: 'Do maggiore' }, mixDb: 2, lines: [{ text: 'a', need: 2 }] });
  assert.deepEqual(good.lessons, [], 'La minore è la relativa di Do maggiore: compatibile');
});

test('percorso: un\'abilità è imparata dopo 3 controlli giusti di fila', () => {
  let st = C.fresh();
  const bad = { lessons: [{ skill: 'mix' }], checked: ['mix', 'livelli'] }, ok = { lessons: [], checked: ['mix', 'livelli'] };
  st = C.learn(st, bad); st = C.learn(st, ok); st = C.learn(st, ok);
  assert.equal(C.progress(st).skills.find((s) => s.id === 'mix').imparata, false);
  st = C.learn(st, ok);
  const p = C.progress(st);
  assert.equal(p.skills.find((s) => s.id === 'mix').imparata, true);
  assert.equal(p.imparate, 2); assert.ok(p.livello);
});
