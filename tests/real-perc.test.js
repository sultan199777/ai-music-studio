const test = require('node:test'), assert = require('node:assert'), fs = require('fs');
const R = require('../src/real-perc.js');
test('colpi veri CC0: si decodificano, hanno suono, kit «veri» e effetti li usano', () => {
  R.fromJSON(JSON.parse(fs.readFileSync(__dirname + '/../assets/inst/realperc.json', 'utf8')));
  ['clap', 'hatc', 'hato', 'snare', 'snare2', 'shaker', 'tamb', 'conga', 'bongo', 'cajon', 'cowbell', 'claves', 'bdrum', 'crash', 'swell', 'ocean'].forEach(id => {
    const x = R.hit(id, 32000, 0); assert.ok(x && x.length > 3000, id); let pk = 0; for (const v of x) { assert.ok(Number.isFinite(v)); pk = Math.max(pk, Math.abs(v)); } assert.ok(pk > 0.3, id + ' ' + pk);
  });
  assert.strictEqual(R.bed('ocean', 16000, 20).length, 16000 * 20);
  global.RealPerc = R; const SD = require('../src/synth-design.js');
  const sn = SD.kitRender('veri', 'snare', {}, 32000, 3), syn = SD.kitRender('trap', 'snare', {}, 32000, 3); assert.ok(sn.length > 1000); assert.notStrictEqual(sn.length, syn.length); // colpo vero, non sintetico
});
