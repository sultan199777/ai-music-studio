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
