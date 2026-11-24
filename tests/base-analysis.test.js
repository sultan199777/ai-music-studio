const test = require('node:test');
const assert = require('node:assert/strict');
const B = require('../src/backing.js');
const BA = require('../src/base-analysis.js');

const SR = 22050;

for (const [genre, bpm] of [['pop', 100], ['dance', 124], ['pop', 90]]) {
  test(`base importata: velocità ${bpm} BPM (${genre}) stimata entro 3 BPM`, () => {
    const b = B.generate({ sampleRate: SR, bpm, bars: 8, genre, tonic: 0, mode: 'maggiore', seed: 2 });
    const r = BA.analyze(B.mix(b), SR);
    assert.ok(r.bpm, 'nessuna stima');
    assert.ok(Math.abs(r.bpm - bpm) <= 3, `stimati ${r.bpm}, veri ${bpm}`);
  });
}

for (const [tonic, mode, name] of [[0, 'maggiore', 'Do maggiore'], [9, 'minore', 'La minore'], [7, 'maggiore', 'Sol maggiore'], [2, 'minore', 'Re minore']]) {
  test(`base importata: tonalità ${name} riconosciuta`, () => {
    const b = B.generate({ sampleRate: SR, bpm: 100, bars: 8, genre: 'pop', tonic, mode, seed: 4 });
    const r = BA.analyze(B.mix(b, { batteria: 0 }), SR);
    assert.ok(r.key, 'nessuna tonalità');
    const ok = [r.key.name, r.key.relative.name, r.key.alternative.name].includes(name);
    assert.ok(ok, `stimata ${r.key.name} (relativa ${r.key.relative.name}), vera ${name}`);
  });
}

test('base importata: silenzio e audio breve non generano errori', () => {
  const s = BA.analyze(new Float32Array(SR * 5), SR);
  assert.equal(s.bpm, null); assert.equal(s.key, null);
  const t = BA.analyze(new Float32Array(500), SR);
  assert.equal(t.key, null);
});

test('base importata: accetta stereo e tronca i file lunghi', () => {
  const b = B.generate({ sampleRate: SR, bpm: 100, bars: 16, genre: 'pop', seed: 3 });
  const m = B.mix(b);
  const r = BA.analyze([m, m], SR, { maxSeconds: 10 });
  assert.ok(r.analyzedSeconds <= 10.1 && r.duration > 10);
});
