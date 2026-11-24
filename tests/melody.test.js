const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../src/arranger.js');
const SR = 8000;
const mel = (g, ms, seed) => A.generate({ sampleRate: SR, genre: g, bars: 16, tonic: 9, mode: 'minore', seed: seed || 5, melSeed: ms }).events.lead.map((e) => Math.round(e.midi) + '@' + e.start.toFixed(2)).join(',');
test('melSeed diverso = melodia diversa (stessa base)', () => {
  for (const g of ['trap', 'drill', 'trapdark', 'boombap']) {
    const set = new Set([0, 1, 2, 3, 4, 5].map((m) => mel(g, m)));
    assert.ok(set.size >= 5, g + ' varianti ' + set.size);
  }
});
test('stessa melSeed = stessa melodia; note in pentatonica/seconda minore e registro sensato', () => {
  assert.equal(mel('trap', 2), mel('trap', 2));
  const b = A.generate({ sampleRate: SR, genre: 'trapdark', bars: 16, tonic: 9, mode: 'minore', seed: 7, melSeed: 3 });
  const ok = [0, 1, 3, 5, 7, 10];
  assert.ok(b.events.lead.length > 8);
  b.events.lead.forEach((e) => { assert.ok(ok.includes((((Math.round(e.midi) - 9) % 12) + 12) % 12), 'nota ' + e.midi); assert.ok(e.midi >= 57 && e.midi <= 91, 'registro ' + e.midi); });
});
