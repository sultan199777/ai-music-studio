const test = require('node:test'), assert = require('node:assert');
const C = require('../src/creative-intents.js');
const base = () => ({ bpm: 137, mode: 'maggiore', tonic: 0, levels: {}, kit: 'trap', seed: 3, prog: [0, 4, 5, 3] });
test('ogni intenzione cambia più cose musicali, ognuna col suo perché', () => {
  ['più aggressiva', 'più malinconica', 'più potente', 'più commerciale', 'più dolce', 'più energica', 'più cupa'].forEach(t => {
    const id = C.match(t); assert.ok(id, t); const p = base(), r = C.apply(id, p, { plan: [['intro', 2], ['strofa', 8], ['ritornello', 4]], sections: [{ name: 'ritornello', startBar: 10 }], styleBpm: 140 });
    assert.ok(r.fatti.length >= 3, t + ' cambia almeno 3 cose'); r.fatti.forEach(f => assert.ok(f.why.length > 10));
    assert.notDeepStrictEqual(p, base(), t);
  });
});
test('malinconica: minore, più lenta; aggressiva: 808 più sporco; memoria salta ciò che hai annullato', () => {
  let p = base(); C.apply('malinconica', p, {}); assert.strictEqual(p.mode, 'minore'); assert.ok(p.bpm < 137);
  p = base(); C.apply('aggressiva', p, {}); assert.ok(p.b808.drive > 0.5);
  p = base(); const r = C.apply('aggressiva', p, { refused: { 'aggressiva:kit': 2 } }); assert.strictEqual(p.kit, 'trap'); assert.deepStrictEqual(r.saltati, ['kit']);
});
