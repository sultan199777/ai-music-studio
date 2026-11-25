'use strict';
const test = require('node:test'), assert = require('node:assert');
const D = require('../src/dna.js'), A = require('../src/arranger.js');
const gen = (d, seed) => { const p = D.toProd(d, seed || 1); return A.generate({ genre: p.genre, bpm: p.bpm, mode: p.mode, tonic: 0, seed: 5, bars: 8, groove: p.groove, prog: p.prog, tune: p.tune, heavy: p.heavy, leadRest: p.leadRest, melSeed: p.melSeed }); };
const rms = x => { let s = 0; for (let i = 0; i < x.length; i++) s += x[i] * x[i]; return Math.sqrt(s / x.length); };
const base = () => D.sanitize(D.byId('sfera')), mk = (o) => Object.assign(base(), o);
const same = (a, b) => Buffer.from(a.buffer).equals(Buffer.from(b.buffer));

test('ci sono almeno 20 profili con numeri validi dentro i limiti', () => {
  assert.ok(D.LIST.length >= 20);
  D.LIST.forEach(p => D.ORDER.forEach(k => { assert.ok(p[k] >= D.FIELDS[k][0] && p[k] <= D.FIELDS[k][1], p.id + ' ' + k + '=' + p[k]); }));
  ['sfera', 'shiva', 'kidyugi', 'ultimo', 'drake', 'travis', 'future', 'badbunny', 'anuel', 'anna', 'rondo', 'smoke', 'weeknd', 'geolier', 'lazza'].forEach(id => assert.ok(D.byId(id), id));
});
test('Misurato: ogni numero cambia il suono (eventi o audio)', () => {
  const hLo = gen(mk({ hat: 0.6 })), hHi = gen(mk({ hat: 1.6 }));
  assert.ok(rms(hHi.tracks.hat) > rms(hLo.tracks.hat) * 1.1, 'hat volume');
  const kLo = gen(mk({ kick: 0.1 })), kHi = gen(mk({ kick: 0.95 })); assert.ok(kHi.events.kick.length > kLo.events.kick.length * 1.2, 'cassa ' + kLo.events.kick.length + '→' + kHi.events.kick.length);
  const dLo = gen(mk({ drive: 0.9 })), dHi = gen(mk({ drive: 3.4 })); assert.ok(Math.abs(rms(dHi.tracks.bass) - rms(dLo.tracks.bass)) > 0.02, '808 distorsione');
  const rLo = gen(mk({ rolls: 0 })), rHi = gen(mk({ rolls: 1 })); assert.ok(rHi.events.hat.length > rLo.events.hat.length * 1.1, 'rullate');
  const pLo = gen(mk({ rest: 0 })), pHi = gen(mk({ rest: 0.55 })); assert.ok(pHi.events.lead.length < pLo.events.lead.length, 'pause melodia ' + pLo.events.lead.length + '→' + pHi.events.lead.length);
  assert.ok(!same(gen(mk({ swing: 0 })).tracks.hat, gen(mk({ swing: 0.15 })).tracks.hat), 'swing');
  assert.ok(!same(gen(mk({ slide: 0 })).tracks.bass, gen(mk({ slide: 1 })).tracks.bass), 'scivolate 808');
  assert.ok(gen(mk({ bpm: 90 })).duration > gen(mk({ bpm: 150 })).duration * 1.5, 'tempo');
  assert.ok(!same(gen(mk({ lift: 0.7 })).tracks.chords, gen(mk({ lift: 1.5 })).tracks.chords), 'spinta');
});
test('tutti i profili producono una base valida e profili diversi suonano diversi', () => {
  const sig = new Set();
  D.LIST.forEach(p => { const g = gen(p, 3); assert.ok(g.length > 0 && g.events.kick.length > 0 && g.events.hat.length > 0, p.id); sig.add(g.bpm + '|' + g.events.kick.length + '|' + g.events.hat.length); });
  assert.ok(sig.size >= 14, 'firme diverse: ' + sig.size);
});
test('Genre Fusion: media pesata dei numeri, pesi diversi = base diversa, nome e quote', () => {
  const a = D.byId('f-ballata'), b = D.byId('smoke'), f1 = D.fuse([{ id: 'f-ballata', w: 1 }, { id: 'smoke', w: 1 }], 4), f2 = D.fuse([{ id: 'f-ballata', w: 1 }, { id: 'smoke', w: 4 }], 4);
  assert.ok(f1.bpm > a.bpm && f1.bpm < b.bpm); assert.ok(f2.bpm > f1.bpm, 'più drill = più veloce');
  assert.ok(f2.dark > f1.dark && f1.dark > a.dark);
  assert.strictEqual(f1.parts.length, 2); assert.ok(Math.abs(f1.parts[0].w - 0.5) < 0.01); assert.match(f1.name, /Ballata.*Pop Smoke/);
  assert.ok(gen(f2).events.kick.length !== gen(f1).events.kick.length || gen(f2).bpm !== gen(f1).bpm);
  assert.strictEqual(D.fuse([{ id: 'sfera', w: 1 }], 1).bpm, D.byId('sfera').bpm);
  assert.strictEqual(D.fuse([], 1).name, 'Nuovo stile');
});
test('Emotion Engine: malinconia ≠ euforia, in numeri', () => {
  const mal = 'Sono solo, piove, il dolore mi consuma, lacrime nel buio, perso e vuoto, addio', eu = 'Festa tutta la notte, ballo, soldi, vinto, libero sopra il mondo, estate, ridiamo';
  const em1 = D.emotion(mal), em2 = D.emotion(eu); assert.ok(['malinconia', 'solitudine'].indexOf(em1.top[0]) >= 0, em1.top.join()); assert.strictEqual(em2.top[0], 'euforia');
  const b = D.byId('f-trap'), a1 = D.applyEmotion(b, em1, 1), a2 = D.applyEmotion(b, em2, 1);
  assert.ok(a1.dna.bpm < b.bpm && a2.dna.bpm > b.bpm); assert.ok(a1.dna.dark > b.dark && a2.dna.dark < b.dark); assert.strictEqual(a1.dna.mode, 'minore');
  assert.ok(gen(a2.dna).duration < gen(a1.dna).duration, 'euforia più veloce = base più corta a pari battute');
  assert.ok(a1.why.length >= 1);
  const none = D.applyEmotion(b, D.emotion('xyz qwe'), 1); assert.strictEqual(none.dna.bpm, b.bpm);
});
test('rabbia e tensione: 808 più duro e più cassa', () => {
  const b = D.byId('f-trap'), r = D.applyEmotion(b, D.emotion('rabbia odio urlo guerra sangue vendetta'), 1).dna; assert.ok(r.drive > b.drive && r.kick > b.kick);
});
test('toProd: stesso seme = stessi parametri, seme diverso = ritmo diverso; valori nei limiti', () => {
  const d = D.byId('shiva'), a = D.toProd(d, 5), b = D.toProd(d, 5), c = D.toProd(d, 6);
  assert.deepStrictEqual(a, b); assert.notDeepStrictEqual(a.groove.kickPats, c.groove.kickPats);
  assert.ok(a.groove.kickPats.every(p => p[0][0] === 0)); assert.strictEqual(a.prog.length, 4);
});
test('sanitize: valori fuori scala vengono riportati nei limiti, dati sporchi non rompono', () => {
  const s = D.sanitize({ bpm: 9999, swing: -3, kick: 'x', fam: 'trap' }); assert.strictEqual(s.bpm, 175); assert.strictEqual(s.swing, 0); assert.ok(typeof s.kick === 'number');
  assert.ok(D.sanitize(null).bpm > 0);
});

test('Consigliere: dal testo propone 3 mix diversi coerenti con l\'emozione', () => {
  const r = D.suggest('Sono solo, piove, il dolore mi consuma, lacrime nel buio, perso e vuoto', 3, 1);
  assert.strictEqual(r.recipes.length, 3); assert.strictEqual(new Set(r.recipes.map(x => x.name)).size, 3);
  r.recipes.forEach(x => { assert.strictEqual(x.parts.reduce((a, y) => a + y.w, 0), 100); x.parts.forEach(y => assert.ok(D.byId(y.id))); });
  const eu = D.suggest('Festa tutta la notte, ballo, soldi, vinto, libero, estate', 3, 1);
  assert.notDeepStrictEqual(r.recipes.map(x => x.name), eu.recipes.map(x => x.name));
  assert.ok(D.suggest('', 2, 1).recipes.length >= 1);
});
