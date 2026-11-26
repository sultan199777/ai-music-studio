const test = require('node:test'), assert = require('node:assert');
const SA = require('../src/studio-agent.js');
const st = () => ({ prod: { levels: {}, mix: {} }, mic: { mode: 'pulito', ids: ['naturale'] }, ctx: { sections: [{ name: 'strofa', startBar: 2 }, { name: 'ritornello', startBar: 10 }], leadNotes: [{ bar: 2, step: 0, len: 2, midi: 72 }] } });
test('frasi → modifiche vere al progetto', () => {
  let s = st(), r = SA.interpret('808 più lungo e più distorto', s);
  assert.ok(r.understood); assert.ok(s.prod.b808.decay > 1.2); assert.ok(s.prod.mix.bass.sat >= 0.2);
  s = st(); SA.interpret('voce più riverbero e più brillante', s); assert.strictEqual(s.prod.mix.voice.rev, 0.15); assert.strictEqual(s.prod.mix.voice.high, 3);
  s = st(); SA.interpret('abbassa gli accordi, alza la melodia', s); assert.strictEqual(s.prod.levels.accordi, 0.8); assert.strictEqual(s.prod.levels.melodia, 1.25);
  s = st(); SA.interpret("melodia un'ottava sopra", s); assert.strictEqual(s.prod.notes.lead[0].midi, 84);
  s = st(); SA.interpret('riser prima del ritornello', s); assert.deepStrictEqual(s.prod.fxList, [{ type: 'riser', bar: 10 }]);
  s = st(); SA.interpret('voce con autotune robot e vocoder', s); assert.strictEqual(s.mic.ids[0], 'robotico'); assert.strictEqual(s.mic.fx, 'vocoder'); assert.ok(s.micChanged);
  s = st(); SA.interpret('arpeggio a destra, pad più scuro', s); assert.strictEqual(s.prod.mix.arp.pan, 0.6); assert.strictEqual(s.prod.mix.pad.high, -3);
  s = st(); SA.interpret('master per spotify', s); assert.strictEqual(s.prod.mpro.target, 'streaming');
});
test('quello che non capisce non lo fa', () => { const s = st(), r = SA.interpret('fammi un caffè', s); assert.strictEqual(r.understood, false); assert.deepStrictEqual(s.prod.mix, {}); });
test('stile Pop Smoke / Drill di Brooklyn a parole', () => { const s = st(); assert.ok(SA.interpret('fammi una base tipo Pop Smoke', s).understood); assert.strictEqual(s.prod.genre, 'brooklyn'); assert.strictEqual(s.prod.bpm, 143); });

// Mani nuove (26/11): ogni comando deve cambiare davvero lo stato giusto
test('mani: bpm a numero, 808, sezione, giro, melodia, strumento, swing, sidechain', () => {
  const SA = require('../src/studio-agent.js');
  const mk = () => ({ prod: { bpm: 137, mode: 'minore', levels: {}, inst: { melodia: 'guitar', accordi: 'piano' }, prog: [0, 5, 3, 4], seed: 3 }, mic: {}, ctx: { progs: [[0, 5, 3, 4], [5, 3, 0, 4]], inst: [{ id: 'piano', nome: 'Pianoforte a coda' }, { id: 'guitar', nome: 'Chitarra acustica' }, { id: 'violins', nome: 'Violini' }], sections: [] } });
  let st = mk(); SA.interpret('bpm 140', st); assert.strictEqual(st.prod.bpm, 140);
  st = mk(); SA.interpret('più 808', st); assert.ok(st.prod.levels.basso > 1);
  st = mk(); SA.interpret('togli la batteria nell intro', st); assert.deepStrictEqual(st.prod.secMix.intro, { kick: 0, snare: 0, hat: 0 }); assert.strictEqual(st.prod.levels.batteria, undefined);
  st = mk(); SA.interpret('cambia gli accordi', st); assert.notDeepStrictEqual(st.prod.prog, [0, 5, 3, 4]);
  st = mk(); SA.interpret('cambia la melodia', st); assert.strictEqual(st.prod.melSeed, 1);
  st = mk(); SA.interpret('metti il piano al posto della chitarra', st); assert.strictEqual(st.prod.inst.melodia, 'piano');
  st = mk(); SA.interpret('usa i violini per la melodia', st); assert.strictEqual(st.prod.inst.melodia, 'violins');
  st = mk(); SA.interpret('più swing', st); assert.ok(st.prod.groove.swing > 0);
  st = mk(); SA.interpret('aggiungi sidechain', st); assert.ok(st.prod.mix.bass.duck > 0);
  st = mk(); const r = SA.interpret('duplica il ritornello', st); assert.strictEqual(r.understood, false); // non lo sa fare: non finge
});
test('«e» separa due comandi su tracce diverse, ma non sulla stessa', () => {
  const SA2 = require('../src/studio-agent.js');
  assert.deepStrictEqual(SA2.interpret('808 più lungo e voce con più riverbero', { prod: { levels: {} }, mic: {}, ctx: {} }).changes, ['808 più lungo (durata 1.8 s)', 'voce: più riverbero']);
  assert.deepStrictEqual(SA2.interpret('808 più lungo e più distorto', { prod: { levels: {} }, mic: {}, ctx: {} }).changes, ['808 più lungo (durata 1.8 s)', '808: più distorsione']);
});
