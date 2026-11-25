const test = require('node:test'), assert = require('node:assert');
const SP = require('../src/style-presets.js'), A = require('../src/arranger.js'), I = require('../src/instruments.js'), SD = require('../src/synth-design.js');
const ids = new Set(I.CATALOG.map(c => c.id).concat(SD.PRO.map(p => p.id)));
test('atmosfere: tante, con stile base vero e strumenti esistenti (niente flauto)', () => {
  assert.ok(SP.LIST.length >= 30);
  SP.LIST.forEach(p => { assert.ok(A.STYLES[p.base], p.id + ' base ' + p.base); ['melodia', 'accordi', 'pad', 'arpeggio'].forEach(r => p.inst[r].forEach(x => { assert.ok(ids.has(x), p.id + ' ' + x); assert.notStrictEqual(x, 'flute'); })); assert.ok(SD.KITS[p.kit], p.id + ' kit'); });
  assert.strictEqual(new Set(SP.LIST.map(p => p.id)).size, SP.LIST.length);
});
test('pickMany: 24 varianti tutte diverse, molte atmosfere, i pesi del testo contano', () => {
  const v = SP.pickMany(24, null, 7); assert.strictEqual(v.length, 24);
  assert.strictEqual(new Set(v.map(x => x.preset + x.inst.melodia + x.inst.accordi + x.prog.join('') + x.kit)).size, 24);
  assert.ok(new Set(v.map(x => x.preset)).size >= 12, 'atmosfere diverse ' + new Set(v.map(x => x.preset)).size);
  const w = SP.pickMany(24, { reggaeton: 20, afrotrap: 20 }, 7); assert.ok(w.filter(x => ['reggaeton', 'afrotrap'].includes(x.genre)).length >= 6);
  const one = SP.pickMany(8, null, 3, 'ultimo'); assert.ok(one.every(x => x.preset === 'ultimo') && one.length === 8);
});
test('ogni variante si genera davvero con l\'arrangiatore', () => {
  SP.pickMany(10, null, 11).forEach(v => { const b = A.generate({ sampleRate: 8000, genre: v.genre, bpm: v.bpm, mode: v.mode, bars: 4, seed: v.seed, prog: v.prog, tune: v.tune, arpPattern: v.arpPattern, sounds: 'sint', bassStyle: v.bassStyle || undefined }); assert.ok(b.length > 0, v.preset); });
});
